# Frontend — React 18 + Vite + Tailwind

## Stack
- React 18, React Router v6
- Vite 5 (build + dev server)
- Tailwind CSS 3.4 con tema custom
- Lucide React (icone)
- date-fns + date-fns-tz

## Entry Point
`main.jsx` → `BrowserRouter` + `UserProvider` → `App`

## Tema Tailwind Custom (`tailwind.config.js`)
```javascript
colors: {
  mercury: { 50-900 } // gradiente arancione (#fffbf5 → #7f1d00)
  sidebar: '#1a0a00'   // sidebar scura
  accent: '#e8580c'    // arancione primario
}
```

## Auth (`context/UserContext.jsx`)
- Stato in-memory: userId, token, user, isAdmin, isMarketing
- Login: POST /api/auth/login → salva token in stato React
- Logout: reset tutto
- NO localStorage — token perso al refresh (scelta voluta)
- `USERS` map statica con name, initials, role, color per ogni utente

## API Client (`api/client.js`)
- Funzione `request(path, options)` wrapper su fetch
- Header `Authorization: Bearer {token}` automatico
- Gestione 401 → dispatch evento `mercurio:unauthorized` → logout
- Oggetto `api` con tutti i metodi raggruppati per risorsa
- `setAuthToken(token)` chiamato da UserContext

## Routing (`App.jsx`)

### Navigazione per ruolo

**Admin + Collaboratori:**
```
/dashboard       → Dashboard
/script-brief    → ScriptBriefPage
/nuovo           → CreateContent
/board           → Board (Kanban)
/calendario      → CalendarPage
/galleria        → Gallery
/archivio        → ArchivePage
/contenuto/:id   → ContentDetail
/popup/:targetUser → PopupAdmin (solo admin)
```

**Marketing (limitato):**
```
/script-brief    → ScriptBriefPage
/calendario      → CalendarPage (default dopo login)
/galleria        → Gallery
/archivio        → ArchivePage
+ campanella notifiche nell'sidebar
```

### Redirect
- `/` → `/dashboard` (admin/collaboratori) oppure `/calendario` (marketing)
- Non loggato → `<UserPicker />`

## Componenti (18)

### Layout & Navigation
- **App.jsx** — Sidebar con nav role-based, routing, toast, notifiche marketing, popup giornaliero
- **HalftoneBackground.jsx** — Background decorativo SVG con figure votive multicolore
- **UserPicker.jsx** — Schermata login: 4 card utente → form password → JWT
- **Toast.jsx** — Notifica toast top-right, auto-dismiss 3s

### Viste Principali
- **Dashboard.jsx** — Card stats (totale, per status, per utente, scaduti), grafici. Solo admin.
- **Board.jsx** — Kanban a 4 colonne (da-assegnare | in-lavorazione | in-revisione | completato). Drag via API PATCH. Filtri brand/type/assignee.
- **CreateContent.jsx** — Form creazione contenuto: title, brand, type, channel, source, assignee, deadline, script, notes. Può linkare un ScriptBrief.
- **ContentDetail.jsx** — Vista completa: metadata editabili, upload file (Drive), preview, commenti, log attività, download.
- **Gallery.jsx** — Griglia thumbnail con filtri. SmartThumb per lazy loading.
- **ArchivePage.jsx** — Browser contenuti completati/archiviati con filtri + bottone export Excel.
- **CalendarPage.jsx** — Vista mese, click su data per vedere task, conteggi per giorno.
- **ScriptBriefPage.jsx** — Lista/crea/modifica script e brief. Batch create (fino a 20). Collega a contenuti.

### Funzionalità Specifiche
- **PopupAdmin.jsx** — Admin scrive messaggi giornalieri per Federico/Marzia con task del giorno/settimana.
- **DailyPopupModal.jsx** — Modal che appare al primo login del giorno per collaboratori.
- **MarketingNotifPanel.jsx** — Panel slide-out: lista task marketing completati, segna come letti.
- **DevTasksPage.jsx** — Tracker task sviluppo Federico (in-corso vs completato, ore stimate).

### Componenti Riusabili
- **ContentThumb.jsx** — Card thumbnail: titolo, metadata, status badge.
- **SmartThumb.jsx** — Thumbnail con lazy loading + fallback su icona.
- **Tag.jsx** — Badge colorato per status/brand/tipo/canale.

## Pattern Comuni nel Codice

### Fetch dati
```javascript
useEffect(() => {
  api.listContents({ status: 'in-lavorazione' })
    .then(setItems)
    .catch(err => showToast(err.message, 'error'))
}, [])
```

### Filtri
```javascript
const [filters, setFilters] = useState({ brand: '', status: '', ... })
// Passati come query params a listContents(filters)
```

### Update status (Board)
```javascript
const handleStatusChange = (id, newStatus) => {
  api.updateContent(id, { status: newStatus })
    .then(reload)
}
```

### Toast
```javascript
const showToast = (msg, type = 'success') => {
  setToast({ msg, type })
  setTimeout(() => setToast(null), 3000)
}
```

## Note Importanti

- Il CSS è tutto Tailwind utility classes, nessun CSS module o styled-components
- Le icone vengono da `lucide-react` (import singoli: `{ LayoutDashboard, PlusCircle, ... }`)
- I colori status/brand/type sono definiti inline nei componenti Tag.jsx
- L'avatar sidebar usa `<img>` con fallback su cerchio colorato con iniziali
- Il background HalftoneBackground è basato su figure votive (Madonnine) — è l'identità visiva dell'app
