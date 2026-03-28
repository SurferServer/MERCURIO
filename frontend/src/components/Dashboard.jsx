import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, Users, CheckCircle2, Inbox, Megaphone, ChevronDown, ChevronUp, Archive, CalendarClock } from 'lucide-react'
import { api } from '../api/client'
import { BRANDS, TYPES, CHANNELS, STATUSES } from '../api/constants'
import Tag from './Tag'
import { Avatar } from './Tag'
import SmartThumb from './SmartThumb'

/** How many days before deadline to show the warning */
const DEADLINE_WARN_DAYS = 3

function daysUntil(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.ceil((d - now) / 86400000)
}

/**
 * Returns true if the deadline is "critical" — past days, or today after 14:00.
 * Used to show the red diagonal stripes only from 14:00 on the deadline day.
 */
function isDeadlineCritical(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  const now = new Date()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (d.getTime() < today.getTime()) return true
  if (d.getTime() === today.getTime() && now.getHours() >= 14) return true
  return false
}

function deadlineLabel(days) {
  if (days < 0) return `Scaduto da ${Math.abs(days)}g`
  if (days === 0) return 'Scade oggi'
  if (days === 1) return 'Scade domani'
  return `Scade tra ${days}g`
}

function deadlineColor(days) {
  if (days < 0) return 'text-red-600 bg-red-50'
  if (days === 0) return 'text-red-600 bg-red-50'
  if (days <= 2) return 'text-amber-600 bg-amber-50'
  return 'text-orange-500 bg-orange-50'
}

