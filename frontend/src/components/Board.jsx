import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, AlertTriangle } from 'lucide-react'
import { api } from '../api/client'
import { BRANDS, TYPES, CHANNELS, SOURCES, STATUSES, ASSIGNEES } from '../api/constants'
import { useUser } from '../context/UserContext'
import Tag from './Tag'
import { Avatar } from './Tag'
import SmartThumb from './SmartThumb'

export default function Board({ showToast }) {
  const [items, setItems] = useState([])
  const [brandFilter, setBrandFilter] = useState('')
  const [assignFilter, setAssignFilter] = useState('')
  const navigate = useNavigate()
  const { isAdmin } = useUser()

  const load = useCallback(() => {
    const params = {}
    if (brandFilter) params.brand = brandFilter
    if (assignFilter) params.assigned_to = assignFilter
    api.listContents(params).then(setItems)
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

  const isOverdue = (item) => item.deadline && new Date(item.deadline) < new Date() && item.status !== 'completato'

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1 text-stone-800">Board Lavori</h2>
      <p className="text-sm text-stone-500 mb-4">Stato di avanzamento dei contenuti</p>

      <div className="flex gap-3 mb-5">
        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm bg-white/80">
          <option value="">Tutti i brand</option>
          {Object.entries(BRANDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={assignFilter} onChange={e => setAssignFilter(e.target.value)} className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm bg-white/80">
          <option value="">Tutti</option>
          {Object.entries(ASSIGNEES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATUSES.map(status => {
          const colItems = items.filter(i => i.status === status.value)
          return (
            <div key={status.value} className="bg-white/40 backdrop-blur rounded-xl p-4 min-h-[300px] border border-stone-200">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: status.color }} />
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-600">{status.label}</span>
                <span className="text-[10px] font-bold bg-stone-200 text-stone-600 rounded-full px-2 py-0.5">{colItems.length}</span>
              </div>

              {colItems.length === 0 && <div className="text-center text-stone-400 text-xs py-8">Nessun elemento</div>}

              {colItems.map(item => {
                const brand = BRANDS[item.brand] || {}
                const channel = CHANNELS[item.channel] || {}
                const source = SOURCES[item.source] || {}
                const overdue = isOverdue(item)

                return (
                  <div key={item.id} className={`bg-white/90 backdrop-blur rounded-lg mb-2.5 border transition-shadow hover:shadow-md overflow-hidden flex ${overdue ? 'border-red-300' : 'border-stone-200'}`}>
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
                        <Tag bg={source.bg} text={source.text}>{source.label}</Tag>
                      </div>
                      {item.deadline && (
                        <div className={`flex items-center gap-1 text-[11px] mb-2 ${overdue ? 'text-red-600 font-semibold' : 'text-stone-400'}`}>
                          {overdue ? <AlertTriangle size={12} /> : <Clock size={12} />}
                          {new Date(item.deadline).toLocaleDateString('it-IT')}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1 pt-2 border-t border-stone-100">
                        {status.value === 'da-assegnare' && isAdmin && (
                          <>
                            <ActionBtn onClick={() => assign(item.id, 'federico')}>Federico</ActionBtn>
                            <ActionBtn onClick={() => assign(item.id, 'marzia')}>Marzia</ActionBtn>
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
    </div>
  )
}

function ActionBtn({ children, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`text-[11px] px-2.5 py-1 rounded border transition-colors ${
        danger
          ? 'border-stone-200 hover:bg-red-500 hover:text-white hover:border-red-500'
          : 'border-stone-200 hover:bg-accent hover:text-white hover:border-accent'
      }`}
    >
      {children}
    </button>
  )
}
