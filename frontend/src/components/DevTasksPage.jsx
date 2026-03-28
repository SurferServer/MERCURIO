import React, { useEffect, useState } from 'react'
import { Code2, Plus, X, Check, Clock, Trash2, RotateCcw } from 'lucide-react'
import { api } from '../api/client'
import { useUser } from '../context/UserContext'

export default function DevTasksPage({ showToast }) {
  const { userId } = useUser()
  const isFederico = userId === 'federico'
  const [tasks, setTasks] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', estimated_hours: '' })

  const load = () => {
    api.listDevTasks().then(setTasks).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleCreate = async () => {
    if (!form.title.trim()) {
      showToast('Inserisci un titolo per il task', 'error')
      return
    }
    try {
      await api.createDevTask({
        title: form.title,
        description: form.description || null,
        estimated_hours: form.estimated_hours ? parseInt(form.estimated_hours) : null,
      })
      showToast('Task di sviluppo creato!')
      setShowCreate(false)
      setForm({ title: '', description: '', estimated_hours: '' })
      load()
    } catch (err) { showToast(err.message, 'error') }
  }

  const handleComplete = async (id) => {
    try {
      await api.updateDevTask(id, { status: 'completato' })
      showToast('Task completato!')
      load()
    } catch (err) { showToast(err.message, 'error') }
  }

  const handleReopen = async (id) => {
    try {
      await api.updateDevTask(id, { status: 'in-corso' })
      showToast('Task riaperto')
      load()
    } catch (err) { showToast(err.message, 'error') }
  }

  const handleDelete = async (id) => {
    if (!confirm('Eliminare questo task di sviluppo?')) return
    try {
      await api.deleteDevTask(id)
      showToast('Task eliminato')
      load()
    } catch (err) { showToast(err.message, 'error') }
  }

  const active = tasks.filter(t => t.status === 'in-corso')
  const completed = tasks.filter(t => t.status === 'completato')

  const inputCls = "w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm bg-white/80 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
            <Code2 size={24} className="text-orange-500" />
            Sviluppo
          </h2>
          <p className="text-sm text-stone-500">Task di programmazione di Federico</p>
        </div>
        {isFederico && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors"
          >
            {showCreate ? <X size={16} /> : <Plus size={16} />}
            {showCreate ? 'Chiudi' : 'Nuovo Task'}
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreate && isFederico && (
        <div className="bg-white/90 backdrop-blur rounded-2xl border border-stone-100 shadow-soft p-6 mb-6">
          <h3 className="text-sm font-semibold text-stone-700 mb-4">Nuovo Task di Sviluppo</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="text-[11px] text-stone-500 uppercase tracking-wide mb-1 block">Cosa stai sviluppando? *</label>
              <input value={form.title} onChange={set('title')} placeholder="es. Integrazione API Google Drive" className={inputCls} />
            </div>
            <div>
              <label className="text-[11px] text-stone-500 uppercase tracking-wide mb-1 block">Tempo stimato (ore)</label>
              <input type="number" min="1" value={form.estimated_hours} onChange={set('estimated_hours')} placeholder="es. 8" className={inputCls} />
            </div>
          </div>
          <div className="mb-5">
            <label className="text-[11px] text-stone-500 uppercase tracking-wide mb-1 block">Dettagli (opzionale)</label>
            <textarea value={form.description} onChange={set('description')} rows={3} placeholder="Descrivi cosa devi fare, quale parte del codice tocchi, eventuali dipendenze..." className={`${inputCls} resize-y`} />
          </div>
          <button onClick={handleCreate} className="px-6 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors">
            Crea Task
          </button>
        </div>
      )}

      {/* Active tasks */}
      {active.length === 0 && completed.length === 0 && (
        <div className="bg-white/90 backdrop-blur rounded-2xl border border-stone-100 shadow-soft p-12 text-center">
          <Code2 size={40} className="mx-auto text-stone-300 mb-3" />
          <div className="text-stone-500 text-sm">Nessun task di sviluppo presente.</div>
          {isFederico && <div className="text-stone-400 text-xs mt-1">Clicca "Nuovo Task" per aggiungerne uno.</div>}
        </div>
      )}

      {active.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wide text-orange-500 mb-3 flex items-center gap-2">
            <Clock size={14} /> In corso ({active.length})
          </h3>
          <div className="space-y-2">
            {active.map(task => (
              <div key={task.id} className="bg-white/90 backdrop-blur rounded-xl border border-orange-200 border-l-4 border-l-orange-400 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-stone-700">{task.title}</div>
                    {task.description && (
                      <div className="text-xs text-stone-500 mt-1 whitespace-pre-wrap">{task.description}</div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-stone-400">
                      <span>Creato: {new Date(task.created_at).toLocaleDateString('it-IT')}</span>
                      {task.estimated_hours && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> ~{task.estimated_hours}h stimate
                        </span>
                      )}
                    </div>
                  </div>
                  {isFederico && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => handleComplete(task.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium" title="Segna come completato">
                        <Check size={14} /> Fatto
                      </button>
                      <button onClick={() => handleDelete(task.id)} className="p-1.5 text-stone-400 hover:text-red-500 transition-colors" title="Elimina">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-stone-400 mb-3 flex items-center gap-2">
            <Check size={14} /> Completati ({completed.length})
          </h3>
          <div className="space-y-2">
            {completed.map(task => (
              <div key={task.id} className="bg-white/90 backdrop-blur rounded-2xl border border-stone-100 shadow-soft px-5 py-4 opacity-70">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-stone-500 line-through">{task.title}</div>
                    {task.description && (
                      <div className="text-xs text-stone-400 mt-1 whitespace-pre-wrap">{task.description}</div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-stone-400">
                      <span>Creato: {new Date(task.created_at).toLocaleDateString('it-IT')}</span>
                      {task.completed_at && (
                        <span>Completato: {new Date(task.completed_at).toLocaleDateString('it-IT')}</span>
                      )}
                      {task.estimated_hours && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> ~{task.estimated_hours}h
                        </span>
                      )}
                    </div>
                  </div>
                  {isFederico && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => handleReopen(task.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition-colors font-medium" title="Riapri task">
                        <RotateCcw size={14} /> Riapri
                      </button>
                      <button onClick={() => handleDelete(task.id)} className="p-1.5 text-stone-400 hover:text-red-500 transition-colors" title="Elimina">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
