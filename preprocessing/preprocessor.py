import re
import emoji
import pandas as pd
import nltk

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS
from nltk.stem import WordNetLemmatizer

# Download NLTK resources (une seule fois)
nltk.download('wordnet', quiet=True)
nltk.download('omw-1.4', quiet=True)

# =========================
# CODES TOXIQUES PRÉSERVÉS
# =========================

hate_codes_strong    = {"1488", "88", "14", "18", "28"}
hate_codes_medium    = {"311", "33", "333"}
toxic_codes          = {"1312", "13", "187"}
weak_codes           = {"666"}
extra_preserved      = {"69", "911", "12", "12.666"}

PRESERVED_NUMBER_CODES = sorted(
    hate_codes_strong | hate_codes_medium | toxic_codes | weak_codes | extra_preserved,
    key=len,
    reverse=True,
)
PRESERVED_NUMBER_CODES_SET = set(PRESERVED_NUMBER_CODES)

_PH_PREFIX = "__PRES_NUM_"

# =========================
# REGEX PRÉCOMPILÉES
# =========================

_RE_MENTION  = re.compile(r"@\w+")
_RE_RT       = re.compile(r"\brt\b")
_RE_NUMBERS  = re.compile(r"\b\d+(?:\.\d+)?\b")
_RE_PUNCT    = re.compile(r"[^\w\s\.]")
_RE_SPACES   = re.compile(r"\s+")

_PRESERVED_PATTERNS = [
    (re.compile(r"\b" + re.escape(code) + r"\b"), f" {_PH_PREFIX}{i}__ ")
    for i, code in enumerate(PRESERVED_NUMBER_CODES)
]

# =========================
# FONCTIONS INTERNES
# =========================

def _protect_preserved_number_codes(text: str) -> str:
    for pattern, placeholder in _PRESERVED_PATTERNS:
        text = pattern.sub(placeholder, text)
    return text


def _restore_preserved_number_codes(text: str) -> str:
    for i, code in enumerate(PRESERVED_NUMBER_CODES):
        text = text.replace(f" {_PH_PREFIX}{i}__ ", f" {code} ")
    return text


# =========================
# FONCTIONS PUBLIQUES
# =========================

def clean_text(text) -> str:
    """Nettoyage brut du texte : emojis, mentions, ponctuation, codes toxiques."""
    if not isinstance(text, str):
        text = str(text)
    if not text:
        return text

    text = emoji.demojize(text)
    text = text.lower()
    text = _RE_MENTION.sub(" ", text)
    text = _RE_RT.sub(" ", text)
    text = _protect_preserved_number_codes(text)
    text = _RE_NUMBERS.sub(" ", text)
    text = text.replace("-", " ")
    text = _RE_PUNCT.sub("", text)
    text = _restore_preserved_number_codes(text)
    text = _RE_SPACES.sub(" ", text).strip()

    return text


def tokenize_text(text: str) -> list:
    """Tokenisation simple par espaces."""
    return text.split()


stop_words = set(ENGLISH_STOP_WORDS)

def remove_stopwords(tokens: list) -> list:
    """Suppression des stopwords anglais."""
    return [w for w in tokens if w not in stop_words]


lemmatizer = WordNetLemmatizer()

def lemmatize_text(tokens: list) -> list:
    """Lemmatisation verbale."""
    return [lemmatizer.lemmatize(w, pos='v') for w in tokens]


def full_preprocess(text, lang: str = "en") -> str:
    """
    Pipeline complet : clean → tokenize → stopwords → lemmatize.

    Args:
        text : texte brut (str ou NaN)
        lang : langue du texte ('en' uniquement pour l'instant)

    Returns:
        texte préprocessé sous forme de chaîne
    """
    # Gérer None, NaN, et tout ce qui n'est pas une string
    if text is None:
        return ""
    if isinstance(text, float) and pd.isna(text):
        return ""
    if not isinstance(text, str):
        text = str(text)
    if not text.strip():
        return ""

    text   = clean_text(text)
    tokens = tokenize_text(text)
    tokens = remove_stopwords(tokens)
    tokens = lemmatize_text(tokens)

    return " ".join(tokens)
