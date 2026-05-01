import re
import emoji
import pandas as pd
import nltk

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS
from nltk.stem import WordNetLemmatizer

# Fix SSL (important chez toi)
import ssl
ssl._create_default_https_context = ssl._create_unverified_context

# Download (une seule fois)
nltk.download('wordnet', quiet=True)
nltk.download('omw-1.4', quiet=True)

# =========================
# CODES TOXIQUES
# =========================

hate_codes_strong = {"1488", "88", "14", "18", "28"}
hate_codes_medium = {"311", "33", "333"}
toxic_codes = {"1312", "13", "187"}
weak_codes = {"666"}
extra_preserved_codes = {"69", "911", "12", "12.666"}

PRESERVED_NUMBER_CODES = sorted(
    hate_codes_strong
    | hate_codes_medium
    | toxic_codes
    | weak_codes
    | extra_preserved_codes,
    key=len,
    reverse=True,
)

_PH_PREFIX = "__PRES_NUM_"
PRESERVED_NUMBER_CODES_SET = set(PRESERVED_NUMBER_CODES)

# =========================
# CLEANING FUNCTIONS
# =========================

def _protect_preserved_number_codes(text):
    for i, code in enumerate(PRESERVED_NUMBER_CODES):
        ph = f" {_PH_PREFIX}{i}__ "
        pat = r"\b" + re.escape(code) + r"\b"
        text = re.sub(pat, ph, text)
    return text


def _restore_preserved_number_codes(text):
    for i, code in enumerate(PRESERVED_NUMBER_CODES):
        ph = f" {_PH_PREFIX}{i}__ "
        text = text.replace(ph, f" {code} ")
    return text


def _strip_standalone_numbers(text):
    return re.sub(r"\b\d+(?:\.\d+)?\b", " ", text)


def process_token(token):
    if re.fullmatch(r"\d+(?:\.\d+)?", token):
        if token in PRESERVED_NUMBER_CODES_SET:
            return token
        return ""
    return token


def clean_text(text):
    if not isinstance(text, str):
        text = str(text)

    if not text:
        return text

    text = emoji.demojize(text)
    text = text.lower()

    text = re.sub(r"@\w+", " ", text)
    text = re.sub(r"\brt\b", " ", text)

    text = _protect_preserved_number_codes(text)
    text = _strip_standalone_numbers(text)

    text = text.replace("-", " ")
    text = re.sub(r"[^\w\s\.]", "", text)

    text = _restore_preserved_number_codes(text)

    tokens = text.split()
    tokens = [process_token(t) for t in tokens if t]

    text = " ".join(tokens)
    text = re.sub(r"\s+", " ", text).strip()

    return text


def tokenize_text(text):
    return text.split()


# =========================
# STOPWORDS
# =========================

stop_words = set(ENGLISH_STOP_WORDS)

def remove_stopwords(tokens):
    return [w for w in tokens if w not in stop_words]


# =========================
# LEMMATIZATION
# =========================

lemmatizer = WordNetLemmatizer()

def lemmatize_text(tokens):
    return [lemmatizer.lemmatize(w, pos='v') for w in tokens]


# =========================
# MAIN FUNCTION
# =========================

def full_preprocess(text):
    if pd.isna(text):
        return ""

    text = clean_text(text)
    tokens = tokenize_text(text)
    tokens = remove_stopwords(tokens)
    tokens = lemmatize_text(tokens)

    return " ".join(tokens)