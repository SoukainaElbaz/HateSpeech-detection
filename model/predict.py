import pickle
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

def extract_lexicon_features(cleaned: str, lexicons: dict) -> np.ndarray:
    tokens = set(cleaned.split())
    feats = [
        len(tokens & lexicons["offensive_lexicon"]),        # offensive_count
        len(tokens & lexicons["hate_target_lexicon"]),      # hate_target_count
        len(tokens & lexicons["race_lexicon"]),             # race_word_count
        len(tokens & lexicons["gender_lexicon"]),           # gender_word_count
        len(tokens & lexicons["religion_lexicon"]),         # religion_word_count
        len(tokens & lexicons["nationality_lexicon"]),      # nationality_word_count
        int(bool(tokens & lexicons["offensive_lexicon"])),  # contains_offensive_word
        int(bool(tokens & lexicons["hate_target_lexicon"])),# contains_hate_target_word
    ]
    return np.array(feats, dtype=float).reshape(1, -1)

def _load():
    global _artifacts
    if _artifacts is None:
        pkl_path = os.path.join(BASE_DIR, "model", "hate_speech_model.pkl")
        print("Loading model from:", pkl_path)
        print("Exists?", os.path.exists(pkl_path))
        with open(pkl_path, "rb") as f:
            _artifacts = pickle.load(f)
        print("Model loaded ✔")
    return _artifacts

def predict(text: str):
    a = _load()
    print("LEX FEATURE NAMES:", a["feature_names"])
    cleaned = clean_tweet(text)

    # 1. TF-IDF features (word + char)
    Xw = a["word_vectorizer"].transform([cleaned])
    Xc = a["char_vectorizer"].transform([cleaned])

    # 2. Lexicon features (scalées comme à l'entraînement)
    Xlex_raw = extract_lexicon_features(cleaned, a["lexicons"])
    Xlex     = a["lexicon_scaler"].transform(Xlex_raw)

    # 3. Concaténation dans le même ordre qu'à l'entraînement
    X = sp.hstack([Xw, Xc, sp.csr_matrix(Xlex)]).tocsr()

    proba = a["calibrated_model"].predict_proba(X)[0]
    th    = a["theta"]
    idx   = 0 if proba[0] >= th else int(np.argmax(proba[1:])) + 1
    label = a["label_map"][idx]
    return label, round(float(proba[idx]), 2)