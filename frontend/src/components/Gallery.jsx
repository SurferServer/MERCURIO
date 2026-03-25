import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FolderOpen } from 'lucide-react'
import { api } from '../api/client'
import { BRANDS, TYPES, CHANNELS } from '../api/constants'
import Tag from './Tag'
import SmartThumb from './SmartThumb'

export default function Gallery() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [brandFilter, setBrandFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    // Single API call — only archived/completed content
    api.listContents({ archived: true }).then(data => {
      setItems(data)
    }).catch(err => {
      console.error('Gallery fetch failed:', err)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return items.filter(i => {
      if (brandFilter && i.brand !== brandFilter) return false
      if (typeFilter && i.content_type !== typeFilter) return false
      if (q && !i.title?.toLowerCase().includes(q) && !i.notes?.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, brandFilter, typeFilter, searchQuery])

  const grouped = {}
  filtered.forEach(item => {
    if (!grouped[item.brand]) grouped[item.brand] = []
    grouped[item.brand].push(item)
  })

  if (loading) return <div className="text-stone-400 py-20 text-center">Caricamento...</div>

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1 text-stone-800">Galleria</h2>
      <p className="text-sm text-stone-500 mb-6">Contenuti completati e archiviati</p>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cerca per titolo o note..."
            className="pl-9 pr-3 py-1.5 border border-stone-200 rounded-lg text-sm bg-white/80 w-64 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>
        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm bg-white/80">
          <option value="">Tutti i brand</option>
          {Object.entries(BRANDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm bg-white/80">
          <option value="">Tutti i tipi</option>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {Object.entries(grouped).length === 0 && (
        <div className="text-center text-stone-400 py-12">Nessun contenuto completato da mostrare.</div>
      )}

      {Object.entries(grouped).map(([brandKey, brandItems]) => {
        const brand = BRANDS[brandKey] || { label: brandKey, color: '#666' }
        return (
          <div key={brandKey} className="mb-8">
            <h3 className="text-sm font-bold uppercase tracking-wide mb-4 pb-2 border-b-2" style={{ borderBottomColor: brand.color, color: brand.color }}>
              {brand.label}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {brandItems.map(item => {
                const channel = CHANNELS[item.channel] || {}
                const type = TYPES[item.content_type] || {}
                return (
                  <div
                    key={item.id}
                    className="bg-white/90 backdrop-blur rounded-xl border border-stone-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer hover:-translate-y-1"
                    onClick={() => navigate(`/contenuto/${item.id}`)}
                  >
                    <SmartThumb item={item} size="lg" />
                    <div className="p-3">
                      <div className="text-sm font-semibold mb-2 truncate text-stone-700">{item.title}</div>
                      <div className="flex gap-1.5 mb-2">
                        <Tag bg={type.bg} text={type.text}>{type.label}</Tag>
                        <Tag bg={channel.bg} text={channel.text}>{channel.label}</Tag>
                      </div>
                      <div className="flex items-center justify-between">
                        {item.completed_at && (
                          <div className="text-[11px] text-stone-400">{new Date(item.completed_at).toLocaleDateString('it-IT')}</div>
                        )}
                        {item.drive_folder_link && (
                          <a
                            href={item.drive_folder_link}
                            target="_blank"
                            rel="noopener"
                            onClick={e => e.stopPropagation()}
                            className="text-blue-500 hover:text-blue-700"
                            title="Apri cartella Drive"
                          >
                            <FolderOpen size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
