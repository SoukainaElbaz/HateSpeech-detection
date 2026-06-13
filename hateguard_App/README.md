# HateGuard v5 — Moderation Platform

## Overview

HateGuard v5 is a web-based content moderation platform designed to detect and manage toxic, offensive, and hateful messages in online discussions. It provides real-time analysis, moderation tools, user management, and administrative monitoring through an intuitive dashboard.

## Features

### User Side

* Submit messages for analysis.
* Real-time toxicity detection.
* Classification into:

  * Hate Speech
  * Offensive Content
  * Normal Content
* Instant feedback on submitted messages.

### Administrator Dashboard

* Live Feed monitoring.
* Toxic Message History.
* Message moderation actions:

  * Approve
  * Warn
  * Delete
* User moderation actions:

  * Warn User
  * Ban User
* Discussion control:

  * Freeze Discussion
  * Lock Discussion
  * Resume Discussion
* Real-time platform statistics.

### Data Management

* Session reset functionality.
* Historical tracking of moderation actions.

## Installation

```bash
pip install -r requirements.txt
python app.py
```

Open:

```text
http://127.0.0.1:5000
```

## Model Setup

Place your trained model file inside:

```text
model/
└── hate_speech_model.pkl
```

If no model is available, HateGuard can use its built-in fallback detection system.

## Project Structure

```text
hateguard_v5/
├── app.py
├── requirements.txt
├── README.md
├── model/
│   └── hate_speech_model.pkl
├── templates/
│   └── index.html
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── dashboard.js
│       └── bg.js
├── uploads/
└── exports/
```

## Main API Endpoints

| Route                          | Method | Description                            |
| ------------------------------ | ------ | -------------------------------------- |
| `/api/classify`                | POST   | Classify a single message              |
| `/api/classify/batch`          | POST   | Classify multiple messages             |
| `/api/feed`                    | GET    | Retrieve live feed                     |
| `/api/state`                   | GET    | Get platform state                     |
| `/api/action/warn/<id>`        | POST   | Warn a message                         |
| `/api/action/delete/<id>`      | POST   | Delete a message                       |
| `/api/action/approve/<id>`     | POST   | Approve a message                      |
| `/api/action/warn-user/<user>` | POST   | Warn a user                            |
| `/api/action/ban-user/<user>`  | POST   | Ban a user                             |
| `/api/escalation/action`       | POST   | Freeze, lock, shadow or global actions |
| `/api/upload/csv`              | POST   | Import CSV data                        |
| `/api/export/csv`              | GET    | Export moderation records              |
| `/api/reset`                   | POST   | Reset session data                     |

## Demo Accounts

| Username | Role          |
| -------- | ------------- |
| admin    | Administrator |
| user1    | User          |


## Educational Purpose

This project was developed as part of an academic project in Artificial Intelligence and Data Engineering. It demonstrates the application of machine learning techniques to content moderation and online safety.
