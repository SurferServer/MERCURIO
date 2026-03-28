# Deploy & Infrastruttura

## Render

- **Servizio:** Web Service (Docker)
- **URL:** https://mercurio-jeb1.onrender.com
- **Dashboard:** https://dashboard.render.com/web/srv-d716bhh5pdvs73fpv020
- **DB:** PostgreSQL (managed, free tier)
- **Disco:** 1GB persistente montato su `/app/uploads`
- **Deploy:** auto su push a `main` (GitHub: SurferServer/MERCURIO)

## Dockerfile (Multi-stage)

### Stage 1: Build frontend
```dockerfile
FROM node:20-alpine
WORKDIR /frontend
COPY frontend/package*.json .
RUN npm install
COPY frontend/ .
RUN npm run build        # → /frontend/dist
```

### Stage 2: Runtime Python
```dockerfile
FROM python:3.11-slim
RUN apt-get install ffmpeg   # per thumbnail video
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ /app/
COPY --from=build /frontend/dist /app/frontend/dist
WORKDIR /app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Come vengono serviti insieme
1. Vite builda il frontend → `/frontend/dist` (HTML + JS + CSS)
2. Dockerfile copia dist dentro `/app/frontend/dist`
3. FastAPI monta assets: `app.mount("/assets", StaticFiles(dir=dist/assets))`
4. Catch-all route: `@app.get("/{path:path}")` → restituisce `index.html` per tutte le rotte non-API
5. Un solo servizio, un solo dominio, zero problemi CORS in produzione

## Variabili d'Ambiente (Render)

### Database
```
DATABASE_URL=<auto-injected da Render>
```

### Auth
```
MERCURIO_JWT_SECRET=<random 64-char hex>
MERCURIO_JWT_EXPIRE_HOURS=24
MERCURIO_PASS_FULVIO=****
MERCURIO_PASS_FEDERICO=****
MERCURIO_PASS_MARZIA=****
MERCURIO_PASS_MARKETING=****
```

### File & Upload
```
UPLOAD_DIR=/app/uploads
MERCURIO_MAX_UPLOAD_MB=50
```

### Google Drive (OAuth2)
```
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REFRESH_TOKEN=...
GOOGLE_DRIVE_FOLDER_ID=...
```

### Altro
```
CORS_ORIGINS=https://mercurio-jeb1.onrender.com
MERCURIO_ENV=production
```

## Sviluppo Locale

### Con Docker Compose
```bash
docker-compose up
# Backend: http://localhost:8000
# Frontend: http://localhost:80 (Nginx proxy)
```

### Senza Docker
```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev
# Vite dev server su :5173 con proxy /api → :8000
```

## Workflow di Deploy

1. Modifica codice
2. `git add` + `git commit`
3. `git push origin main`
4. Render rileva il push → build Docker → deploy automatico
5. Build ~3-5 minuti (Node build + Python deps)
6. Zero downtime (Render gestisce il rollover)

## Troubleshooting Comune

### Pagina bianca dopo deploy
- Probabile errore JS che crasha React. Aprire console browser → cercare errore.
- Possibile cache vecchia: hard refresh (Cmd+Shift+R) o svuotare cache.

### CSS non caricato / layout rotto
- Build frontend potrebbe aver generato nuovo hash per i file.
- Hard refresh per forzare ricaricamento degli asset.

### Login fallito
- Verificare env var `MERCURIO_PASS_{USER}` su Render → Environment.
- Shell Render: `echo ${#MERCURIO_PASS_USER}` per controllare lunghezza.

### File upload fallito
- Verificare che Google Drive sia configurato: GET /api/files/drive-status
- Controllare che il refresh token non sia scaduto.
- Limite: MERCURIO_MAX_UPLOAD_MB (default 50).

### DB migration
- Migrazioni auto all'avvio in main.py.
- Se nuova colonna: aggiungere in models.py + migration in main.py startup.
- Per enum PostgreSQL: ALTER TYPE ... ADD VALUE IF NOT EXISTS.
