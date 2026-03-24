# Content Hub — Guida Setup

Sistema di gestione contenuti social per Guida e Vai, Quiz Patente, Rinnovala.

---

## Avvio rapido (sviluppo locale)

### Prerequisiti
- Python 3.11+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # su Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Il backend parte su http://localhost:8000.
Le API sono documentate automaticamente su http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Il frontend parte su http://localhost:5173 e fa proxy delle API al backend.

---

## Deploy con Docker (produzione)

```bash
docker compose up -d --build
```

L'app sarà disponibile su http://localhost (porta 80).

---

## Deploy su Railway (cloud)

1. Crea un account su [railway.app](https://railway.app)
2. Crea un nuovo progetto dal tuo repo GitHub
3. Railway rileva automaticamente il Dockerfile del backend
4. Aggiungi un servizio per il frontend
5. Imposta le variabili d'ambiente nel pannello Railway:
   - `DATABASE_URL`: usa il database PostgreSQL di Railway
   - `CORS_ORIGINS`: l'URL del tuo frontend
   - `UPLOAD_DIR`: `/app/uploads`

In alternativa, puoi usare [Render](https://render.com) con lo stesso approccio.

---

## Google Drive (opzionale)

Per sincronizzare automaticamente i file su Drive:

1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un progetto (o usa uno esistente)
3. Abilita **Google Drive API**
4. Vai su **Credenziali** → **Crea credenziali** → **Account di servizio**
5. Scarica il file JSON della chiave
6. Sul tuo Google Drive, condividi la cartella di destinazione con l'email del service account
7. Imposta le variabili d'ambiente:
   ```
   GOOGLE_DRIVE_CREDENTIALS_PATH=./credentials/drive-key.json
   GOOGLE_DRIVE_ROOT_FOLDER_ID=<id della cartella root su Drive>
   ```

La struttura creata su Drive sarà:
```
Root/
├── Guida e Vai/
│   ├── Video/
│   │   ├── Organico/
│   │   └── ADV/
│   └── Grafiche/
│       ├── Organico/
│       └── ADV/
├── Quiz Patente/
│   └── ...
└── Rinnovala/
    └── ...
```

---

## Struttura progetto

```
content-hub/
├── backend/
│   ├── app/
│   │   ├── main.py              # Entry point FastAPI
│   │   ├── database.py          # Connessione DB
│   │   ├── models.py            # Modelli SQLAlchemy
│   │   ├── schemas.py           # Schemi Pydantic (validazione)
│   │   ├── routes/
│   │   │   ├── contents.py      # API CRUD contenuti + export Excel
│   │   │   └── files.py         # Upload/download file
│   │   └── services/
│   │       └── drive_service.py # Integrazione Google Drive
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Layout principale + routing
│   │   ├── api/
│   │   │   ├── client.js        # Client HTTP per le API
│   │   │   └── constants.js     # Brand, tipi, canali, stati
│   │   └── components/
│   │       ├── Dashboard.jsx    # Panoramica con stats e carico lavoro
│   │       ├── CreateContent.jsx # Form creazione contenuto
│   │       ├── Board.jsx        # Kanban board 4 colonne
│   │       ├── ArchivePage.jsx  # Archivio con tabella + griglia + export Excel
│   │       ├── ContentDetail.jsx # Dettaglio singolo contenuto + upload file
│   │       ├── Tag.jsx          # Componente tag/badge
│   │       └── Toast.jsx        # Notifiche
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## API principali

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | /api/contents/ | Lista contenuti (con filtri) |
| POST | /api/contents/ | Crea contenuto |
| PATCH | /api/contents/:id | Aggiorna contenuto |
| DELETE | /api/contents/:id | Elimina contenuto |
| GET | /api/contents/stats | Statistiche dashboard |
| GET | /api/contents/archive-summary | Riepilogo archivio per brand |
| GET | /api/contents/export/excel | Export Excel archivio |
| POST | /api/files/:id/upload | Upload file per un contenuto |
| GET | /api/files/:id/download | Download file allegato |
