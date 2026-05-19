import pickle
import numpy as np
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer

# Optionnel : décommenter si sentence-transformers est installé
# from sentence_transformers import SentenceTransformer



BASE_DIR = Path(__file__).resolve().parents[2]
MODELS_DIR = BASE_DIR / "models" / "saved"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# =========================
# TF-IDF
# =========================

_tfidf_vectorizer = None  # instance globale (lazy init)


def get_tfidf_vectors(texts, fit: bool = False, max_features: int = 10000):
    """
    Transforme une liste de textes en matrice TF-IDF sparse.

    Args:
        texts      : liste de textes préprocessés
        fit        : True pour fit + transform (entraînement), False pour transform seul
        max_features : nombre max de features

    Returns:
        matrice sparse (n_samples, max_features)
    """
    global _tfidf_vectorizer

    if fit:
        _tfidf_vectorizer = TfidfVectorizer(
            max_features=max_features,
            ngram_range=(1, 2),
            sublinear_tf=True,
        )
        return _tfidf_vectorizer.fit_transform(texts)

    if _tfidf_vectorizer is None:
        raise ValueError("TF-IDF vectorizer non initialisé. Appelez get_tfidf_vectors(..., fit=True) d'abord.")

    return _tfidf_vectorizer.transform(texts)


# =========================
# BERT / Sentence-Transformers
# =========================

_bert_model = None  # lazy init


def get_bert_embeddings(texts, model_name: str = "all-MiniLM-L6-v2", batch_size: int = 32):
    """
    Encode une liste de textes en vecteurs denses via Sentence-Transformers.

    Args:
        texts      : liste de textes
        model_name : nom du modèle HuggingFace (ex: 'all-MiniLM-L6-v2', 'GroNLP/hateBERT')
        batch_size : taille des batchs

    Returns:
        np.ndarray de shape (n_samples, embedding_dim)
    """
    global _bert_model

    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        raise ImportError("Installe sentence-transformers : pip install sentence-transformers")

    if _bert_model is None or _bert_model._model_card_vars.get("name") != model_name:
        print(f"Chargement du modèle : {model_name} ...")
        _bert_model = SentenceTransformer(model_name)

    embeddings = _bert_model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=True,
        convert_to_numpy=True,
    )
    return embeddings


# =========================
# SAVE / LOAD
# =========================

def save_vectorizer(name: str = "tfidf_vectorizer.pkl"):
    """Sauvegarde le TF-IDF vectorizer dans models/saved/."""
    if _tfidf_vectorizer is None:
        raise ValueError("Aucun vectorizer à sauvegarder.")
    path = MODELS_DIR / name
    with open(path, "wb") as f:
        pickle.dump(_tfidf_vectorizer, f)
    print(f"Vectorizer sauvegardé : {path}")


def load_vectorizer(name: str = "tfidf_vectorizer.pkl"):
    """Charge un TF-IDF vectorizer depuis models/saved/."""
    global _tfidf_vectorizer
    path = MODELS_DIR / name
    with open(path, "rb") as f:
        _tfidf_vectorizer = pickle.load(f)
    print(f"Vectorizer chargé : {path}")
    return _tfidf_vectorizer
