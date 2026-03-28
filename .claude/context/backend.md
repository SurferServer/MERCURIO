# Backend — FastAPI

## Stack
- FastAPI 0.109+ / Uvicorn
- SQLAlchemy ORM (PostgreSQL prod, SQLite dev)
- PyJWT per auth
- google-api-python-client per Google Drive
- Pillow (immagini) + FFmpeg (video thumbnails)
- openpyxl per export Excel
- SlowAPI per rate limiting

## Database: 8 Tabelle

### Enums
```python
BrandEnum: guida-e-vai, quiz-patente, rinnovala
ContentTypeEnum: video, grafica, sviluppo
ChannelEnum: organico, adv, cartaceo
SourceEnum: interno, marketing
StatusEnum: da-assegnare, in-lavorazione, in-revisione, completato, archiviato
AssigneeEnum: fulvio, federico, marzia, fulvio-federico, fulvio-marzia, federico-marzia
BriefTypeEnum: script, brief
DevTaskStatusEnum: in-corso, completato
```

### Content (tabella principale)
```
id, title, brand, content_type, channel, source, assigned_to, status,
script, notes, deadline, file_name, file_path (legacy),
thumbnail_path, drive_link, drive_file_id, drive_folder_id,
script_brief_id (FK → ScriptBrief),
created_at, updated_at, completed_at, archived_at
```

### ScriptBrief
```
id, title, brief_type, brand, content (testo), notes, assigned_to, is_used, created_at, updated_at
```

### ContentFile (versioning file su Drive)
```
id, content_id (FK), file_name, drive_file_id, drive_link, mime_type, size_bytes, uploaded_at
```

### Comment
```
id, content_id, author, text, created_at
```

### Activity (audit log)
```
id, content_id, action (text), created_at
```

### DailyPopup (messaggi admin → collaboratori)
```
id, target_user, target_date, message, tasks_today_json, tasks_week_json, read_at, created_at, updated_at
```

### MarketingNotification
```
id, content_id (FK unique), read_at, created_at
```

### DevTask (task sviluppo Federico)
```
id, title, description, estimated_hours, status, created_at, completed_at
```

## API Endpoints (48 totali)

### Auth — `main.py`
```
POST /api/auth/login          — Login con user_id + password, ritorna JWT
GET  /api/auth/me             — User corrente dal token
POST /api/auth/avatar         — Upload avatar (resize 400x400 JPEG)
DELETE /api/auth/avatar        — Rimuovi avatar
GET  /avatars/{filename}       — Serve avatar (protezione path traversal)
```

### Contents — `routes/contents.py`
```
GET    /api/contents/              — Lista con filtri (status, brand, type, channel, source, assignee, search, month)
GET    /api/contents/{id}          — Dettaglio
POST   /api/contents/              — Crea (admin + collaboratori)
PATCH  /api/contents/{id}          — Modifica (restrizioni per ruolo)
DELETE /api/contents/{id}          — Elimina (solo admin dopo completamento)
GET    /api/contents/stats         — Stats dashboard
GET    /api/contents/archive-summary — Aggregati archivio per brand/type/channel
GET    /api/contents/export/excel  — Download Excel con filtri
POST   /api/contents/import-csv    — Import bulk da CSV
GET    /api/contents/{id}/activities — Log attività
GET    /api/contents/{id}/comments  — Commenti
POST   /api/contents/{id}/comments  — Aggiungi commento
```

### Files — `routes/files.py`
```
POST /api/files/{id}/upload        — Upload su Drive + thumbnail
POST /api/files/{id}/upload-multi  — Multi-file upload
GET  /api/files/{id}/versions      — Lista versioni con link Drive
GET  /api/files/{id}/download      — Stream da Drive (fallback locale)
GET  /api/files/{id}/thumbnail     — Thumbnail cached o rigenerata
GET  /api/files/drive-status       — Drive configurato? (admin only)
```

### Script/Brief — `routes/script_briefs.py`
```
GET    /api/script-briefs/         — Lista con filtri
GET    /api/script-briefs/{id}     — Dettaglio
POST   /api/script-briefs/         — Crea
POST   /api/script-briefs/batch    — Batch create (max 20)
PATCH  /api/script-briefs/{id}     — Modifica
DELETE /api/script-briefs/{id}     — Elimina
```

### Dev Tasks — `routes/dev_tasks.py`
```
GET    /api/dev-tasks/             — Lista (admin + Federico)
POST   /api/dev-tasks/             — Crea (solo Federico)
PATCH  /api/dev-tasks/{id}         — Modifica (solo Federico)
DELETE /api/dev-tasks/{id}         — Elimina (solo Federico)
```

### Popups — `routes/popups.py`
```
GET    /api/popups/admin/{user}    — Lista popup per utente (admin)
POST   /api/popups/admin           — Crea/upsert popup (admin)
PATCH  /api/popups/admin/{id}      — Modifica
DELETE /api/popups/admin/{id}      — Elimina
GET    /api/popups/my-daily        — Popup giornaliero (collaboratore)
POST   /api/popups/my-daily/{id}/read — Segna come letto
```

### Notifications — `routes/notifications.py`
```
GET  /api/notifications/marketing/count      — Conteggio non lette
GET  /api/notifications/marketing            — Lista con dettagli contenuto
POST /api/notifications/marketing/read-all   — Segna tutte lette
POST /api/notifications/marketing/{id}/read  — Segna una letta
```

### Health
```
GET /api/health
```

## Google Drive Integration (`services/drive_service.py`)

- OAuth2 con refresh token (account personale Google)
- Root folder configurabile via `GOOGLE_DRIVE_FOLDER_ID`
- Gerarchia cartelle auto: `{brand}/{content_type}/{channel}/`
- Upload: stream bytes → Drive, ritorna (file_id, webViewLink, folder_id)
- Download: stream da Drive API
- Thumbnails: generati da video (ffmpeg frame 0) o immagini (Pillow), salvati localmente come JPEG 200x200

## Logica di Business Importante

### Lifecycle contenuti
da-assegnare → in-lavorazione → in-revisione → completato → archiviato

### Transizioni status per ruolo
- Admin: tutte le transizioni
- Collaboratori: limitati (non possono saltare step)
- Marketing: nessuna modifica status

### Cambio assegnazione
- Log automatico: "Riassegnato da {vecchio} a {nuovo}" con timestamp

### Archiviazione
- Quando status → archiviato: script text uploadato su Drive, archived_at settato

### Notifiche marketing
- Quando un contenuto con source=marketing passa a completato → creata MarketingNotification
- Marketing vede badge nell'sidebar con conteggio non lette

## Migrazioni
- Auto-run all'avvio dell'app in `main.py`
- Aggiungono colonne mancanti (script_brief_id, drive_file_id, drive_folder_id)
- Gestione safe per enum PostgreSQL (ALTER TYPE ... ADD VALUE IF NOT EXISTS)
