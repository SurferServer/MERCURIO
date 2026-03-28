# MERCURIO — Resoconto Audit di Sicurezza
**Data:** 28 marzo 2026
**Eseguito da:** Verifica automatica schedulata (`verifica-sicurezza-mercurio`)
**Codebase analizzata:** `content-hub` (backend FastAPI + frontend React)

---

## Stato rispetto al report precedente (27/03/2026)

Nessuna modifica al codice è stata rilevata tra il 27 e il 28 marzo. I **4 rischi di livello medio** e i **3 punti di attenzione** identificati ieri sono ancora tutti presenti. Di seguito il riepilogo aggiornato con eventuali note aggiuntive.

---

## Struttura del progetto — Integrità verificata ✅

| Componente | File principali | Stato |
|---|---|---|
| Autenticazione | `auth.py` | Integro, nessuna alterazione |
| Backend API | `main.py`, `routes/*.py` | Integro, 7 moduli route presenti |
| Database | `database.py`, `models.py` | Integro, 9 modelli definiti |
| Google Drive | `drive_service.py` | Integro, OAuth2 via env var |
| Frontend | `App.jsx`, `UserContext.jsx`, `client.js` | Integro |
| Configurazione | `docker-compose.yml`, `render.yaml`, `Dockerfile`, `nginx.conf` | Integri |
| File sensibili | `.env`, credenziali, DB | Assenti dal repo (protetti da `.gitignore`) |

Nessun file aggiunto, rimosso o modificato in modo sospetto. La struttura è coerente con quanto atteso.

---

## Rischi ancora aperti (dal report del 27/03)

### 🔴 1. Password in chiaro nelle variabili d'ambiente
**Stato:** NON RISOLTO
**File:** `auth.py` riga 49-65
**Rischio:** Le password utente (`MERCURIO_PASS_FULVIO`, ecc.) sono confrontate in chiaro con `secrets.compare_digest()`. Il confronto è timing-safe, ma se le env var vengono esposte (dashboard Render compromessa, log leak), le password sono immediatamente leggibili.
**Azione consigliata:** Passare a bcrypt/argon2. Memorizzare nelle env var solo gli hash, non le password in chiaro.

### 🔴 2. Nessun blocco account dopo tentativi falliti
**Stato:** NON RISOLTO
**File:** `main.py` riga 171-192
**Rischio:** Il rate limiter (`5/minute` per IP) è una protezione parziale. Un attaccante con IP multipli può eseguire brute force sulle password (che per ora non hanno requisiti di complessità).
**Azione consigliata:** Aggiungere un contatore tentativi falliti per `user_id`, con blocco temporaneo dopo 10 tentativi in 15 minuti.

### 🔴 3. Nessun meccanismo di revoca token JWT
**Stato:** NON RISOLTO
**File:** `auth.py` riga 69-81
**Rischio:** Un token valido (24h di vita) non può essere revocato individualmente. L'unico modo per invalidare tutti i token è cambiare `MERCURIO_JWT_SECRET`, che fa logout di tutti gli utenti.
**Azione consigliata:** Aggiungere un campo `token_version` per utente, incluso nel payload JWT. Incrementandolo si invalidano i token precedenti.

