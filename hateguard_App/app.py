"""
HateGuard v3 — Flask backend
Dual-mode moderation platform (User + Admin)
Shared in-memory state · escalation at 5 toxic messages
"""

from flask import Flask, render_template, request, jsonify, send_file
import os, re, csv, io, json, time, pickle
from datetime import datetime
from collections import deque, defaultdict
import numpy as np

# ── app ────────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

# ── shared state (one session) ─────────────────────────────────────────────
STATE = {
    "messages":    [],           # all messages {id,user,text,label,score,ts,decided}
    "notifications": [],
    "action_log":  [],
    "trend_hist":  [],
    "user_stats":  defaultdict(lambda: {"total":0,"hate":0,"off":0,"normal":0,"warned":0,"deleted":0}),
    "burst_buf":   [],           # unix timestamps of toxic msgs in last 60s
    "stats":       {"total":0,"hate":0,"off":0,"normal":0,"deleted":0,"warned":0,"actions":0,"escalations":0},
    "cur_action":  None,
    "is_frozen":   False,
    "is_shadow":   False,
    "esc_active":  False,
    "esc_count":   0,
    "last_esc_ts": 0,
    "THRESH":      5,            # escalation threshold
}

# ── model loading ──────────────────────────────────────────────────────────
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "hate_speech_model.pkl")
bundle = None

HATE_KW = ['kill','deport','hate','filth','disgust','animal','vermin','foreigner',
           'immigrants','exterminate','lynch','subhuman','genocide','destroy all']
OFF_KW  = ['bitch','idiot','stupid','moron','fuck','shit','braindead','loser',
           'jerk','shut up','clown','dumb','asshole','retard']

def load_model():
    global bundle
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            bundle = pickle.load(f)
        print("[HateGuard] ML model loaded.")
    else:
        print("[HateGuard] No .pkl found → rule-based fallback active.")
load_model()

def rule_classify(text):
    t = text.lower()
    h = sum(1 for w in HATE_KW if w in t)
    o = sum(1 for w in OFF_KW  if w in t)
    rnd = lambda x: np.random.uniform(0, x)
    if h >= 1:
        s = min(.97, .52 + h*.15 + rnd(.07))
        return "hate_speech", s, {"hate_speech":s,"offensive":.07,"neither":.05}
    if o >= 1:
        s = min(.97, .47 + o*.13 + rnd(.07))
        return "offensive",   s, {"hate_speech":.04,"offensive":s,"neither":.10}
    s = min(.95, .70 + rnd(.14))
    return "neither", s, {"hate_speech":.02,"offensive":.04,"neither":s}

def predict(texts):
    if isinstance(texts, str):
        texts = [texts]
    if bundle:
        try:
            from scipy.sparse import hstack, csr_matrix
            cleaned = [_clean(t) for t in texts]
            dense  = bundle["lexicon_scaler"].transform(np.array([_row(c) for c in cleaned]))
            Xw = bundle["word_vectorizer"].transform(cleaned)
            Xc = bundle["char_vectorizer"].transform(cleaned)
            X  = hstack([Xw, Xc, csr_matrix(dense)]).tocsr()
            proba = bundle["calibrated_model"].predict_proba(X)
            theta = bundle.get("theta", 0.23)
            preds = np.where(proba[:,0] >= theta, 0, np.argmax(proba[:,1:], axis=1)+1)
            out = []
            for i, p in enumerate(preds):
                lbl = bundle["label_map"][int(p)]
                out.append((lbl, float(proba[i, int(p)]),
                            {"hate_speech":round(float(proba[i,0]),4),
                             "offensive":round(float(proba[i,1]),4),
                             "neither":round(float(proba[i,2]),4)}))
            return out
        except Exception as e:
            print(f"[HateGuard] Model error: {e}")
    return [rule_classify(t) for t in texts]

_URL  = re.compile(r"http\S+|www\.\S+")
_MENT = re.compile(r"@\w+")
_HASH = re.compile(r"#\w+")
_NA   = re.compile(r"[^a-z\s]")
def _clean(text):
    t = str(text).lower()
    t = _URL.sub(" ", t); t = _MENT.sub(" ", t); t = _HASH.sub(" ", t)
    t = _NA.sub(" ", t)
    return re.sub(r"\s+", " ", t).strip()

