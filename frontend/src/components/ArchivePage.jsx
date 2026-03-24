import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Grid3X3, List, ExternalLink } from 'lucide-react'
import { api } from '../api/client'
import { BRANDS, TYPES, CHANNELS, SOURCES } from '../api/constants'
import Tag from './Tag'
import SmartThumb from './SmartThumb'

export default function ArchivePage() {
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState([])
  const [filters, setFilters] = useState({ brand: '', content_type: '', channel: '', source: '' })
  const [viewMode, setViewMode] = useState('table')
  const navigate = useNavigate()

  const load = useCallback(() => {
    api.listContents({ ...filters, archived: true }).then(setItems)
    api.getArchiveSummary().then(setSummary)
  }, [filters])

  useEffect(() => { load() }, [load])

  const setFilter = (key) => (e) => setFilters({ ...filters, [key]: e.target.value })

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1 text-stone-800">Archivio Contenuti</h2>
      <p className="text-sm text-stone-500 mb-6">Riepilogo contenuti archiviati</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {summary.map(s => {
          const brand = BRANDS[s.brand] || {}
          return (
            <div key={s.brand} className="bg-white/90 backdrop-blur rounded-xl p-5 border border-stone-200 border-l-4" style={{ borderLeftColor: brand.color }}>
              <div className="text-xs uppercase tracking-wide mb-1 font-bold" style={{ color: brand.color }}>{s.brand_label}</div>
              <div className="text-3xl font-bold text-stone-800 mb-1">{s.totale}</div>
              <div className="text-xs text-stone-400">{s.video} video · {s.grafica} grafiche · {s.organico} org · {s.adv} adv</div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select value={filters.brand} onChange={setFilter('brand')} className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm bg-white/80">
          <option value="">Tutti i brand</option>
          {Object.entries(BRANDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filters.content_type} onChange={setFilter('content_type')} className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm bg-white/80">
          <option value="">Tutti i tipi</option>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filters.channel} onChange={setFilter('channel')} className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm bg-white/80">
          <option value="">Tutti i canali</option>
          {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filters.source} onChange={setFilter('source')} className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm bg-white/80">
          <option value="">Tutte le origini</option>
          {Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setViewMode('table')} className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-stone-200' : 'hover:bg-stone-100'}`}><List size={18} /></button>
          <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-stone-200' : 'hover:bg-stone-100'}`}><Grid3X3 size={18} /></button>
          <button onClick={() => api.downloadExport(filters)} className="flex items-center gap-2 px-4 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-mercury-800 transition-colors">
            <Download size={15} /> Excel
          </button>
        </div>
      </div>

      {viewMode === 'table' && (
        <div className="bg-white/90 backdrop-blur rounded-xl border border-stone-200 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-stone-50">
                {['Titolo', 'Brand', 'Tipo', 'Canale', 'Origine', 'Realizzato da', 'Archiviato', 'Drive'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-stone-500 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-stone-400 text-sm">Nessun contenuto archiviato.</td></tr>
              )}
              {items.map(item => {
                const brand = BRANDS[item.brand] || {}
                const type = TYPES[item.content_type] || {}
                const channel = CHANNELS[item.channel] || {}
                const source = SOURCES[item.source] || {}
                return (
                  <tr key={item.id} className="border-t border-stone-100 hover:bg-mercury-50 cursor-pointer" onClick={() => navigate(`/contenuto/${item.id}`)}>
                    <td className="px-4 py-3 text-sm font-medium flex items-center gap-2">
                      <SmartThumb item={item} size="xs" />
                      {item.title}
                    </td>
                    <td className="px-4 py-3"><Tag bg={brand.bg} text={brand.text}>{brand.label}</Tag></td>
                    <td className="px-4 py-3"><Tag bg={type.bg} text={type.text}>{type.label}</Tag></td>
                    <td className="px-4 py-3"><Tag bg={channel.bg} text={channel.text}>{channel.label}</Tag></td>
                    <td className="px-4 py-3"><Tag bg={source.bg} text={source.text}>{source.label}</Tag></td>
                    <td className="px-4 py-3 text-sm">{item.assigned_to ? item.assigned_to.charAt(0).toUpperCase() + item.assigned_to.slice(1) : '—'}</td>
                    <td className="px-4 py-3 text-xs text-stone-500">{item.archived_at ? new Date(item.archived_at).toLocaleDateString('it-IT') : item.completed_at ? new Date(item.completed_at).toLocaleDateString('it-IT') : '—'}</td>
                    <td className="px-4 py-3">
                      {item.drive_link ? (
                        <a href={item.drive_link} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="text-accent hover:underline"><ExternalLink size={14} /></a>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'grid' && (
        <div>
          {Object.entries(BRANDS).map(([brandKey, brandInfo]) => {
            const brandItems = items.filter(i => i.brand === brandKey)
            if (brandItems.length === 0 && filters.brand && filters.brand !== brandKey) return null
            return (
              <div key={brandKey} className="mb-8">
                <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: brandInfo.color }}>{brandInfo.label}</h3>
                {brandItems.length === 0 ? (
                  <div className="text-sm text-stone-400 pl-2">Nessun contenuto</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {brandItems.map(item => {
                      const type = TYPES[item.content_type] || {}
                      const channel = CHANNELS[item.channel] || {}
                      return (
                        <div key={item.id} className="bg-white/90 backdrop-blur rounded-xl border border-stone-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer hover:-translate-y-1" onClick={() => navigate(`/contenuto/${item.id}`)}>
                          <SmartThumb item={item} size="lg" />
                          <div className="p-3">
                            <div className="text-sm font-semibold mb-2 truncate text-stone-700">{item.title}</div>
                            <div className="flex gap-1.5">
                              <Tag bg={type.bg} text={type.text}>{type.label}</Tag>
                              <Tag bg={channel.bg} text={channel.text}>{channel.label}</Tag>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