### 🟡 4. Scope Google Drive troppo ampio
**Stato:** NON RISOLTO
**File:** `drive_service.py` riga 75
**Rischio:** Lo scope `https://www.googleapis.com/auth/drive` dà accesso a TUTTO il Google Drive dell'account collegato. Se il refresh token venisse compromesso, un attaccante avrebbe accesso all'intero Drive.
**Azione consigliata:** Ridurre a `drive.file` (accesso solo ai file creati dall'app). Richiede rigenerazione del refresh token.

---

## Controlli positivi confermati ✅

### Autenticazione e accessi
- JWT firmato con HS256 e segreto configurabile da env var
- Confronto password timing-safe (`secrets.compare_digest`)
- Rate limiting su login: 5 richieste/minuto per IP
- Ruoli ben separati: `admin`, `collaborator`, `marketing`
- Dependency injection FastAPI per controllo accessi su ogni endpoint
- Utenti marketing limitati a contenuti completati/archiviati
- Dev tasks accessibili solo a Federico e admin
- Popup gestibili solo dall'admin
- `/docs` (Swagger UI) disabilitato in produzione

### Protezione dati e file
- Upload: whitelist estensioni, limite dimensione, sanitizzazione filename
- Path traversal: protezione con `os.path.realpath()` su avatar, thumbnail, SPA
- Credenziali Google Drive solo in env var, mai nel codice
- `get_refresh_token.py` contiene solo placeholder, nessun dato reale
- Nessun file `.env` nel repository (presente solo `.env.example`)
- `.gitignore` protegge: `.env`, `*.db`, `uploads/`, `credentials/`
- Token JWT conservato in React state (non in localStorage — meno esposto a XSS)

### Infrastruttura
- Backend non esposto pubblicamente (solo via proxy nginx o servito da FastAPI)
- CORS con origini esplicite (no wildcard `*`)
- Header di sicurezza HTTP completi: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, CSP
- `server_tokens off` (versione nginx nascosta)
- Blocco accesso ai dotfile (`.`)
- Connection pool PostgreSQL configurato con `pool_pre_ping` e `pool_recycle`
- Migrazioni DB sicure (solo aggiunta colonne, mai distruttive)

### Frontend
- Token inviato solo via header `Authorization: Bearer` (mai cookie, mai URL)
- Logout automatico su risposta 401
- Password mai esposta o loggata nel frontend
- Author dei commenti imposto lato server (non modificabile dal client)

---

## Note aggiuntive di questa verifica

### Verifica da fare manualmente
1. **HTTPS in produzione:** Il sito su Render (`https://mercurio-jeb1.onrender.com`) dovrebbe rispondere solo su HTTPS con redirect automatico da HTTP. Render lo gestisce di norma, ma vale la pena verificare con un browser.
2. **`MERCURIO_JWT_SECRET` su Render:** `render.yaml` usa `generateValue: true`, il che è corretto. Verificare che il valore sia stato effettivamente generato e non sia vuoto nella dashboard Render.
3. **Password utenti su Render:** Confermare che le variabili `MERCURIO_PASS_*` siano state impostate per tutti e 4 gli utenti. Se mancanti, il login per quell'utente è bloccato (comportamento sicuro, ma da verificare).

### Punto di attenzione: endpoint notifiche marketing
Gli endpoint `/api/notifications/marketing/*` (count, list, read-all, mark-read) richiedono autenticazione ma non verificano che l'utente sia effettivamente il ruolo `marketing`. Qualsiasi utente autenticato può leggere e marcare come lette le notifiche marketing. Rischio pratico basso (sono solo 4 utenti fidati), ma è una incongruenza da correggere per pulizia.

### Punto di attenzione: endpoint avatar senza autenticazione
`GET /avatars/{filename}` serve le immagini avatar senza richiedere autenticazione. È intenzionale (serve per la sidebar), ma espone i nomi utente. Rischio molto basso dato che gli user_id sono già noti (lista fissa di 4 utenti).

---

## Piano di aggiornamento consigliato (ordinato per priorità)

### Priorità alta — da fare appena possibile
1. **Hashing password con bcrypt/argon2** — Aggiungere `passlib[bcrypt]` al backend, generare hash delle password, salvare gli hash (non le password) nelle env var.
2. **Account lockout** — Contatore in memoria (o Redis) dei tentativi falliti per user_id, con blocco temporaneo dopo 10 fallimenti in 15 minuti.

### Priorità media — da pianificare
3. **Token versioning** — Aggiungere `token_version` per utente per permettere revoca selettiva dei JWT senza fare logout di tutti.
4. **Controllo ruolo su notifiche marketing** — Aggiungere `require_role("marketing", "admin")` sugli endpoint notifiche.

### Priorità bassa — miglioramenti
5. **Ridurre scope Google Drive** a `drive.file` (richiede rigenerazione refresh token).
6. **Rimuovere `unsafe-inline` dal CSP** se possibile (dipende dalla gestione degli stili Tailwind).

---

## Conclusione

La struttura di MERCURIO è integra e non presenta segni di manomissione o compromissione. Le buone pratiche di sicurezza fondamentali sono rispettate (autenticazione JWT, CORS, rate limiting, path traversal protection, nessuna credenziale nel codice). I rischi identificati nel report del 27/03 rimangono tutti aperti e meritano attenzione, in particolare l'hashing delle password che è l'intervento più importante e a più alto impatto. Nessuno dei rischi identificati rappresenta una vulnerabilità attivamente sfruttabile dall'esterno senza credenziali valide, ma sono tutti punti di miglioramento significativi per la robustezza del sistema.

---

*Report generato automaticamente il 28/03/2026 dalla verifica schedulata `verifica-sicurezza-mercurio`.*