def _row(text):
    if not bundle: return [0]*8
    toks = text.split()
    s = set(toks)
    off  = bundle["lexicons"]["offensive_lexicon"]
    hatt = bundle["lexicons"]["hate_target_lexicon"]
    race = bundle["lexicons"]["race_lexicon"]
    gen  = bundle["lexicons"]["gender_lexicon"]
    rel  = bundle["lexicons"]["religion_lexicon"]
    nat  = bundle["lexicons"]["nationality_lexicon"]
    return [sum(t in off  for t in toks), sum(t in hatt for t in toks),
            sum(t in race for t in toks), sum(t in gen  for t in toks),
            sum(t in rel  for t in toks), sum(t in nat  for t in toks),
            float(bool(s & off)), float(bool(s & hatt))]

def _label_ui(label):
    return {"hate_speech":"hate","offensive":"offensive","neither":"normal"}.get(label, label)

def _now():
    return datetime.now().strftime("%H:%M:%S")

# ── escalation check ───────────────────────────────────────────────────────
def _check_escalation():
    msgs = STATE["messages"]
    total  = len(msgs) or 1
    toxic  = sum(1 for m in msgs if m["label"] != "normal")
    pct    = round(toxic / total * 100, 1)
    now    = time.time()
    burst  = sum(1 for t in STATE["burst_buf"] if now - t < 60)
    scores = [m["score"] for m in msgs if m["label"] != "normal"]
    mean_s = round(sum(scores)/len(scores), 3) if scores else 0.0
    repeat = sum(1 for v in STATE["user_stats"].values() if v["hate"] > 1 or v["off"] > 2)
    triggered = toxic >= STATE["THRESH"]
    if triggered and (not STATE["esc_active"] or now - STATE["last_esc_ts"] > 12):
        if not STATE["esc_active"]:
            STATE["esc_active"]  = True
            STATE["last_esc_ts"] = now
            STATE["esc_count"]  += 1
            STATE["stats"]["escalations"] += 1
            _add_log("esc", f"Escalade: {toxic} msgs toxiques ({pct}%)")
            STATE["notifications"].insert(0, {
                "type": "crit",
                "title": f"🚨 Escalade de toxicité",
                "body":  f"{toxic} msgs toxiques ({pct}%) · burst: {burst}/min",
                "read":  False,
                "ts":    _now(),
                "freeze": True,
            })
    elif not triggered:
        STATE["esc_active"] = False
    return {"triggered": triggered, "pct": pct, "toxic": toxic,
            "burst": burst, "mean_score": mean_s, "repeat": repeat}

def _add_log(type_, msg):
    STATE["action_log"].insert(0, {"type": type_, "msg": msg, "ts": _now()})
    if len(STATE["action_log"]) > 100:
        STATE["action_log"].pop()

# ── routes ─────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/classify", methods=["POST"])
def classify_one():
    d    = request.get_json(force=True)
    text = d.get("text","").strip()
    user = d.get("user","anonymous")
    if not text:
        return jsonify({"error": "empty"}), 400
    lbl_raw, conf, scores = predict([text])[0]
    label = _label_ui(lbl_raw)
    cid   = f"m{int(time.time()*1000)}"
    ts    = _now()
    msg   = {"id":cid,"user":user,"text":text,"label":label,"score":round(conf,4),
             "scores":scores,"ts":ts,"decided":None}
    STATE["messages"].append(msg)
    STATE["trend_hist"].append(label)
    if len(STATE["trend_hist"]) > 20: STATE["trend_hist"].pop(0)
    STATE["stats"]["total"] += 1
    STATE["stats"][label if label != "normal" else "normal"] = STATE["stats"].get(label if label !="normal" else "normal", 0) + 1
    if label == "hate":   STATE["stats"]["hate"] += 1
    elif label == "offensive": STATE["stats"]["off"] += 1
    else: STATE["stats"]["normal"] += 1
    STATE["user_stats"][user]["total"] += 1
    STATE["user_stats"][user][label if label != "normal" else "normal"] = \
        STATE["user_stats"][user].get(label if label != "normal" else "normal", 0) + 1
    if label == "hate":   STATE["user_stats"][user]["hate"] += 1
    elif label == "offensive": STATE["user_stats"][user]["off"] += 1
    else: STATE["user_stats"][user]["normal"] += 1
    if label != "normal":
        STATE["burst_buf"].append(time.time())
        STATE["burst_buf"] = [t for t in STATE["burst_buf"] if time.time()-t < 60]
    esc = _check_escalation()
    msg["escalation"] = esc
    return jsonify(msg)

