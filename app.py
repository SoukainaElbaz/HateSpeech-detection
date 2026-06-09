from flask import Flask, render_template, request, jsonify, Response
import json
import time
import random
import threading
from collections import defaultdict
from datetime import datetime
import queue

app = Flask(__name__)

# ─── In-memory state ────────────────────────────────────────────────
comments_feed = []
user_violations = defaultdict(lambda: {"count": 0, "hate": 0, "blocked": False, "banned": False})
stats = {"total": 0, "hate": 0, "offensive": 0, "normal": 0, "deleted": 0, "blocked_users": 0, "banned_users": 0}
sse_clients = []
lock = threading.Lock()

# ─── Mapping label → clé stats ──────────────────────────────────────
STAT_KEY = {"hate_speech": "hate", "offensive": "offensive", "neither": "normal"}

# ─── Sample tweets for simulation ───────────────────────────────────
SAMPLE_TWEETS = [
    ("alice", "I love this community! Everyone here is so kind and helpful 😊"),
    ("bob", "This is a great discussion, thanks for sharing!"),
    ("carol", "Totally disagree with your opinion but I respect your view"),
    ("dave", "You're so freaking stupid, nobody asked for your opinion"),
    ("eve", "What a fantastic idea, let's build something together"),
    ("frank", "I hate people like you, you should not exist"),
    ("grace", "Can we please keep this civil? Thanks everyone"),
    ("heidi", "This content is absolute garbage, you idiot"),
    ("ivan", "Interesting perspective, I hadn't thought of it that way"),
    ("judy", "Go back to where you came from, nobody wants you here"),
    ("kara", "Just finished reading that article, very insightful"),
    ("leo", "You're a complete moron, shut up already"),
    ("mia", "Looking forward to seeing everyone at the event!"),
    ("ned", "These people are disgusting animals"),
    ("olivia", "Great post! Very informative and well-researched"),
    ("pete", "You're worthless and pathetic, get lost"),
    ("quinn", "Has anyone tried the new feature? It's amazing!"),
    ("rosa", "I disagree, but your point is valid"),
    ("sam", "Kill all those freaks, society is better without them"),
    ("tina", "Just sharing some thoughts, hope it helps someone"),
]

# ─── Classify ────────────────────────────────────────────────────────
def classify_comment(text: str):
    from model.predict import predict
    return predict(text)

# ─── Decision engine ─────────────────────────────────────────────────
def make_decision(user_id: str, label: str):
    v = user_violations[user_id]

    if v["banned"]:
        return "ban", "User is permanently banned"

    if label == "hate_speech":                          # ✅ corrigé
        v["hate"] += 1
        v["count"] += 1
        if v["hate"] >= 2:
            v["banned"] = True
            stats["banned_users"] += 1
            return "ban", "2+ hate messages → permanent ban"
        return "delete", "Hate speech detected → comment removed"

    elif label == "offensive":
        v["count"] += 1
        if v["blocked"]:
            v["banned"] = True
            stats["banned_users"] += 1
            return "ban", "Repeated offenses after block → permanent ban"
        if v["count"] >= 3:
            v["blocked"] = True
            stats["blocked_users"] += 1
            return "block", "3+ violations → user temporarily blocked"
        return "warn", f"Offensive content → warning ({v['count']}/3)"

    return "publish", "Comment approved"                # neither

# ─── SSE broadcast ───────────────────────────────────────────────────
def broadcast(event_data: dict):
    payload = f"data: {json.dumps(event_data)}\n\n"
    dead = []
    with lock:
        for q in sse_clients:
            try:
                q.put_nowait(payload)
            except Exception:
                dead.append(q)
        for q in dead:
            sse_clients.remove(q)

# ─── Routes ──────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/post", methods=["POST"])
def post_comment():
    data = request.get_json()
    user_id  = data.get("user", "anonymous").strip() or "anonymous"
    text     = data.get("text", "").strip()

    if not text:
        return jsonify({"error": "Empty comment"}), 400

    label, confidence = classify_comment(text)
    action, reason    = make_decision(user_id, label)

    stats["total"] += 1
    stats[STAT_KEY.get(label, "normal")] += 1           # ✅ corrigé
    if action in ("delete", "ban"):
        stats["deleted"] += 1

    comment = {
        "id":         int(time.time() * 1000),
        "user":       user_id,
        "text":       text,
        "label":      label,
        "confidence": confidence,
        "action":     action,
        "reason":     reason,
        "timestamp":  datetime.now().strftime("%H:%M:%S"),
        "violations": user_violations[user_id]["count"],
    }
    comments_feed.append(comment)
    broadcast({"type": "comment", "data": comment, "stats": dict(stats)})
    return jsonify(comment)

@app.route("/simulate", methods=["POST"])
def simulate():
    user_id, text = random.choice(SAMPLE_TWEETS)
    user_id = user_id + str(random.randint(1, 99))

    label, confidence = classify_comment(text)
    action, reason    = make_decision(user_id, label)

    stats["total"] += 1
    stats[STAT_KEY.get(label, "normal")] += 1           # ✅ corrigé
    if action in ("delete", "ban"):
        stats["deleted"] += 1

    comment = {
        "id":         int(time.time() * 1000),
        "user":       user_id,
        "text":       text,
        "label":      label,
        "confidence": confidence,
        "action":     action,
        "reason":     reason,
        "timestamp":  datetime.now().strftime("%H:%M:%S"),
        "violations": user_violations[user_id]["count"],
    }
    comments_feed.append(comment)
    broadcast({"type": "comment", "data": comment, "stats": dict(stats)})
    return jsonify(comment)

@app.route("/reset", methods=["POST"])
def reset():
    comments_feed.clear()
    user_violations.clear()
    for k in stats:
        stats[k] = 0
    broadcast({"type": "reset"})
    return jsonify({"ok": True})

@app.route("/stream")
def stream():
    q = queue.Queue(maxsize=50)
    with lock:
        sse_clients.append(q)
    def generate():
        yield f"data: {json.dumps({'type': 'connected'})}\n\n"
        while True:
            try:
                msg = q.get(timeout=20)
                yield msg
            except queue.Empty:
                yield ": ping\n\n"
    return Response(generate(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.route("/stats")
def get_stats():
    return jsonify(dict(stats))

if __name__ == "__main__":
    app.run(debug=True, threaded=True)
