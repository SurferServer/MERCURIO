import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Send, Trash2, ChevronDown, ChevronUp, MessageSquare, Clock, CheckCircle2 } from 'lucide-react'
import { api } from '../api/client'

const USER_LABELS = { federico: 'Federico', marzia: 'Marzia' }

export default function PopupAdmin({ showToast }) {
  const { targetUser } = useParams()
  const label = USER_LABELS[targetUser] || targetUser
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState([])
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    if (targetUser) {
      api.listPopupsForUser(targetUser).then(setHistory).catch(e => console.warn('Popup history load failed:', e))
    }
  }, [targetUser])

  // Tomorrow's date for the next popup
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  const tomorrowLabel = tomorrow.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

  // Check if there's already a popup for tomorrow
  const tomorrowPopup = history.find(p => {
    const d = new Date(p.target_date)
    return d.toISOString().split('T')[0] === tomorrowStr
  })

  useEffect(() => {
    if (tomorrowPopup?.message) {
      setMessage(tomorrowPopup.message)
    }
  }, [tomorrowPopup?.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.createPopup({
        target_user: targetUser,
        target_date: tomorrowStr,
        message: message.trim() || null,
      })
      showToast?.('Comunicazione salvata')
      const updated = await api.listPopupsForUser(targetUser)
      setHistory(updated)
    } catch (err) {
      showToast?.(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Eliminare questo popup?')) return
    try {
      await api.deletePopup(id)
      setHistory(h => h.filter(p => p.id !== id))
      showToast?.('Popup eliminato')
    } catch (err) {
      showToast?.(err.message, 'error')
    }
  }

  const formatDate = (d) => {
    return new Date(d).toLocaleDateString('it-IT', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-stone-800 mb-1">
        Popup {label}
      </h2>
      <p className="text-sm text-stone-500 mb-6">
        Scrivi la comunicazione che {label} vedrà al primo accesso di domani ({tomorrowLabel})
      </p>

      {/* Compose area */}
      <div className="bg-white/90 backdrop-blur rounded-xl border border-stone-200 p-5 mb-8">
        <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
          Comunicazione per domani
        </label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={`Scrivi qui il messaggio per ${label}...`}
          rows={5}
          className="w-full rounded-lg border border-stone-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 resize-none"
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-[10px] text-stone-400">
            {tomorrowPopup ? 'Sovrascriverà il messaggio esistente per domani' : 'Nuovo popup per domani'}
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            <Send size={14} />
            {saving ? 'Salvo...' : 'Salva comunicazione'}
          </button>
        </div>
      </div>

      {/* History */}
      <h3 className="text-sm font-bold text-stone-700 mb-3 flex items-center gap-2">
        <Clock size={16} />
        Storico popup ({history.length})
      </h3>

      {history.length === 0 && (
        <p className="text-sm text-stone-400 italic">Nessun popup ancora inviato</p>
      )}

      <div className="space-y-2">
        {history.map(popup => {
          const isExpanded = expandedId === popup.id
          const isRead = !!popup.read_at
          let tasksToday = [], tasksWeek = []
          try { tasksToday = popup.tasks_today_json ? JSON.parse(popup.tasks_today_json) : [] } catch { /* malformed */ }
          try { tasksWeek = popup.tasks_week_json ? JSON.parse(popup.tasks_week_json) : [] } catch { /* malformed */ }

          return (
            <div key={popup.id} className="bg-white/90 backdrop-blur rounded-xl border border-stone-200 overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-stone-50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : popup.id)}
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${isRead ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-stone-700">{formatDate(popup.target_date)}</div>
                  <div className="text-[11px] text-stone-400 truncate">
                    {popup.message ? popup.message.slice(0, 80) + (popup.message.length > 80 ? '...' : '') : 'Nessun messaggio — solo task'}
                  </div>
                </div>
                {isRead && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                    <CheckCircle2 size={10} /> Letto
                  </span>
                )}
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(popup.id) }}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-stone-300 hover:text-red-500 transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
                {isExpanded ? <ChevronUp size={16} className="text-stone-400" /> : <ChevronDown size={16} className="text-stone-400" />}
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-stone-100 pt-3 space-y-3">
                  {popup.message && (
                    <div>
                      <div className="text-[10px] font-semibold text-stone-400 uppercase mb-1">Messaggio</div>
                      <div className="text-sm text-stone-700 whitespace-pre-wrap bg-amber-50/50 rounded-lg p-3">
                        {popup.message}
                      </div>
                    </div>
                  )}

                  {tasksToday.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-stone-400 uppercase mb-1">
                        Task scadenza giornata ({tasksToday.length})
                      </div>
                      <div className="space-y-1">
                        {tasksToday.map(t => (
                          <div key={t.id} className="text-xs flex items-center gap-2 bg-red-50/50 rounded px-2 py-1">
                            <span className="font-medium text-stone-700">{t.title}</span>
                            <span className="text-stone-400">{t.brand}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {tasksWeek.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold text-stone-400 uppercase mb-1">
                        Task in scadenza nella settimana ({tasksWeek.length})
                      </div>
                      <div className="space-y-1">
                        {tasksWeek.map(t => (
                          <div key={t.id} className="text-xs flex items-center gap-2 bg-orange-50/50 rounded px-2 py-1">
                            <span className="font-medium text-stone-700">{t.title}</span>
                            <span className="text-stone-400">{t.brand}</span>
                            <span className="text-stone-300 ml-auto">{t.deadline ? new Date(t.deadline).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' }) : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isRead && (
                    <div className="text-[10px] text-emerald-600">
                      Letto il {new Date(popup.read_at).toLocaleString('it-IT')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
