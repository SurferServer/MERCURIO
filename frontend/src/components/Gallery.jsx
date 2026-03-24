import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { BRANDS, TYPES, CHANNELS } from '../api/constants'
import Tag from './Tag'
import SmartThumb from './SmartThumb'

export default function Gallery() {
  const [items, setItems] = useState([])
  const [brandFilter, setBrandFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api.listContents().then(active => {
      api.listContents({ archived: true }).then(archived => {
        const all = [...active, ...archived]
        setItems(all.filter(i => ['completato', 'archiviato'].includes(i.status)))
      })
    })
  }, [])

  const filtered = items.filter(i => {
    if (brandFilter && i.brand !== brandFilter) return false
    if (typeFilter && i.content_type !== typeFilter) return false
    return true
  })

  const grouped = {}
  filtered.forEach(item => {
    if (!grouped[item.brand]) grouped[item.brand] = []
    grouped[item.brand].push(item)
  })

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1 text-stone-800">Galleria</h2>
      <p className="text-sm text-stone-500 mb-6">Contenuti completati e archiviati</p>

      <div className="flex gap-3 mb-6">
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
                      {item.completed_at && (
                        <div className="text-[11px] text-stone-400">{new Date(item.completed_at).toLocaleDateString('it-IT')}</div>
                      )}
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
