import joblib
import numpy as np
import scipy.sparse as sp
import os
import re
from nltk.corpus import stopwords

STOP = set(stopwords.words("english"))

_artifacts = None
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def clean_tweet(text):
    text = str(text).lower()
    text = re.sub(r"http\S+|www\.\S+",  " ", text)
    text = re.sub(r"@\w+",              " ", text)
    text = re.sub(r"&[a-z]+;|&#\d+;",  " ", text)
    text = re.sub(r"\brt\b",            " ", text)
    text = re.sub(r"[^a-z\s]",         " ", text)
    tokens = [w for w in text.split() if w not in STOP and len(w) > 1]
    return " ".join(tokens)

def _load():
    global _artifacts
    if _artifacts is None:
        pkl_path = os.path.join(BASE_DIR, "model", "hate_speech_model.pkl")
        print("Cherche le modèle ici :", pkl_path)        # ← ajoute ça
        print("Existe ?", os.path.exists(pkl_path))
        _artifacts = joblib.load(pkl_path)
        # ajoute temporairement dans _load() après joblib.load
    print("label_map chargé :", _artifacts["label_map"])
    print("threshold :", _artifacts["threshold"])
        
    return _artifacts

def predict(text: str):
    a       = _load()
    cleaned = clean_tweet(text)          # ✅ nettoyage obligatoire
    Xw      = a["word_vec"].transform([cleaned])
    Xc      = a["char_vec"].transform([cleaned])
    X       = sp.hstack([Xw, Xc]).tocsr()
    proba   = a["model"].predict_proba(X)[0]
    th      = a["threshold"]
    idx     = 0 if proba[0] >= th else int(np.argmax(proba[1:])) + 1
    label   = a["label_map"][idx]
    return label, round(float(proba[idx]), 2)