/** Row component used in all three panels */
function ItemRow({ item, navigate, extra }) {
  return (
    <div
      onClick={() => navigate(`/contenuto/${item.id}`)}
      className="flex items-center gap-3 px-5 py-3 border-b border-stone-100 last:border-0 hover:bg-stone-50 cursor-pointer transition-colors"
    >
      <SmartThumb item={item} size="xs" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate text-stone-700">{item.title}</div>
      </div>
      <Tag bg={BRANDS[item.brand]?.bg} text={BRANDS[item.brand]?.text}>{BRANDS[item.brand]?.label}</Tag>
      {extra}
      <Avatar name={item.assigned_to} />
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [allItems, setAllItems] = useState([])
  const [expandedPanel, setExpandedPanel] = useState(null)
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      api.getStats().then(setStats).catch(err => {
        console.error('Stats fetch failed:', err)
        setError('Impossibile caricare le statistiche')
      }),
      api.listContents().then(setAllItems).catch(err => {
        console.error('Contents fetch failed:', err)
      }),
    ]).finally(() => setLoading(false))
  }, [])

  // ── Derived lists ──────────────────────────────────────
  const inLavorazione = useMemo(() =>
    allItems.filter(i => i.status === 'in-lavorazione' || i.status === 'in-revisione'),
  [allItems])

  const urgenti = useMemo(() => {
    return allItems
      .filter(i => {
        if (i.status === 'completato' || i.status === 'archiviato') return false
        const d = daysUntil(i.deadline)
        return d !== null && d <= DEADLINE_WARN_DAYS
      })
      .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline))
  }, [allItems])

  const daArchiviare = useMemo(() =>
    allItems.filter(i => i.status === 'completato'),
  [allItems])

  // ── Loading / error ────────────────────────────────────
  if (loading) return <div className="text-stone-400 py-20 text-center">Caricamento...</div>

  if (!stats && error) return (
    <div className="py-20 text-center">
      <div className="text-red-500 text-sm font-medium mb-2">{error}</div>
      <button onClick={() => window.location.reload()} className="text-xs text-accent underline">Riprova</button>
    </div>
  )

  if (!stats) return <div className="text-stone-400 py-20 text-center">Caricamento...</div>

  // ── Stat cards ─────────────────────────────────────────
  const statCards = [
    { id: 'da-assegnare', label: 'Da Assegnare', value: stats.da_assegnare, icon: Inbox, color: 'text-orange-600', bg: 'bg-orange-50', ring: 'ring-orange-200' },
    { id: 'in-lavorazione', label: 'In Lavorazione', value: stats.in_lavorazione, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-200' },
    { id: 'in-revisione', label: 'In Revisione', value: stats.in_revisione, icon: Users, color: 'text-pink-600', bg: 'bg-pink-50', ring: 'ring-pink-200' },
    { id: 'completato', label: 'Completati', value: stats.completato, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', ring: 'ring-green-200' },
    { id: 'archiviato', label: 'Archiviati', value: stats.archiviato, icon: Archive, color: 'text-stone-500', bg: 'bg-stone-50', ring: 'ring-stone-200' },
    { id: 'marketing', label: 'Richieste MKT', value: stats.da_marketing, icon: Megaphone, color: 'text-violet-600', bg: 'bg-violet-50', ring: 'ring-violet-200' },
  ]

  const togglePanel = (id) => setExpandedPanel(expandedPanel === id ? null : id)

  const getPanelItems = (id) => {
    if (id === 'marketing') return allItems.filter(i => i.source === 'marketing')
    return allItems.filter(i => i.status === id)
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1 text-stone-800">Dashboard</h2>
      <p className="text-sm text-stone-500 mb-6">Panoramica produzione contenuti</p>

      {/* ── Alert: scaduti ─────────────────────────────── */}
      {stats.scaduti > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200/60 rounded-2xl p-4 mb-6 flex items-center gap-3 shadow-soft animate-fade-in-up">
          <div className="p-2 rounded-xl bg-red-100">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <span className="text-sm text-red-700 font-medium">{stats.scaduti} contenut{stats.scaduti === 1 ? 'o' : 'i'} scadut{stats.scaduti === 1 ? 'o' : 'i'}</span>
        </div>
      )}

      {/* ── Stat Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
        {statCards.map(({ id, label, value, icon: Icon, color, bg, ring }, idx) => (
          <div
            key={id}
            onClick={() => togglePanel(id)}
            className={`bg-white/90 backdrop-blur rounded-2xl p-5 border border-stone-100 cursor-pointer transition-all shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 animate-fade-in-up ${expandedPanel === id ? `ring-2 ${ring}` : ''}`}
            style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'backwards' }}
          >
            <div className={`inline-flex p-2.5 rounded-xl ${bg} mb-3`}>
              <Icon size={18} className={color} strokeWidth={2.2} />
            </div>
            <div className="text-2xl font-bold text-stone-800">{value}</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-stone-500">{label}</span>
              {expandedPanel === id ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
            </div>
          </div>
        ))}
      </div>

      {/* ── Expand Panel (click on stat card) ──────────── */}
      {expandedPanel && (
        <div className="bg-white/90 backdrop-blur rounded-2xl border border-stone-100 shadow-soft mb-6 overflow-hidden animate-fade-in-up">
          {getPanelItems(expandedPanel).length === 0 ? (
            <div className="p-6 text-center text-stone-400 text-sm">Nessun elemento</div>
          ) : (
            getPanelItems(expandedPanel).map(item => (
              <ItemRow key={item.id} item={item} navigate={navigate} />
            ))
          )}
        </div>
      )}

      {/* ── Three-panel grid ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* 1) In lavorazione */}
        <div className="bg-white/90 backdrop-blur rounded-2xl border border-stone-100 shadow-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.06) 0%, transparent 100%)' }}>
            <div className="p-1.5 rounded-lg bg-amber-100">
              <Clock size={14} className="text-amber-600" />
            </div>
            <span className="font-semibold text-sm text-stone-700">In lavorazione</span>
            <span className="ml-auto text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{inLavorazione.length}</span>
          </div>
          {inLavorazione.length === 0 ? (
            <div className="p-8 text-center text-stone-400 text-sm">Nessun task in corso.</div>
          ) : (
            inLavorazione.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                navigate={navigate}
                extra={
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                    item.status === 'in-revisione' ? 'bg-pink-100 text-pink-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {item.status === 'in-revisione' ? 'Revisione' : 'Lavorazione'}
                  </span>
                }
              />
            ))
          )}
        </div>

        {/* 2) Scadenze imminenti */}
        <div className="bg-white/90 backdrop-blur rounded-2xl border border-stone-100 shadow-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, transparent 100%)' }}>
            <div className="p-1.5 rounded-lg bg-red-100">
              <CalendarClock size={14} className="text-red-600" />
            </div>
            <span className="font-semibold text-sm text-stone-700">Scadenze imminenti</span>
            {urgenti.length > 0 && (
              <span className="ml-auto text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{urgenti.length}</span>
            )}
          </div>
          {urgenti.length === 0 ? (
            <div className="p-8 text-center text-stone-400 text-sm">Nessuna scadenza nei prossimi {DEADLINE_WARN_DAYS} giorni.</div>
          ) : (
            urgenti.map(item => {
              const days = daysUntil(item.deadline)
              return (
                <ItemRow
                  key={item.id}
                  item={item}
                  navigate={navigate}
                  extra={
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${deadlineColor(days)}`}>
                      {deadlineLabel(days)}
                    </span>
                  }
                />
              )
            })
          )}
        </div>

        {/* 3) Da archiviare */}
        <div className="bg-white/90 backdrop-blur rounded-2xl border border-stone-100 shadow-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, rgba(22, 163, 74, 0.05) 0%, transparent 100%)' }}>
            <div className="p-1.5 rounded-lg bg-green-100">
              <Archive size={14} className="text-green-600" />
            </div>
            <span className="font-semibold text-sm text-stone-700">Da archiviare</span>
            {daArchiviare.length > 0 && (
              <span className="ml-auto text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{daArchiviare.length}</span>
            )}
          </div>
          {daArchiviare.length === 0 ? (
            <div className="p-8 text-center text-stone-400 text-sm">Nessun task completato in attesa di archiviazione.</div>
          ) : (
            <>
              {daArchiviare.map(item => {
                const completedDays = item.completed_at ? daysUntil(item.completed_at) : null
                const waitLabel = completedDays !== null && completedDays < 0
                  ? `${Math.abs(completedDays)}g fa`
                  : 'oggi'
                return (
                  <ItemRow
                    key={item.id}
                    item={item}
                    navigate={navigate}
                    extra={
                      <span className="text-[10px] text-stone-400 whitespace-nowrap">
                        Completato {waitLabel}
                      </span>
                    }
                  />
                )
              })}
              {daArchiviare.length > 3 && (
                <div className="px-5 py-2.5 bg-green-50/50 text-center">
                  <span className="text-xs text-green-700 font-medium">
                    {daArchiviare.length} task da verificare e archiviare
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Workload ───────────────────────────────────── */}
      <div className="bg-white/90 backdrop-blur rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 font-semibold text-sm border-b border-stone-100 text-stone-700">Carico di lavoro</div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-100">
          {[
            { name: 'federico', label: 'Federico', count: stats.federico_attivi, color: '#ff9800' },
            { name: 'marzia', label: 'Marzia', count: stats.marzia_attivi, color: '#ef4444' },
          ].map(({ name, label, count, color }) => {
            const isAssigned = (item) => item.assigned_to === name || (item.assigned_to?.includes('+') && item.assigned_to?.includes(name))
            const personItems = inLavorazione.filter(isAssigned)
            // Urgent: assigned to this person, not completed/archived, with a deadline coming up
            const personUrgent = allItems
              .filter(i => {
                if (!isAssigned(i)) return false
                if (i.status === 'completato' || i.status === 'archiviato') return false
                const d = daysUntil(i.deadline)
                return d !== null && d <= DEADLINE_WARN_DAYS
              })
              .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline))
            return (
              <div key={name} className="px-5 py-4">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={name} className="w-9 h-9 text-sm" />
                  <span className="font-medium text-stone-700">{label}</span>
                  <span className="ml-auto text-2xl font-bold text-stone-800">{count}</span>
                </div>
                <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden mb-3">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((count / 10) * 100, 100)}%`, background: color }} />
                </div>

                {/* Urgent deadlines */}
                {personUrgent.length > 0 && (
                  <div className="mb-3">
                    <div className="text-[10px] uppercase tracking-wider text-red-500 font-bold mb-1.5 flex items-center gap-1">
                      <CalendarClock size={12} /> Scadenze urgenti
                    </div>
                    <div className="space-y-1">
                      {personUrgent.map(item => {
                        const days = daysUntil(item.deadline)
                        const critical = isDeadlineCritical(item.deadline)
                        return (
                          <div
                            key={item.id}
                            onClick={() => navigate(`/contenuto/${item.id}`)}
                            className={`relative flex items-center gap-2 text-xs cursor-pointer py-1.5 px-2.5 -mx-1 rounded-lg transition-colors overflow-hidden ${
                              critical
                                ? 'text-red-800 hover:text-red-900'
                                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                            }`}
                          >
                            {/* Red diagonal stripes — only after 14:00 on deadline day or past */}
                            {critical && (
                              <div
                                className="absolute inset-0 pointer-events-none rounded-lg"
                                style={{
                                  opacity: 0.4,
                                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(220, 38, 38, 0.25) 4px, rgba(220, 38, 38, 0.25) 6px)',
                                  backgroundColor: 'rgba(254, 226, 226, 0.6)',
                                }}
                              />
                            )}
                            <span className="relative truncate flex-1 font-medium">{item.title}</span>
                            <span className={`relative text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${deadlineColor(days)}`}>
                              {deadlineLabel(days)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Tasks in progress */}
                {personItems.length > 0 && (
                  <div className="space-y-1">
                    {personUrgent.length > 0 && (
                      <div className="text-[10px] uppercase tracking-wider text-stone-400 font-bold mb-1">In corso</div>
                    )}
                    {personItems.slice(0, 4).map(item => (
                      <div
                        key={item.id}
                        onClick={() => navigate(`/contenuto/${item.id}`)}
                        className="flex items-center gap-2 text-xs text-stone-600 hover:text-stone-900 cursor-pointer py-1 px-2 -mx-2 rounded hover:bg-stone-50 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.status === 'in-revisione' ? '#ec4899' : color }} />
                        <span className="truncate">{item.title}</span>
                        <Tag bg={BRANDS[item.brand]?.bg} text={BRANDS[item.brand]?.text}>{BRANDS[item.brand]?.label}</Tag>
                      </div>
                    ))}
                    {personItems.length > 4 && (
                      <div className="text-[10px] text-stone-400 pl-2">+{personItems.length - 4} altri</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
