---
title: Rise On AI Sentiment API
emoji: 💚
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

Public XLM-RoBERTa inference API for Rise On AI.

- `GET /` health + model info
- `POST /predict` `{ "inputs": "journal text" }`
- `POST /predict/batch` `{ "inputs": ["text", ...] }`
