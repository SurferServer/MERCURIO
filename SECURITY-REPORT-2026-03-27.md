# MERCURIO — Resoconto Audit di Sicurezza
**Data:** 27 marzo 2026
**Eseguito da:** Verifica automatica schedulata
**Codebase analizzata:** `content-hub` (backend FastAPI + frontend React/Nginx)

---

## Giudizio generale

**Il codice è complessivamente ben strutturato sul piano della sicurezza.** Le pratiche fondamentali sono rispettate: autenticazione JWT, rate limiting, CORS esplicito, header di sicurezza HTTP, protezione path traversal, input validation tramite enum. Non ci sono credenziali hardcoded nel codice sorgente, nessun file `.env` committato, e il backend è correttamente isolato dietro il proxy nginx.

Sono stati tuttavia identificati **4 rischi di livello medio** e **3 punti di attenzione minori** che meritano un aggiornamento.

---

## Analisi modulo per modulo

### `auth.py` — Autenticazione e JWT

| Aspetto | Stato |
|---|---|
| Confronto password timing-safe (`secrets.compare_digest`) | ✅ Corretto |
| JWT firmato con segreto configurabile via env | ✅ Corretto |
| Fallback a segreto casuale se env var mancante | ⚠️ Attenzione |
| Password in chiaro nelle variabili d'ambiente | 🔴 Rischio medio |
| Nessun meccanismo di revoca token | 🔴 Rischio medio |
| Nessun blocco account dopo tentativi falliti | 🔴 Rischio medio |

**Dettaglio critico — Password in chiaro:**
Le password sono memorizzate come stringhe plain-text nelle variabili d'ambiente (`MERCURIO_PASS_FULVIO`, ecc.) e confrontate direttamente. Se l'ambiente di produzione venisse compromesso (es. accesso alla dashboard Render, leak dei log, dump env), le password sarebbero immediatamente leggibili. La soluzione è passare a hash bcrypt/argon2.

**Dettaglio — Nessuna revoca JWT:**
Un token valido dura 24 ore. Se fosse necessario bloccare immediatamente un utente (account compromesso, cambio password), non c'è modo di invalidare il token esistente senza cambiare `MERCURIO_JWT_SECRET`, il che farebbe logout di tutti.

**Dettaglio — Nessun account lockout:**
Il rate limiter su `/api/auth/login` blocca 5 richieste/minuto per IP. Un attaccante con IP multipli (proxy, VPN) potrebbe fare brute force nel tempo. Non c'è contatore di tentativi falliti per singolo account.

---

### `main.py` — Configurazione applicazione

| Aspetto | Stato |
|---|---|
| CORS con origini esplicite (no wildcard `*`) | ✅ Corretto |
| Rate limiting con `slowapi` | ✅ Corretto |
| `/docs` disabilitato in produzione (`MERCURIO_ENV=production`) | ✅ Corretto |
| Protezione path traversal su avatar e SPA | ✅ Corretto |
| Validazione tipo MIME su upload avatar | ✅ Corretto |
| `MERCURIO_JWT_SECRET` con fallback a valore casuale | ⚠️ Attenzione |

Il fallback a segreto random all'avvio è sicuro in sé, ma significa che **se `MERCURIO_JWT_SECRET` non è impostata in produzione**, tutti i token vengono invalidati ad ogni restart del container. Verificare che la variabile sia effettivamente configurata su Render.

---

### `files.py` — Upload e download file

| Aspetto | Stato |
|---|---|
| Whitelist estensioni permesse | ✅ Corretto |
| Sanitizzazione filename (rimozione caratteri pericolosi) | ✅ Corretto |
| Limite dimensione file (configurabile via env) | ✅ Corretto |
| Autenticazione richiesta per upload/download | ✅ Corretto |
| Protezione path traversal su thumbnail | ✅ Corretto |
| Fallback su file locale (legacy `file_path`) | ⚠️ Attenzione minore |

Il fallback al percorso locale nel download esiste per contenuti pre-Drive. Il percorso viene letto dal DB (non da input utente), quindi non è un injection risk diretto. Da monitorare comunque.

---

### `drive_service.py` — Integrazione Google Drive

| Aspetto | Stato |
|---|---|
| Credenziali OAuth2 solo da variabili d'ambiente | ✅ Corretto |
| Nessuna credenziale hardcoded | ✅ Corretto |
| Escape dei valori nelle query Drive API | ✅ Corretto |
| Scope OAuth2 completo (`drive`) | 🟡 Migliorabile |

Il token OAuth2 usa lo scope `https://www.googleapis.com/auth/drive` (accesso totale al Drive). Sarebbe più sicuro usare `drive.file` che limita l'accesso ai soli file creati dall'app MERCURIO.

---

### `nginx.conf` — Frontend e proxy

