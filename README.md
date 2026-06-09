# HateGuard — Live Comment Moderation

Flask app simulating real-time hate speech moderation.

## Quick start

```bash
pip install -r requirements.txt
python app.py
# → http://localhost:5000
```

## Plug in your real model

Edit `model/predict.py` — uncomment the joblib section and point `MODEL_PATH`
to your saved sklearn pipeline (LinearSVC + TF-IDF). The function signature is:

```python
def predict(text: str) -> tuple[str, float]:
    # returns (label, confidence)
    # label ∈ {"hate", "offensive", "normal"}
```

## Decision rules

| Label      | Occurrences | Action          |
|------------|-------------|-----------------|
| normal     | any         | ✅ Publish       |
| offensive  | 1st–2nd     | ⚠️ Warn          |
| offensive  | 3rd+        | 🔒 Block user    |
| hate       | 1st         | 🗑️ Delete        |
| hate       | 2nd+        | 🔨 Ban user      |

## Project structure

```
hate_speech_app/
├── app.py              ← Flask routes + decision engine
├── model/
│   └── predict.py      ← model integration stub
├── templates/
│   └── index.html      ← single-page UI
└── requirements.txt
```
