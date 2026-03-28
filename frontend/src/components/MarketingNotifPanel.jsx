import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, CheckCheck, ExternalLink, ChevronRight } from 'lucide-react'
import { api } from '../api/client'
import { BRANDS, TYPES, CHANNELS } from '../api/constants'
import Tag from './Tag'

export default function MarketingNotifPanel({ onClose, onCountUpdate }) {
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    api.listMarketingNotifs()
      .then(data => { setNotifs(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const unreadCount = notifs.filter(n => !n.read_at).length

  const handleMarkAllRead = async () => {
    await api.markAllNotifsRead()
    setNotifs(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })))
    onCountUpdate?.(0)
  }

  const handleClick = (notif) => {
    if (!notif.read_at) {
      api.markNotifRead(notif.id).catch(() => {})
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n))
      onCountUpdate?.(Math.max(0, unreadCount - 1))
    }
    onClose()
    navigate(`/contenuto/${notif.content_id}`)
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 bg-gradient-to-r from-purple-500 to-violet-500">
          <div>
            <h2 className="text-base font-bold text-white">Task Marketing Completati</h2>
            <p className="text-xs text-white/70">
              {unreadCount > 0 ? `${unreadCount} nuov${unreadCount === 1 ? 'o' : 'i'}` : 'Tutti letti'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <CheckCheck size={14} /> Segna tutti letti
              </button>
            )}
            <button onClick={onClose} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="text-center py-12 text-stone-400 text-sm">Caricamento...</div>
          )}
          {!loading && notifs.length === 0 && (
            <div className="text-center py-12 text-stone-400 text-sm">Nessun task marketing completato</div>
          )}
          {notifs.map(notif => {
            const brand = BRANDS[notif.brand] || {}
            const type = TYPES[notif.content_type] || {}
            const channel = CHANNELS[notif.channel] || {}
            const isUnread = !notif.read_at

            return (
              <div
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`flex items-center gap-3 px-5 py-3.5 border-b border-stone-100 cursor-pointer transition-colors group ${
                  isUnread ? 'bg-purple-50/50 hover:bg-purple-50' : 'hover:bg-stone-50'
                }`}
              >
                {/* Unread dot */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${isUnread ? 'bg-purple-500' : 'bg-transparent'}`} />

                <div className="flex-1 min-w-0">
                  <div className={`text-sm truncate ${isUnread ? 'font-semibold text-stone-800' : 'text-stone-600'}`}>
                    {notif.title}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Tag bg={brand.bg} text={brand.text}>{brand.label}</Tag>
                    <Tag bg={type.bg} text={type.text}>{type.label}</Tag>
                    <Tag bg={channel.bg} text={channel.text}>{channel.label}</Tag>
                  </div>
                  <div className="text-[10px] text-stone-400 mt-1">
                    Completato il {notif.completed_at ? new Date(notif.completed_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </div>
                </div>

                {notif.drive_link && (
                  <a
                    href={notif.drive_link}
                    target="_blank"
                    rel="noopener"
                    onClick={e => e.stopPropagation()}
                    className="p-2 text-purple-400 hover:text-purple-600 shrink-0"
                    title="Apri su Drive"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}

                <ChevronRight size={14} className="text-stone-300 group-hover:text-stone-500 shrink-0" />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
