const BASE = '/api'

let _token = null

/** Called by UserContext whenever token changes */
export function setAuthToken(token) {
  _token = token
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (_token) {
    headers['Authorization'] = `Bearer ${_token}`
  }
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  })
  if (res.status === 401) {
    // Token expired or invalid — force re-login
    window.dispatchEvent(new CustomEvent('mercurio:unauthorized'))
    throw new Error('Sessione scaduta. Effettua nuovamente l\'accesso.')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Errore di rete' }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // Contents
  listContents: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    ).toString()
    return request(`/contents/${qs ? '?' + qs : ''}`)
  },
  getContent: (id) => request(`/contents/${id}`),
  createContent: (data) => request('/contents/', { method: 'POST', body: JSON.stringify(data) }),
  updateContent: (id, data) => request(`/contents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteContent: (id) => request(`/contents/${id}`, { method: 'DELETE' }),

  // Stats
  getStats: () => request('/contents/stats'),
  getArchiveSummary: () => request('/contents/archive-summary'),

  // Files
  uploadFile: async (contentId, file) => {
    const form = new FormData()
    form.append('file', file)
    const headers = {}
    if (_token) {
      headers['Authorization'] = `Bearer ${_token}`
    }
    const res = await fetch(`${BASE}/files/${contentId}/upload`, {
      method: 'POST',
      body: form,
      headers,
    })
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('mercurio:unauthorized'))
      throw new Error('Sessione scaduta')
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload fallito' }))
      throw new Error(err.detail || 'Upload fallito')
    }
    return res.json()
  },
  getDownloadUrl: (contentId) => `${BASE}/files/${contentId}/download`,

  // Download with auth (returns blob URL)
  downloadFile: async (contentId) => {
    const headers = {}
    if (_token) {
      headers['Authorization'] = `Bearer ${_token}`
    }
    const res = await fetch(`${BASE}/files/${contentId}/download`, { headers })
    if (!res.ok) throw new Error('Download fallito')
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  },

  // Thumbnails (returns blob URL for <img src>)
  getThumbnail: async (contentId) => {
    const headers = {}
    if (_token) {
      headers['Authorization'] = `Bearer ${_token}`
    }
    const res = await fetch(`${BASE}/files/${contentId}/thumbnail`, { headers })
    if (!res.ok) return null
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  },

  // Activities & Comments
  getActivities: (contentId) => request(`/contents/${contentId}/activities`),
  getComments: (contentId) => request(`/contents/${contentId}/comments`),
  addComment: (contentId, data) => request(`/contents/${contentId}/comments`, { method: 'POST', body: JSON.stringify(data) }),

  // Export (returns authenticated blob URL)
  downloadExport: async (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    ).toString()
    const headers = {}
    if (_token) {
      headers['Authorization'] = `Bearer ${_token}`
    }
    const res = await fetch(`${BASE}/contents/export/excel${qs ? '?' + qs : ''}`, { headers })
    if (!res.ok) throw new Error('Export fallito')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'archivio_contenuti.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  },
}
