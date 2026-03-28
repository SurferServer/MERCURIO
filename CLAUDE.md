# MERCURIO — Content Management System

Sistema gestione contenuti social per un team di 4 persone. Backend FastAPI + Frontend React, deploy su Render.

## Quick Reference

- **URL produzione:** https://mercurio-jeb1.onrender.com
- **Repo:** https://github.com/SurferServer/MERCURIO.git
- **Deploy:** push su `main` → auto-deploy Render (Docker multi-stage)
- **DB:** PostgreSQL su Render (SQLite in locale)
- **Storage file:** Google Drive (OAuth2 con refresh token)

## Architettura

```
content-hub/
├── backend/app/          # FastAPI (Python 3.11)
│   ├── main.py           # Entry point, auth endpoints, SPA serving
│   ├── auth.py           # JWT, role-based access
│   ├── database.py       # SQLAlchemy (PostgreSQL/SQLite)
│   ├── models.py         # 8 tabelle + enum
│   ├── schemas.py        # Pydantic validation
│   ├── routes/           # 7 moduli API (48 endpoint totali)
│   └── services/         # Drive + thumbnail
├── frontend/src/         # React 18 + Vite + Tailwind
│   ├── App.jsx           # Router, sidebar, role-based nav
│   ├── api/client.js     # API client (tutte le chiamate)
│   ├── context/UserContext.jsx  # Auth state (in-memory, no localStorage)
│   └── components/       # 18 componenti React
├── Dockerfile            # Multi-stage: Node build → Python runtime
├── render.yaml           # Config Render
└── docker-compose.yml    # Dev locale
```

## Utenti e Ruoli

| user_id    | Ruolo        | Permessi |
|-----------|--------------|----------|
| fulvio    | admin        | CRUD completo, delete, popup, export, import CSV, stats |
| federico  | collaborator | Crea/modifica contenuti, commenti, transizioni status limitate |
| marzia    | collaborator | Come Federico |
| marketing | marketing    | Solo lettura su completati/archiviati, notifiche, calendario |

Password da env vars: `MERCURIO_PASS_{USER_ID_UPPER}`

## Auth

- JWT (HS256), secret in `MERCURIO_JWT_SECRET`, expire 24h
- Token in-memory nel frontend (si perde al refresh — by design)
- 401 → evento `mercurio:unauthorized` → logout automatico
- Rate limit: 5 login/min

## Dettagli per lo sviluppo

Per i dettagli completi su API, database, componenti e deploy, vedi `.claude/context/`:
- `backend.md` — modelli, endpoint, servizi
- `frontend.md` — componenti, routing, API client
- `deploy.md` — Docker, Render, env vars