@app.route("/api/classify/batch", methods=["POST"])
def classify_batch():
    d     = request.get_json(force=True)
    texts = d.get("texts", [])
    if not texts: return jsonify({"error":"no texts"}), 400
    results = predict(texts)
    out = []
    for text, (lbl_raw, conf, scores) in zip(texts, results):
        out.append({"text": text, "label": _label_ui(lbl_raw),
                    "confidence": round(conf,4), "scores": scores})
    return jsonify(out)

@app.route("/api/feed")
def get_feed():
    label  = request.args.get("label", "all")
    page   = int(request.args.get("page", 1))
    limit  = int(request.args.get("limit", 50))
    msgs   = STATE["messages"]
    if label != "all":
        msgs = [m for m in msgs if m["label"] == label]
    start = (page-1)*limit
    return jsonify({"messages": msgs[start:start+limit][::-1], "total": len(msgs)})

@app.route("/api/state")
def get_state():
    esc = _check_escalation()
    t   = STATE["stats"]["total"] or 1
    return jsonify({
        "stats":      STATE["stats"],
        "esc":        esc,
        "cur_action": STATE["cur_action"],
        "is_frozen":  STATE["is_frozen"],
        "is_shadow":  STATE["is_shadow"],
        "trend_hist": STATE["trend_hist"],
        "action_log": STATE["action_log"][:15],
        "notifications": STATE["notifications"][:10],
        "user_stats": {k: dict(v) for k,v in STATE["user_stats"].items()},
        "hate_pct":   round(STATE["stats"]["hate"]/t*100, 1),
        "off_pct":    round(STATE["stats"]["off"]/t*100, 1),
    })

@app.route("/api/action/warn/<mid>", methods=["POST"])
def action_warn(mid):
    m = next((x for x in STATE["messages"] if x["id"]==mid), None)
    if not m: return jsonify({"error":"not found"}), 404
    m["decided"] = "warned"
    STATE["stats"]["warned"] += 1
    STATE["stats"]["actions"] += 1
    STATE["user_stats"][m["user"]]["warned"] += 1
    _add_log("warn", f"Avertissement → {m['user']}")
    return jsonify({"ok": True})

@app.route("/api/action/delete/<mid>", methods=["POST"])
def action_delete(mid):
    m = next((x for x in STATE["messages"] if x["id"]==mid), None)
    if not m: return jsonify({"error":"not found"}), 404
    m["decided"] = "deleted"
    STATE["stats"]["deleted"] += 1
    STATE["stats"]["actions"] += 1
    STATE["user_stats"][m["user"]]["deleted"] += 1
    _add_log("delete", f"Message supprimé ({m['user']})")
    return jsonify({"ok": True})

@app.route("/api/action/approve/<mid>", methods=["POST"])
def action_approve(mid):
    m = next((x for x in STATE["messages"] if x["id"]==mid), None)
    if not m: return jsonify({"error":"not found"}), 404
    m["decided"] = "approved"
    STATE["stats"]["actions"] += 1
    return jsonify({"ok": True})

@app.route("/api/action/warn-user/<user>", methods=["POST"])
def warn_user(user):
    STATE["user_stats"][user]["warned"] += 1
    STATE["stats"]["actions"] += 1
    _add_log("warn", f"Avertissement utilisateur → {user}")
    return jsonify({"ok": True})

@app.route("/api/action/ban-user/<user>", methods=["POST"])
def ban_user(user):
    STATE["stats"]["actions"] += 1
    _add_log("ban", f"Utilisateur banni → {user}")
    return jsonify({"ok": True, "banned": user})

