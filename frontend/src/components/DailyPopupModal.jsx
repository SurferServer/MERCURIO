import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, AlertCircle, CalendarDays, ChevronRight } from 'lucide-react'
import { api } from '../api/client'
import { BRANDS } from '../api/constants'

const STATUS_COLORS = {
  'da-assegnare': 'bg-orange-100 text-orange-700',
  'in-lavorazione': 'bg-amber-100 text-amber-700',
  'in-revisione': 'bg-pink-100 text-pink-700',
}

export default function DailyPopupModal() {
  const navigate = useNavigate()
  const [popup, setPopup] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    api.getMyDailyPopup()
      .then(data => {
        if (data && data.id) {
          setPopup(data)
          setVisible(true)
        }
      })
      .catch(e => console.warn('Daily popup load failed:', e))
  }, [])

  const handleClose = () => {
    setVisible(false)
    if (popup?.id) {
      api.markPopupRead(popup.id).catch(() => {})
    }
  }

  const handleTaskClick = (taskId) => {
    handleClose()
    navigate(`/contenuto/${taskId}`)
  }

  if (!visible || !popup) return null

  const today = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  const hasMessage = popup.message && popup.message.trim()
  const tasksToday = popup.tasks_today || []
  const tasksWeek = popup.tasks_week || []
  // Exclude today's tasks from the week summary to avoid duplicates
  const todayIds = new Set(tasksToday.map(t => t.id))
  const tasksRestOfWeek = tasksWeek.filter(t => !todayIds.has(t.id))

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Buongiorno!</h2>
            <p className="text-xs text-white/80 capitalize">{today}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[65vh] p-6 space-y-5">
          {/* Admin message */}
          {hasMessage && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={14} className="text-amber-600" />
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Comunicazione</span>
              </div>
              <div className="text-sm text-stone-800 whitespace-pre-wrap leading-relaxed">
                {popup.message}
              </div>
            </div>
          )}

          {/* Today's tasks */}
          {tasksToday.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-stone-600 uppercase tracking-wide">
                  Scadenze di oggi ({tasksToday.length})
                </span>
              </div>
              <div className="space-y-1.5">
                {tasksToday.map(task => {
                  const brand = BRANDS[task.brand] || {}
                  return (
                    <div
                      key={task.id}
                      onClick={() => handleTaskClick(task.id)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 hover:bg-stone-50 cursor-pointer transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-stone-800 truncate">{task.title}</div>
                        <div className="flex gap-1.5 mt-1">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${brand.bg || ''} ${brand.text || ''}`}>
                            {brand.label || task.brand}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${STATUS_COLORS[task.status] || 'bg-stone-100 text-stone-500'}`}>
                            {task.status}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-stone-300 group-hover:text-stone-500 shrink-0" />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Rest of week */}
          {tasksRestOfWeek.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays size={14} className="text-orange-500" />
                <span className="text-xs font-bold text-stone-600 uppercase tracking-wide">
                  Prossime scadenze in settimana ({tasksRestOfWeek.length})
                </span>
              </div>
              <div className="space-y-1.5">
                {tasksRestOfWeek.map(task => {
                  const brand = BRANDS[task.brand] || {}
                  const deadlineLabel = task.deadline
                    ? new Date(task.deadline).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
                    : ''
                  return (
                    <div
                      key={task.id}
                      onClick={() => handleTaskClick(task.id)}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-stone-100 hover:bg-stone-50 cursor-pointer transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-stone-700 truncate">{task.title}</div>
                        <div className="flex gap-1.5 mt-0.5">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${brand.bg || ''} ${brand.text || ''}`}>
                            {brand.label || task.brand}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-stone-400 shrink-0">{deadlineLabel}</span>
                      <ChevronRight size={14} className="text-stone-300 group-hover:text-stone-500 shrink-0" />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!hasMessage && tasksToday.length === 0 && tasksRestOfWeek.length === 0 && (
            <div className="text-center py-6 text-stone-400">
              <CalendarDays size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nessuna scadenza oggi e nessuna comunicazione</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-stone-100 bg-stone-50/50">
          <button
            onClick={handleClose}
            className="w-full py-2.5 bg-stone-800 hover:bg-stone-900 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Ho letto, iniziamo!
          </button>
        </div>
      </div>
    </div>
  )
}
