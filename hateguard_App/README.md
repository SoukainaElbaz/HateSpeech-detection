# HateGuard v4 — Plateforme de Modération

## Corrections v4

### Bug 1 — Scroll Historique Toxique ✅
- L'onglet "Historique Toxique" défilait mal (bloqué en haut).
- Fix : `.hist-wrap` passe de `display:flex` à `display:block` avec `-webkit-overflow-scrolling:touch`.
- Résultat : scroll fluide de haut en bas sur toute la page historique.

### Bug 2 — Geler/Verrouiller n'arrêtait pas le simulateur ✅
- Les messages aléatoires continuaient à arriver même après avoir gelé la discussion.
- Fix : `runSim()` vérifie `G.isFrozen` en début de fonction et retourne immédiatement.
- Résultat : dès que l'admin clique Geler ou Verrouiller, **plus aucun message** n'arrive dans le feed.

### Ajout — Bannière de gel dans le Live Feed Admin ✅
- Quand la discussion est gelée, une bannière bleue apparaît en haut du feed admin confirmant que le simulateur est stoppé.
- Bouton "Reprendre" pour dégeler la discussion.

## Installation

```bash
pip install -r requirements.txt
python app.py
# → http://127.0.0.1:5000
```

## Ajouter votre modèle

Copier `hate_speech_model.pkl` dans `model/`.

## Structure

```
hateguard_v4/
├── app.py                    # Backend Flask
├── requirements.txt
├── model/
│   └── hate_speech_model.pkl  ← votre modèle
├── templates/
│   └── index.html
├── static/
│   ├── css/style.css
│   └── js/
│       ├── dashboard.js
│       └── bg.js
├── uploads/
└── exports/
```

## API Endpoints

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/classify` | POST | Classifier un message |
| `/api/classify/batch` | POST | Classifier plusieurs textes |
| `/api/feed` | GET | Récupérer le flux |
| `/api/state` | GET | État global |
| `/api/action/warn/<id>` | POST | Avertir un message |
| `/api/action/delete/<id>` | POST | Supprimer un message |
| `/api/action/approve/<id>` | POST | Approuver |
| `/api/action/warn-user/<user>` | POST | Avertir utilisateur |
| `/api/action/ban-user/<user>` | POST | Bannir utilisateur |
| `/api/escalation/action` | POST | freeze/lock/shadow/warn-all |
| `/api/upload/csv` | POST | Importer CSV |
| `/api/export/csv` | GET | Exporter décisions |
| `/api/reset` | POST | Reset session |

## Comptes démo

| Nom | Rôle |
|-----|------|
| `admin` | Administrateur |
| `user1`, `user2`, `user3`, `user4` | Utilisateur |
