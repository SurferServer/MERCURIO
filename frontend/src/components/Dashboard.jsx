import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, Users, CheckCircle2, Inbox, Megaphone, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../api/client'
import { BRANDS, TYPES, CHANNELS } from '../api/constants'
import Tag from './Tag'
import { Avatar } from './Tag'
import SmartThumb from './SmartThumb'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [recent, setRecent] = useState([])
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
      api.listContents().then(items => {
        setAllItems(items)
        setRecent(items.slice(0, 8))
      }).catch(err => {
        console.error('Contents fetch failed:', err)
      }),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-mercury-600/50 py-20 text-center">Caricamento...</div>

  if (!stats && error) return (
    <div className="py-20 text-center">
      <div className="text-red-500 text-sm font-medium mb-2">{error}</div>
      <button onClick={() => window.location.reload()} className="text-xs text-accent underline">Riprova</button>
    </div>
  )

  if (!stats) return <div className="text-mercury-600/50 py-20 text-center">Caricamento...</div>

  const statCards = [
    { id: 'da-assegnare', label: 'Da Assegnare', value: stats.da_assegnare, icon: Inbox, color: 'text-orange-600', bg: 'bg-orange-50', ring: 'ring-orange-200' },
    { id: 'in-lavorazione', label: 'In Lavorazione', value: stats.in_lavorazione, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-200' },
    { id: 'in-revisione', label: 'In Revisione', value: stats.in_revisione, icon: Users, color: 'text-pink-600', bg: 'bg-pink-50', ring: 'ring-pink-200' },
    { id: 'completato', label: 'Completati', value: stats.completato, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', ring: 'ring-green-200' },
    { id: 'archiviato', label: 'Archiviati', value: stats.archiviato, icon: CheckCircle2, color: 'text-stone-500', bg: 'bg-stone-50', ring: 'ring-stone-200' },
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

      {stats.scaduti > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertTriangle size={20} className="text-red-500" />
          <span className="text-sm text-red-700 font-medium">{stats.scaduti} contenut{stats.scaduti === 1 ? 'o' : 'i'} scadut{stats.scaduti === 1 ? 'o' : 'i'}</span>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
        {statCards.map(({ id, label, value, icon: Icon, color, bg, ring }) => (
          <div
            key={id}
            onClick={() => togglePanel(id)}
            className={`bg-white/90 backdrop-blur rounded-xl p-5 border border-stone-200 cursor-pointer transition-all hover:shadow-md ${expandedPanel === id ? `ring-2 ${ring}` : ''}`}
          >
            <div className={`inline-flex p-2 rounded-lg ${bg} mb-3`}>
              <Icon size={18} className={color} />
            </div>
            <div className="text-2xl font-bold text-stone-800">{value}</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-stone-500">{label}</span>
              {expandedPanel === id ? <ChevronUp size={14} className="text-stone-400" /> : <ChevronDown size={14} className="text-stone-400" />}
            </div>
          </div>
        ))}
      </div>

      {/* Expand Panel */}
      {expandedPanel && (
        <div className="bg-white/90 backdrop-blur rounded-xl border border-stone-200 mb-6 overflow-hidden">
          {getPanelItems(expandedPanel).length === 0 ? (
            <div className="p-6 text-center text-stone-400 text-sm">Nessun elemento</div>
          ) : (
            getPanelItems(expandedPanel).map(item => (
              <div
                key={item.id}
                onClick={() => navigate(`/contenuto/${item.id}`)}
                className="flex items-center gap-3 px-5 py-3 border-b border-stone-100 last:border-0 hover:bg-mercury-50 cursor-pointer transition-colors"
              >
                <SmartThumb item={item} size="xs" />
                <span className="flex-1 text-sm font-medium truncate text-stone-700">{item.title}</span>
                <Tag bg={BRANDS[item.brand]?.bg} text={BRANDS[item.brand]?.text}>{BRANDS[item.brand]?.label}</Tag>
                <Avatar name={item.assigned_to} />
              </div>
            ))
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent */}
        <div className="bg-white/90 backdrop-blur rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 font-semibold text-sm border-b border-stone-100 text-stone-700">Ultimi contenuti</div>
          {recent.length === 0 ? (
            <div className="p-8 text-center text-stone-400 text-sm">Nessun contenuto.</div>
          ) : (
            recent.map(item => (
              <div
                key={item.id}
                className="px-5 py-3 border-b border-stone-50 flex items-center gap-3 hover:bg-mercury-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/contenuto/${item.id}`)}
              >
                <SmartThumb item={item} size="xs" />
                <span className="flex-1 text-sm font-medium truncate text-stone-700">{item.title}</span>
                <Tag bg={BRANDS[item.brand]?.bg} text={BRANDS[item.brand]?.text}>{BRANDS[item.brand]?.label}</Tag>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.status === 'completato' ? '#16a34a' : item.status === 'in-lavorazione' ? '#f59e0b' : item.status === 'in-revisione' ? '#ec4899' : '#f57c00' }} />
              </div>
            ))
          )}
        </div>

        {/* Workload */}
        <div className="bg-white/90 backdrop-blur rounded-xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 font-semibold text-sm border-b border-stone-100 text-stone-700">Carico di lavoro</div>
          {[
            { name: 'federico', label: 'Federico', count: stats.federico_attivi, color: '#ff9800' },
            { name: 'marzia', label: 'Marzia', count: stats.marzia_attivi, color: '#ef4444' },
          ].map(({ name, label, count, color }) => (
            <div key={name} className="px-5 py-4 border-b border-stone-50 flex items-center gap-4">
              <Avatar name={name} className="w-9 h-9 text-sm" />
              <span className="flex-1 font-medium text-stone-700">{label}</span>
              <div className="w-32 h-2 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((count / Math.max(allItems.length, 1)) * 100, 100)}%`, background: color }} />
              </div>
              <span className="text-2xl font-bold text-stone-800 w-8 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
