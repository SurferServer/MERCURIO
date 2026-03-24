import React, { useEffect, useState } from 'react'
import { FileText, Plus, ChevronDown, ChevronUp, Trash2, UserPlus, X } from 'lucide-react'
import { api } from '../api/client'
import { useUser } from '../context/UserContext'
import { BRANDS } from '../api/constants'
import Tag from './Tag'
import { Avatar } from './Tag'

const BRIEF_TYPES = {
  script: { label: 'Script', bg: 'bg-blue-50', text: 'text-blue-700' },
  brief: { label: 'Brief', bg: 'bg-purple-50', text: 'text-purple-700' },
}

export default function ScriptBriefPage({ showToast }) {
  const { isAdmin } = useUser()
  const [items, setItems] = useState([])
  const [filters, setFilters] = useState({ brief_type: '', brand: '', assigned_to: '' })
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [editingAssign, setEditingAssign] = useState(null)

  const [form, setForm] = useState({
    title: '', brief_type: 'script', brand: '', content: '', notes: '', assigned_to: '',
  })

  const load = () => {
    api.listScriptBriefs(filters).then(setItems).catch(() => {})
  }

  useEffect(() => { load() }, [filters])

  const setFilter = (key) => (e) => setFilters({ ...filters, [key]: e.target.value })
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleCreate = async () => {
    if (!form.title.trim() || !form.brand || !form.content.trim()) {
      showToast('Compila titolo, brand e contenuto', 'error')
      return
    }
    try {
      await api.createScriptBrief({
        ...form,
        assigned_to: form.assigned_to || null,
      })
      showToast('Script/Brief creato!')
      setShowCreate(false)
      setForm({ title: '', brief_type: 'script', brand: '', content: '', notes: '', assigned_to: '' })
      load()
    } catch (err) { showToast(err.message, 'error') }
  }

  const handleAssign = async (id, assignee) => {
    try {
      await api.updateScriptBrief(id, { assigned_to: assignee || null })
      showToast(assignee ? `Assegnato a ${assignee.charAt(0).toUpperCase() + assignee.slice(1)}` : 'Assegnazione rimossa')
      setEditingAssign(null)
      load()
    } catch (err) { showToast(err.message, 'error') }
  }

  const handleDelete = async (id) => {
    if (!confirm('Eliminare questo script/brief?')) return
    try {
      await api.deleteScriptBrief(id)
      showToast('Eliminato')
      load()
    } catch (err) { showToast(err.message, 'error') }
  }

  const available = items.filter(i => !i.is_used)
  const used = items.filter(i => i.is_used)

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Script & Brief</h2>
          <p className="text-sm text-stone-500">Gestisci script per i video e brief per le statiche</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-mercury-800 transition-colors"
          >
            {showCreate ? <X size={16} /> : <Plus size={16} />}
            {showCreate ? 'Chiudi' : 'Nuovo'}
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && isAdmin && (
        <div className="bg-white/90 backdrop-blur rounded-xl border border-stone-200 p-6 mb-6">
          <h3 className="text-sm font-semibold text-stone-700 mb-4">Nuovo Script / Brief</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-[11px] text-stone-500 uppercase tracking-wide mb-1 block">Titolo *</label>
              <input value={form.title} onChange={set('title')} placeholder="es. Script Reel Guida e Vai" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-[11px] text-stone-500 uppercase tracking-wide mb-1 block">Tipo *</label>
              <select value={form.brief_type} onChange={set('brief_type')} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm">
                <option value="script">Script (video)</option>
                <option value="brief">Brief (statica)</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-stone-500 uppercase tracking-wide mb-1 block">Brand *</label>
              <select value={form.brand} onChange={set('brand')} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm">
                <option value="">Seleziona brand</option>
                {Object.entries(BRANDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-[11px] text-stone-500 uppercase tracking-wide mb-1 block">Contenuto *</label>
            <textarea value={form.content} onChange={set('content')} rows={6} placeholder="Scrivi lo script o il brief..." className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm resize-y focus:outline-none focus:border-accent" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="text-[11px] text-stone-500 uppercase tracking-wide mb-1 block">Note (opzionale)</label>
              <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Note aggiuntive..." className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm resize-y focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-[11px] text-stone-500 uppercase tracking-wide mb-1 block">Assegna a (opzionale)</label>
              <select value={form.assigned_to} onChange={set('assigned_to')} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm">
                <option value="">Non assegnato</option>
                <option value="federico">Federico</option>
                <option value="marzia">Marzia</option>
              </select>
            </div>
          </div>
          <button onClick={handleCreate} className="px-6 py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-mercury-800 transition-colors">
            Crea Script/Brief
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select value={filters.brief_type} onChange={setFilter('brief_type')} className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm bg-white/80">
          <option value="">Tutti i tipi</option>
          <option value="script">Script</option>
          <option value="brief">Brief</option>
        </select>
        <select value={filters.brand} onChange={setFilter('brand')} className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm bg-white/80">
          <option value="">Tutti i brand</option>
          {Object.entries(BRANDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filters.assigned_to} onChange={setFilter('assigned_to')} className="px-3 py-1.5 border border-stone-200 rounded-lg text-sm bg-white/80">
          <option value="">Tutti</option>
          <option value="federico">Federico</option>
          <option value="marzia">Marzia</option>
        </select>
        <div className="ml-auto text-xs text-stone-400">
          {available.length} disponibil{available.length === 1 ? 'e' : 'i'} · {used.length} utilizzat{used.length === 1 ? 'o' : 'i'}
        </div>
      </div>

      {/* Available list */}
      {available.length === 0 && used.length === 0 && (
        <div className="bg-white/90 backdrop-blur rounded-xl border border-stone-200 p-12 text-center">
          <FileText size={40} className="mx-auto text-stone-300 mb-3" />
          <div className="text-stone-500 text-sm">Nessuno script o brief presente.</div>
          {isAdmin && <div className="text-stone-400 text-xs mt-1">Clicca "Nuovo" per crearne uno.</div>}
        </div>
      )}

      {available.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500 mb-3">Disponibili ({available.length})</h3>
          <div className="space-y-2">
            {available.map(item => (
              <ScriptBriefCard
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                editingAssign={editingAssign === item.id}
                onEditAssign={() => setEditingAssign(editingAssign === item.id ? null : item.id)}
                onAssign={(assignee) => handleAssign(item.id, assignee)}
                onDelete={() => handleDelete(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {used.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-3">Già utilizzati ({used.length})</h3>
          <div className="space-y-2 opacity-60">
            {used.map(item => (
              <ScriptBriefCard
                key={item.id}
                item={item}
                isAdmin={isAdmin}
                expanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                editingAssign={false}
                onEditAssign={() => {}}
                onAssign={() => {}}
                onDelete={() => handleDelete(item.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ScriptBriefCard({ item, isAdmin, expanded, onToggle, editingAssign, onEditAssign, onAssign, onDelete }) {
  const brand = BRANDS[item.brand] || {}
  const typeInfo = BRIEF_TYPES[item.brief_type] || {}

  return (
    <div className="bg-white/90 backdrop-blur rounded-xl border border-stone-200 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-stone-50/50 transition-colors" onClick={onToggle}>
        <FileText size={18} className="text-stone-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-stone-700 truncate">{item.title}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Tag bg={typeInfo.bg} text={typeInfo.text}>{typeInfo.label}</Tag>
          <Tag bg={brand.bg} text={brand.text}>{brand.label}</Tag>
          {item.assigned_to && <Avatar name={item.assigned_to} />}
          {expanded ? <ChevronUp size={16} className="text-stone-400" /> : <ChevronDown size={16} className="text-stone-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-stone-100 pt-4">
          <div className="bg-stone-50 rounded-lg p-4 text-sm whitespace-pre-wrap text-stone-700 mb-4 max-h-64 overflow-y-auto">
            {item.content}
          </div>

          {item.notes && (
            <div className="mb-4">
              <div className="text-[11px] text-stone-500 uppercase tracking-wide mb-1">Note</div>
              <div className="text-sm text-stone-600">{item.notes}</div>
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-stone-400 mb-4">
            <span>Creato: {new Date(item.created_at).toLocaleDateString('it-IT')}</span>
            {item.assigned_to && (
              <span>Assegnato a: <strong className="text-stone-600">{item.assigned_to.charAt(0).toUpperCase() + item.assigned_to.slice(1)}</strong></span>
            )}
          </div>

          {isAdmin && (
            <div className="flex items-center gap-3 pt-3 border-t border-stone-100">
              {!item.is_used && (
                <>
                  {editingAssign ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => onAssign('federico')} className="px-3 py-1.5 text-xs bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors font-medium">Federico</button>
                      <button onClick={() => onAssign('marzia')} className="px-3 py-1.5 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors font-medium">Marzia</button>
                      {item.assigned_to && (
                        <button onClick={() => onAssign(null)} className="px-3 py-1.5 text-xs bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition-colors">Rimuovi</button>
                      )}
                      <button onClick={onEditAssign} className="text-xs text-stone-400 hover:text-stone-600 ml-1">Annulla</button>
                    </div>
                  ) : (
                    <button onClick={onEditAssign} className="flex items-center gap-1.5 text-xs text-accent hover:text-mercury-800 font-medium">
                      <UserPlus size={14} /> {item.assigned_to ? 'Riassegna' : 'Assegna'}
                    </button>
                  )}
                </>
              )}
              <button onClick={onDelete} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 ml-auto">
                <Trash2 size={14} /> Elimina{item.is_used ? ' (con task collegato)' : ''}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
