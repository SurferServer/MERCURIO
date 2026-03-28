import React, { useEffect, useState } from 'react'
import { FileText, Plus, ChevronDown, ChevronUp, Trash2, UserPlus, X, Layers, ArrowUpDown, Calendar, Printer } from 'lucide-react'
import { api } from '../api/client'
import { useUser } from '../context/UserContext'
import { BRANDS, STATUSES } from '../api/constants'
import Tag from './Tag'
import { Avatar } from './Tag'

const BRIEF_TYPES = {
  script: { label: 'Script', bg: 'bg-blue-50', text: 'text-blue-700' },
  brief: { label: 'Brief', bg: 'bg-purple-50', text: 'text-purple-700' },
}

export default function ScriptBriefPage({ showToast }) {
  const { isAdmin, isMarketing } = useUser()
  const [items, setItems] = useState([])
  const [filters, setFilters] = useState({ brief_type: '', brand: '', assigned_to: '' })
  const [sortOrder, setSortOrder] = useState('date_desc')
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [editingAssign, setEditingAssign] = useState(null)

  const [form, setForm] = useState({
    title: '', brief_type: 'script', brand: '', content: '', notes: '', assigned_to: '',
  })
  const [batchMode, setBatchMode] = useState(false)
  const [batchItems, setBatchItems] = useState([{ title: '', content: '' }])
  const [batchSubmitting, setBatchSubmitting] = useState(false)

  const load = () => {
    const params = { ...filters, hide_archived: true }
    if (sortOrder === 'date_asc') params.sort = 'date_asc'
    api.listScriptBriefs(params).then(setItems).catch(() => {})
  }

  useEffect(() => { load() }, [filters, sortOrder])

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
        assigned_to: isMarketing ? null : (form.assigned_to || null),
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

  const handleBatchCreate = async () => {
    if (!form.brand) {
      showToast('Seleziona il brand', 'error')
      return
    }
    const validItems = batchItems.filter(i => i.title.trim() && i.content.trim())
    if (validItems.length === 0) {
      showToast('Inserisci almeno uno script con titolo e contenuto', 'error')
      return
    }
    setBatchSubmitting(true)
    try {
      const result = await api.createScriptBriefBatch({
        brief_type: form.brief_type,
        brand: form.brand,
        notes: form.notes || null,
        items: validItems,
      })
      showToast(`${result.length} script/brief creati — ${result.length} task in assegnazione!`)
      setShowCreate(false)
      setBatchMode(false)
      setBatchItems([{ title: '', content: '' }])
      setForm({ title: '', brief_type: 'script', brand: '', content: '', notes: '', assigned_to: '' })
      load()
    } catch (err) { showToast(err.message, 'error') }
    finally { setBatchSubmitting(false) }
  }

  const updateBatchItem = (index, field, value) => {
    setBatchItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const addBatchItem = () => {
    setBatchItems(prev => [...prev, { title: '', content: '' }])
  }

  const removeBatchItem = (index) => {
    if (batchItems.length <= 1) return
    setBatchItems(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Script & Brief</h2>
          <p className="text-sm text-stone-500">Gestisci script per i video e brief per le statiche</p>
        </div>
        {(isAdmin || isMarketing) && (
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
      {showCreate && (isAdmin || isMarketing) && (
        <div className="bg-white/90 backdrop-blur rounded-2xl border border-stone-100 shadow-soft p-6 mb-6">
          {/* Mode toggle */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-stone-700">
              {batchMode ? 'Creazione multipla' : 'Nuovo Script / Brief'}
            </h3>
            <button
              onClick={() => setBatchMode(!batchMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                batchMode
                  ? 'bg-accent/10 text-accent border border-accent/30'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {batchMode ? <FileText size={13} /> : <Layers size={13} />}
              {batchMode ? 'Singolo' : 'Multiplo'}
            </button>
          </div>

          {/* Common fields (shared between single and batch) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {!batchMode && (
              <div>
                <label className="text-[11px] text-stone-500 uppercase tracking-wide mb-1 block">Titolo *</label>
                <input value={form.title} onChange={set('title')} placeholder="es. Script Reel Guida e Vai" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-accent" />
              </div>
            )}
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

          {/* Single mode content */}
          {!batchMode && (
            <>
              <div className="mb-4">
                <label className="text-[11px] text-stone-500 uppercase tracking-wide mb-1 block">Contenuto *</label>
                <textarea value={form.content} onChange={set('content')} rows={6} placeholder="Scrivi lo script o il brief..." className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm resize-y focus:outline-none focus:border-accent" />
              </div>
              <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-2' : ''} gap-4 mb-5`}>
                <div>
                  <label className="text-[11px] text-stone-500 uppercase tracking-wide mb-1 block">Note (opzionale)</label>
                  <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Note aggiuntive..." className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm resize-y focus:outline-none focus:border-accent" />
                </div>
                {isAdmin && (
                  <div>
                    <label className="text-[11px] text-stone-500 uppercase tracking-wide mb-1 block">Assegna a (opzionale)</label>
                    <select value={form.assigned_to} onChange={set('assigned_to')} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm">
                      <option value="">Non assegnato</option>
                      <option value="fulvio">Fulvio</option>
                      <option value="federico">Federico</option>
                      <option value="marzia">Marzia</option>
                    </select>
                  </div>
                )}
              </div>
              <button onClick={handleCreate} className="px-6 py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-mercury-800 transition-colors">
                {isMarketing ? 'Crea e manda in Assegnazione' : 'Crea Script/Brief'}
              </button>
            </>
          )}

          {/* Batch mode */}
          {batchMode && (
            <>
              <div className="mb-4">
                <label className="text-[11px] text-stone-500 uppercase tracking-wide mb-1 block">Note condivise (opzionale)</label>
                <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Note comuni a tutti gli script..." className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm resize-y focus:outline-none focus:border-accent" />
              </div>

              <div className="mb-2">
                <div className="text-[11px] text-stone-500 uppercase tracking-wide mb-2">
                  Script / Brief ({batchItems.length})
                </div>
                <p className="text-xs text-stone-400 mb-3">Ogni elemento genererà un task separato in "Da Assegnare".</p>
              </div>

              <div className="space-y-3 mb-4">
                {batchItems.map((item, i) => (
                  <div key={i} className="border border-stone-200 rounded-xl p-4 bg-stone-50/50 relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-stone-500">#{i + 1}</span>
                      {batchItems.length > 1 && (
                        <button
                          onClick={() => removeBatchItem(i)}
                          className="text-stone-400 hover:text-red-500 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <div className="mb-2">
                      <input
                        value={item.title}
                        onChange={e => updateBatchItem(i, 'title', e.target.value)}
                        placeholder="Titolo *"
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-accent bg-white"
                      />
                    </div>
                    <textarea
                      value={item.content}
                      onChange={e => updateBatchItem(i, 'content', e.target.value)}
                      rows={4}
                      placeholder="Contenuto dello script / brief *"
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm resize-y focus:outline-none focus:border-accent bg-white"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={addBatchItem}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium border border-dashed border-stone-300 rounded-lg text-stone-600 hover:border-accent hover:text-accent transition-colors"
                >
                  <Plus size={14} /> Aggiungi script
                </button>

                <button
                  onClick={handleBatchCreate}
                  disabled={batchSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-mercury-800 transition-colors disabled:opacity-50 ml-auto"
                >
                  {batchSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creazione...
                    </>
                  ) : (
                    <>
                      <Layers size={15} />
                      Crea {batchItems.filter(i => i.title.trim() && i.content.trim()).length} task
                    </>
                  )}
                </button>
              </div>
            </>
          )}
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
          <option value="fulvio">Fulvio</option>
          <option value="federico">Federico</option>
          <option value="marzia">Marzia</option>
        </select>
        <button
          onClick={() => setSortOrder(s => s === 'date_desc' ? 'date_asc' : 'date_desc')}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-stone-200 rounded-lg text-sm bg-white/80 hover:bg-stone-50 transition-colors text-stone-600"
          title={sortOrder === 'date_desc' ? 'Più recenti prima' : 'Più vecchi prima'}
        >
          <ArrowUpDown size={14} />
          {sortOrder === 'date_desc' ? 'Recenti' : 'Vecchi'}
        </button>
        <div className="ml-auto text-xs text-stone-400">
          {items.length} attiv{items.length === 1 ? 'o' : 'i'}
        </div>
      </div>

      {/* Script/Brief list — only active tasks (not completed/archived) */}
      {items.length === 0 && (
        <div className="bg-white/90 backdrop-blur rounded-2xl border border-stone-100 shadow-soft p-12 text-center">
          <FileText size={40} className="mx-auto text-stone-300 mb-3" />
          <div className="text-stone-500 text-sm">Nessuno script o brief attivo.</div>
          {(isAdmin || isMarketing) && <div className="text-stone-400 text-xs mt-1">Clicca "Nuovo" per crearne uno.</div>}
          <div className="text-stone-400 text-xs mt-1">Gli script completati o archiviati non vengono mostrati.</div>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map(item => (
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
      )}
    </div>
  )
}

const TASK_STATUS_STYLES = {
  'da-assegnare': { label: 'Da Assegnare', bg: 'bg-orange-100', text: 'text-orange-700' },
  'in-lavorazione': { label: 'In Lavorazione', bg: 'bg-amber-100', text: 'text-amber-700' },
  'in-revisione': { label: 'In Revisione', bg: 'bg-pink-100', text: 'text-pink-700' },
  'completato': { label: 'Completato', bg: 'bg-green-100', text: 'text-green-700' },
}

function handlePrint(item) {
  const brandLabel = BRANDS[item.brand]?.label || item.brand
  const typeLabel = BRIEF_TYPES[item.brief_type]?.label || item.brief_type
  const date = new Date(item.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
  const w = window.open('', '_blank', 'width=800,height=600')
  if (!w) return
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${item.title}</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 24px; color: #1c1917; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .meta { font-size: 13px; color: #78716c; margin-bottom: 24px; }
  .meta span { margin-right: 16px; }
  .content { font-size: 14px; line-height: 1.7; white-space: pre-wrap; background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 20px; }
  .notes { margin-top: 20px; font-size: 13px; color: #57534e; border-top: 1px solid #e7e5e4; padding-top: 16px; }
  .notes strong { color: #1c1917; }
  @media print { body { margin: 20px; } }
</style></head><body>
<h1>${item.title}</h1>
<div class="meta">
  <span>${typeLabel}</span>
  <span>${brandLabel}</span>
  <span>${date}</span>
  ${item.assigned_to ? `<span>Assegnato a: ${item.assigned_to.charAt(0).toUpperCase() + item.assigned_to.slice(1)}</span>` : ''}
</div>
<div class="content">${item.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
${item.notes ? `<div class="notes"><strong>Note:</strong> ${item.notes.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>` : ''}
</body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}

function ScriptBriefCard({ item, isAdmin, expanded, onToggle, editingAssign, onEditAssign, onAssign, onDelete }) {
  const brand = BRANDS[item.brand] || {}
  const typeInfo = BRIEF_TYPES[item.brief_type] || {}
  const taskStatus = item.task_status ? TASK_STATUS_STYLES[item.task_status] : null

  return (
    <div className="bg-white/90 backdrop-blur rounded-2xl border border-stone-100 shadow-soft overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-stone-50/50 transition-colors" onClick={onToggle}>
        <FileText size={18} className="text-stone-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-stone-700 truncate">{item.title}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-stone-400 flex items-center gap-1">
              <Calendar size={10} />
              {new Date(item.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); handlePrint(item) }}
            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors"
            title="Stampa"
          >
            <Printer size={15} />
          </button>
          {taskStatus && <Tag bg={taskStatus.bg} text={taskStatus.text}>{taskStatus.label}</Tag>}
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