@app.route("/api/escalation/action", methods=["POST"])
def escalation_action():
    d      = request.get_json(force=True)
    action = d.get("action")  # freeze|lock|shadow|warn-all|clear
    msgs   = {"freeze":"❄ Discussion gelée","lock":"🔒 Thread verrouillé",
              "shadow":"👁 Shadow modération activée","warn-all":"⚠ Avertissement envoyé à tous",
              "clear":"Action annulée"}
    if action == "clear":
        STATE["cur_action"] = None
        STATE["is_frozen"]  = False
        STATE["is_shadow"]  = False
    else:
        same = STATE["cur_action"] == action
        STATE["cur_action"] = None if same else action
        if STATE["cur_action"]:
            STATE["stats"]["actions"] += 1
            _add_log("action", msgs.get(action,""))
            if action in ("freeze","lock"):
                STATE["is_frozen"] = True
            if action == "shadow":
                STATE["is_shadow"] = True
            if action == "warn-all":
                for m in STATE["messages"]:
                    if m["label"] != "normal" and not m["decided"]:
                        m["decided"] = "warned"
                        STATE["user_stats"][m["user"]]["warned"] += 1
    return jsonify({"ok": True, "cur_action": STATE["cur_action"],
                    "is_frozen": STATE["is_frozen"], "is_shadow": STATE["is_shadow"],
                    "stats": STATE["stats"]})

@app.route("/api/notifications/read", methods=["POST"])
def mark_read():
    for n in STATE["notifications"]: n["read"] = True
    return jsonify({"ok": True})

@app.route("/api/upload/csv", methods=["POST"])
def upload_csv():
    if "file" not in request.files: return jsonify({"error":"no file"}), 400
    f = request.files["file"]
    stream  = io.StringIO(f.stream.read().decode("utf-8", errors="ignore"))
    reader  = csv.DictReader(stream)
    rows    = list(reader)
    text_col = next((c for c in (reader.fieldnames or [])
                     if c.lower() in ("text","tweet","comment","content")), None)
    if not text_col and rows: text_col = list(rows[0].keys())[0]
    texts = [r.get(text_col,"") for r in rows[:200] if r.get(text_col,"").strip()]
    if not texts: return jsonify({"error":"no text column"}), 400
    results = predict(texts)
    out = []
    for text, row, (lbl_raw, conf, scores) in zip(texts, rows, results):
        user  = row.get("user", row.get("username","csv_user"))
        ts    = row.get("timestamp", row.get("ts", _now()))
        label = _label_ui(lbl_raw)
        cid   = f"csv_{int(time.time()*1000)}_{len(out)}"
        msg   = {"id":cid,"user":user,"text":text,"label":label,"score":round(conf,4),
                 "scores":scores,"ts":ts,"decided":None}
        STATE["messages"].append(msg)
        STATE["trend_hist"].append(label)
        if len(STATE["trend_hist"]) > 20: STATE["trend_hist"].pop(0)
        STATE["stats"]["total"] += 1
        if label == "hate":   STATE["stats"]["hate"] += 1
        elif label == "offensive": STATE["stats"]["off"] += 1
        else: STATE["stats"]["normal"] += 1
        if label != "normal": STATE["burst_buf"].append(time.time())
        out.append(msg)
    _check_escalation()
    return jsonify({"processed": len(out), "results": out})

@app.route("/api/export/csv")
def export_csv():
    si = io.StringIO()
    w  = csv.writer(si)
    w.writerow(["id","user","text","label","score","decided","timestamp"])
    for m in STATE["messages"]:
        w.writerow([m["id"],m["user"],'"'+m["text"]+'"',m["label"],
                    m["score"],m.get("decided",""),m["ts"]])
    out = io.BytesIO(si.getvalue().encode("utf-8-sig"))
    out.seek(0)
    fname = f"hateguard_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return send_file(out, mimetype="text/csv", as_attachment=True, download_name=fname)

@app.route("/api/reset", methods=["POST"])
def reset():
    STATE["messages"].clear()
    STATE["notifications"].clear()
    STATE["action_log"].clear()
    STATE["trend_hist"].clear()
    STATE["user_stats"].clear()
    STATE["burst_buf"].clear()
    STATE["stats"].update({k:0 for k in STATE["stats"]})
    STATE["cur_action"] = None
    STATE["is_frozen"]  = False
    STATE["is_shadow"]  = False
    STATE["esc_active"] = False
    STATE["esc_count"]  = 0
    return jsonify({"ok": True})

@app.route("/api/model/info")
def model_info():
    if bundle:
        return jsonify({"loaded":True,"theta":bundle.get("theta",0.23),
                        "description":bundle.get("description","Lexicon+TF-IDF LinearSVC")})
    return jsonify({"loaded":False,"description":"Rule-based fallback"})

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
