import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, AlertTriangle, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { api } from '../api/client'
import { BRANDS, TYPES, CHANNELS, SOURCES, STATUSES, ASSIGNEES } from '../api/constants'
import { useUser } from '../context/UserContext'
import Tag from './Tag'
import { Avatar } from './Tag'
import SmartThumb from './SmartThumb'

export default function Board({ showToast }) {
  const [items, setItems] = useState([])
  const [archivedItems, setArchivedItems] = useState([])
  const [showArchive, setShowArchive] = useState(false)
  const [brandFilter, setBrandFilter] = useState('')
  const [assignFilter, setAssignFilter] = useState('')
  const navigate = useNavigate()
  const { isAdmin, isMarketing } = useUser()

  const load = useCallback(() => {
    const params = {}
    if (brandFilter) params.brand = brandFilter
    if (assignFilter) params.assigned_to = assignFilter
    api.listContents(params).then(setItems)
    // Load archived items
    api.listContents({ ...params, archived: true, status: 'archiviato', limit: 50 }).then(setArchivedItems)
  }, [brandFilter, assignFilter])

  useEffect(() => { load() }, [load])

  const updateStatus = async (id, status) => {
    try {
      await api.updateContent(id, { status })
      showToast(`Spostato in "${STATUSES.find(s => s.value === status)?.label}"`)
      load()
    } catch (err) { showToast(err.message, 'error') }
  }

  const assign = async (id, person) => {
    try {
      await api.updateContent(id, { assigned_to: person })
      showToast(`Assegnato a ${person.charAt(0).toUpperCase() + person.slice(1)}`)
      load()
    } catch (err) { showToast(err.message, 'error') }
  }

  const archive = async (id) => {
    try {
      await api.updateContent(id, { status: 'archiviato' })
      showToast('Archiviato!')
      load()
    } catch (err) { showToast(err.message, 'error') }
  }

  const remove = async (id) => {
    if (!confirm('Eliminare questo contenuto?')) return
    try {
      await api.deleteContent(id)
      showToast('Eliminato')
      load()
    } catch (err) { showToast(err.message, 'error') }
  }

  const rifacimento = async (id) => {
    try {
      await api.updateContent(id, { status: 'in-lavorazione' })
      showToast('Rimandato in lavorazione')
      load()
    } catch (err) { showToast(err.message, 'error') }
  }

  const isOverdue = (item) => item.deadline && new Date(item.deadline) < new Date() && item.status !== 'completato'

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1 text-stone-800">Board Lavori</h2>
      <p className="text-sm text-stone-500 mb-4">Stato di avanzamento dei contenuti</p>

      <div className="flex gap-3 mb-5">
        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} className="px-3 py-2 border border-stone-200 rounded-xl text-sm bg-white/80 shadow-soft focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10">
          <option value="">Tutti i brand</option>
          {Object.entries(BRANDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={assignFilter} onChange={e => setAssignFilter(e.target.value)} className="px-3 py-2 border border-stone-200 rounded-xl text-sm bg-white/80 shadow-soft focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10">
          <option value="">Tutti</option>
          {Object.entries(ASSIGNEES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATUSES.map((status, colIndex) => {
          const colItems = items.filter(i => i.status === status.value)
          // Warm palette: from cooler (left) to warmer (right)
          const colBgs = [
            'bg-amber-50/30 border-amber-200/60',   // Da Assegnare — ambra chiaro
            'bg-orange-50/30 border-orange-200/60',  // In Lavorazione — arancio
            'bg-rose-50/30 border-rose-200/60',      // In Revisione — rosa
            'bg-emerald-50/30 border-emerald-200/60', // Completato — verde
          ]
          return (
            <div key={status.value} className={`backdrop-blur rounded-2xl p-3 min-h-[300px] border shadow-soft ${colBgs[colIndex]}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: status.color, boxShadow: `0 0 8px ${status.color}40` }} />
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-600">{status.label}</span>
                <span className="text-[10px] font-bold bg-white/60 text-stone-600 rounded-full px-2 py-0.5 shadow-sm">{colItems.length}</span>
              </div>

              {colItems.length === 0 && <div className="text-center text-stone-400 text-xs py-8">Nessun elemento</div>}

              {colItems.map(item => {
                const brand = BRANDS[item.brand] || {}
                const channel = CHANNELS[item.channel] || {}
                const source = SOURCES[item.source] || {}
                const overdue = isOverdue(item)

                const hasFederico = item.assigned_to?.includes('federico')
                const hasMarzia = item.assigned_to?.includes('marzia')
                const hasFulvio = item.assigned_to === 'fulvio' || item.assigned_to?.startsWith('fulvio+')
                const assigneeBg = hasFederico && hasMarzia
                  ? 'bg-purple-50/80'
                  : hasFederico
                    ? 'bg-orange-50/80'
                    : hasMarzia
                      ? 'bg-rose-50/80'
                      : hasFulvio
                        ? 'bg-indigo-50/80'
                        : 'bg-white/90'
                const assigneeBorder = hasFederico && hasMarzia
                  ? 'border-l-[3px] border-l-purple-400'
                  : hasFederico
                    ? 'border-l-[3px] border-l-orange-400'
                    : hasMarzia
                      ? 'border-l-[3px] border-l-rose-400'
                      : hasFulvio
                        ? 'border-l-[3px] border-l-indigo-400'
                        : ''

                return (
                  <div key={item.id} className={`${assigneeBg} backdrop-blur rounded-xl mb-2 border transition-all hover:shadow-soft-lg hover:-translate-y-0.5 overflow-hidden ${assigneeBorder} ${overdue ? 'border-red-300' : 'border-stone-200/80'}`}>
                    <div className="px-2.5 py-2 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1">
                          <Tag bg={brand.bg} text={brand.text}>{brand.label}</Tag>
                          <Tag bg={channel.bg} text={channel.text}>{channel.label}</Tag>
                        </div>
                        <Avatar name={item.assigned_to} />
                      </div>
                      <div className="text-[13px] font-semibold mb-1 cursor-pointer hover:text-accent truncate leading-tight" onClick={() => navigate(`/contenuto/${item.id}`)}>
                        {item.title}
                      </div>
                      {item.deadline && (
                        <div className={`flex items-center gap-1 text-[10px] mb-1 ${overdue ? 'text-red-600 font-semibold' : 'text-stone-400'}`}>
                          {overdue ? <AlertTriangle size={10} /> : <Clock size={10} />}
                          {new Date(item.deadline).toLocaleDateString('it-IT')}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1 pt-1 border-t border-stone-100">
                        {status.value === 'da-assegnare' && isAdmin && (
                          <>
                            <ActionBtn onClick={() => assign(item.id, 'fulvio')}>Fulvio</ActionBtn>
                            <ActionBtn onClick={() => assign(item.id, 'federico')}>Federico</ActionBtn>
                            <ActionBtn onClick={() => assign(item.id, 'marzia')}>Marzia</ActionBtn>
                            <ActionBtn onClick={() => assign(item.id, 'federico+marzia')}>Fed+Mar</ActionBtn>
                            <ActionBtn onClick={() => assign(item.id, 'fulvio+federico')}>Ful+Fed</ActionBtn>
                            <ActionBtn onClick={() => assign(item.id, 'fulvio+marzia')}>Ful+Mar</ActionBtn>
                          </>
                        )}
                        {status.value === 'in-lavorazione' && (
                          <ActionBtn onClick={() => updateStatus(item.id, 'in-revisione')}>In Revisione</ActionBtn>
                        )}
                        {status.value === 'in-revisione' && (
                          <>
                            <ActionBtn onClick={() => updateStatus(item.id, 'in-lavorazione')}>Rimanda</ActionBtn>
                            {isAdmin && <ActionBtn onClick={() => updateStatus(item.id, 'completato')}>Completa</ActionBtn>}
                          </>
                        )}
                        {status.value === 'completato' && isAdmin && (
                          <ActionBtn onClick={() => archive(item.id)}>Archivia</ActionBtn>
                        )}
                        {isAdmin && <ActionBtn onClick={() => remove(item.id)} danger>Elimina</ActionBtn>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Archive section */}
      {!isMarketing && (
        <div className="mt-8">
          <button
            onClick={() => setShowArchive(v => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-stone-500 hover:text-stone-700 transition-colors mb-3"
          >
            {showArchive ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            Archivio ({archivedItems.length})
          </button>
          {showArchive && (
            <div className="bg-stone-100/60 backdrop-blur rounded-xl border border-stone-200 p-4">
              {archivedItems.length === 0 ? (
                <div className="text-center text-stone-400 text-xs py-8">Nessun elemento archiviato</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {archivedItems.map(item => {
                    const brand = BRANDS[item.brand] || {}
                    const channel = CHANNELS[item.channel] || {}
                    return (
                      <div key={item.id} className="bg-white/90 backdrop-blur rounded-lg border border-stone-200 overflow-hidden flex">
                        <SmartThumb item={item} size="md" />
                        <div className="p-3 flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1">
                            <Tag bg={brand.bg} text={brand.text}>{brand.label}</Tag>
                            <Avatar name={item.assigned_to} />
                          </div>
                          <div className="text-sm font-semibold mb-2 cursor-pointer hover:text-accent truncate" onClick={() => navigate(`/contenuto/${item.id}`)}>
                            {item.title}
                          </div>
                          <div className="flex flex-wrap gap-1 mb-2">
                            <Tag bg={channel.bg} text={channel.text}>{channel.label}</Tag>
                          </div>
                          <div className="flex gap-1 pt-2 border-t border-stone-100">
                            <button
                              onClick={() => rifacimento(item.id)}
                              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-colors font-semibold"
                            >
                              <RotateCcw size={11} /> Rifacimento
                            </button>
                            {isAdmin && <ActionBtn onClick={() => remove(item.id)} danger>Elimina</ActionBtn>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ActionBtn({ children, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all ${
        danger
          ? 'border-stone-200 text-stone-500 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-sm'
          : 'border-stone-200 text-stone-600 hover:bg-accent hover:text-white hover:border-accent hover:shadow-sm'
      }`}
    >
      {children}
    </button>
  )
}
