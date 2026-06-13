# Dossier model/

Placer ici le fichier `hate_speech_model.pkl` exporté depuis le notebook `02_preprocessing_Modelisation.ipynb`.

Sans ce fichier, l'application utilise un classifieur basé sur des règles lexicales (mots-clés haineux/offensifs).

## Format attendu du bundle pickle

```python
bundle = {
    "calibrated_model":   CalibratedClassifierCV,
    "word_vectorizer":    TfidfVectorizer,
    "char_vectorizer":    TfidfVectorizer,
    "lexicon_scaler":     StandardScaler,
    "lexicons": {
        "offensive_lexicon":    set,
        "hate_target_lexicon":  set,
        "race_lexicon":         set,
        "gender_lexicon":       set,
        "religion_lexicon":     set,
        "nationality_lexicon":  set,
    },
    "label_map":   {0:"hate_speech", 1:"offensive", 2:"neither"},
    "theta":       0.23,
    "description": "Lexicon+TF-IDF+Char LinearSVC calibré — Davidson et al.",
    "target_names": ["hate_speech","offensive","neither"],
}
```
