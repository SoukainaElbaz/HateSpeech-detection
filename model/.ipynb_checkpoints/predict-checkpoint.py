import joblib
import numpy as np
import scipy.sparse as sp

_artifacts = None

def _load():
    global _artifacts
    if _artifacts is None:
        _artifacts = joblib.load("model/hate_speech_model.pkl")
    return _artifacts

def predict(text: str):
    a = _load()
    # TF-IDF features
    Xw = a["word_vec"].transform([text])
    Xc = a["char_vec"].transform([text])
    X  = sp.hstack([Xw, Xc])
    # Probabilités calibrées
    proba = a["model"].predict_proba(X)[0]
    # Appliquer le seuil hate
    th = a["threshold"]
    if proba[0] >= th:
        idx = 0
    else:
        idx = int(np.argmax(proba[1:])) + 1
    label = a["label_map"][idx]
    return label, round(float(proba[idx]), 2)