| Aspetto | Stato |
|---|---|
| Header `X-Content-Type-Options: nosniff` | ✅ Presente |
| Header `X-Frame-Options: DENY` (protezione clickjacking) | ✅ Presente |
| Header `X-XSS-Protection` | ✅ Presente |
| Content Security Policy | ✅ Presente |
| `server_tokens off` (nasconde versione nginx) | ✅ Presente |
| Backend non esposto pubblicamente (solo via proxy) | ✅ Corretto |
| Blocco dotfiles (`/\.`) | ✅ Presente |
| `style-src 'unsafe-inline'` nel CSP | 🟡 Migliorabile |
| Solo HTTP (porta 80), nessun redirect HTTPS | ⚠️ Da verificare |

Il CSP include `'unsafe-inline'` per gli stili, necessario probabilmente per Tailwind/inline styles React. Il rischio di CSS injection è basso in questo contesto ma non nullo.

HTTPS non è gestito direttamente da nginx — probabilmente è delegato alla piattaforma Render (che offre TLS automatico). **Verificare che il sito in produzione risponda solo su HTTPS** e che http:// venga rediretto.

---

### `.gitignore` — Protezione file sensibili

| File/Pattern | Presente in .gitignore |
|---|---|
| `.env` | ✅ Sì |
| `*.db` / `*.sqlite3` | ✅ Sì |
| `uploads/` | ✅ Sì |
| `credentials/` (Google Drive keys) | ✅ Sì |
| `get_refresh_token.py` | ✅ Sì |

Nessun file `.env` o credenziale è stato trovato committato nella storia git. Il `get_refresh_token.py` presente nella cartella contiene solo placeholder (`INCOLLA_QUI_IL_TUO_CLIENT_ID`), nessun dato reale.

---

### Frontend — Gestione token

| Aspetto | Stato |
|---|---|
| Token JWT in React state (non localStorage) | ✅ Corretto |
| Token inviato solo via header `Authorization: Bearer` | ✅ Corretto |
| Logout su risposta 401 dal server | ✅ Corretto |
| Password mai loggata o esposta nel frontend | ✅ Corretto |

La scelta di usare React state invece di localStorage è corretta dal punto di vista della sicurezza (meno esposizione a XSS).

---

## Riepilogo rischi

| Priorità | Problema | Area |
|---|---|---|
| 🔴 Media | Password in chiaro nelle env var (no hashing) | `auth.py` |
| 🔴 Media | Nessun blocco account dopo N tentativi falliti | `auth.py` |
| 🔴 Media | Nessuna revoca/blacklist JWT | `auth.py` |
| 🟡 Bassa | Scope Google Drive troppo ampio (`drive` invece di `drive.file`) | `drive_service.py` |
| 🟡 Bassa | `unsafe-inline` nel CSP degli stili | `nginx.conf` |
| ⚠️ Verifica | HTTPS in produzione delegato a Render — confermare redirect | infrastruttura |
| ⚠️ Verifica | `MERCURIO_JWT_SECRET` impostata su Render (no fallback random) | configurazione |

---

## Aggiornamenti di sicurezza consigliati

### 1. Hashing delle password (priorità alta)

Invece di confrontare password in chiaro, aggiungi `passlib` con bcrypt al backend:

```
# requirements.txt: aggiungere
passlib[bcrypt]>=1.7.4
```

Il flusso diventa: l'admin imposta una password hashata nell'env var (generata con `passlib.context.CryptContext`), e il backend verifica con `verify()`. Le password in chiaro non esistono più a riposo.

### 2. Contatore tentativi falliti (priorità media)

Aggiungi un dizionario in memoria (o meglio, Redis se disponibile) che traccia i tentativi falliti per user_id. Dopo 10 tentativi in 15 minuti, blocca l'account per N minuti indipendentemente dall'IP.

### 3. Token versioning per revoca (priorità media)

Aggiungi un campo `token_version` (intero) per ogni utente, incluso nel payload JWT. Incrementando il valore in-memory (o in DB), tutti i token emessi con la versione precedente diventano invalidi. Utile per "logout forzato" o cambio password d'emergenza.

### 4. Scope Google Drive più ristretto (priorità bassa)

Cambia lo scope da `drive` a `drive.file` nella funzione `_get_drive_service()`. Questo limita il token OAuth2 ai soli file creati dall'app, riducendo il danno potenziale in caso di compromissione del refresh token. **Nota:** richiederà di generare un nuovo refresh token.

### 5. Verifica HTTPS in produzione

Accedere all'URL pubblico dell'app su Render e verificare che:
- Il sito risponde su `https://`
- Un accesso via `http://` viene rediretto a `https://`
- Il certificato TLS è valido

---

*Report generato automaticamente il 27/03/2026 dalla verifica schedulata `verifica-sicurezza-mercurio`.*
