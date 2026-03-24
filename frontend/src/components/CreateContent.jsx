import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, RotateCcw, FileText } from 'lucide-react'
import { api } from '../api/client'
import { BRANDS } from '../api/constants'

const EMPTY = {
  title: '',
  brand: 'guida-e-vai',
  content_type: 'video',
  channel: 'organico',
  source: 'interno',
  assigned_to: '',
  script: '',
  notes: '',
  deadline: '',
  script_brief_id: '',
}

export default function CreateContent({ showToast }) {
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [scriptBriefs, setScriptBriefs] = useState([])
  const navigate = useNavigate()

  // Load available script/briefs
  useEffect(() => {
    api.listScriptBriefs({ available: true }).then(setScriptBriefs).catch(() => {})
  }, [])

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSelectScriptBrief = (e) => {
    const sbId = e.target.value
    if (!sbId) {
      setForm({ ...form, script_brief_id: '' })
      return
    }
    const sb = scriptBriefs.find(s => s.id === parseInt(sbId))
    if (sb) {
      setForm({
        ...form,
        script_brief_id: sbId,
        script: sb.content,
        brand: sb.brand,
        content_type: sb.brief_type === 'script' ? 'video' : 'grafica',
        assigned_to: sb.assigned_to || form.assigned_to,
        notes: sb.notes ? (form.notes ? form.notes + '\n' + sb.notes : sb.notes) : form.notes,
      })
    }
  }

  // Filter script/briefs matching selected brand
  const filteredSB = scriptBriefs.filter(sb =>
    !form.brand || sb.brand === form.brand
  )

  const handleSave = async () => {
    if (!form.title.trim()) {
      showToast('Inserisci un titolo', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        assigned_to: form.assigned_to || null,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        script_brief_id: form.script_brief_id ? parseInt(form.script_brief_id) : null,
      }
      const created = await api.createContent(payload)
      showToast('Contenuto salvato!')
      setForm({ ...EMPTY })
      navigate(`/contenuto/${created.id}`)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm bg-white/80 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1 text-stone-800">Crea Contenuto</h2>
      <p className="text-sm text-stone-500 mb-6">Nuovo script video, grafica statica o richiesta marketing</p>

      <div className="bg-white/90 backdrop-blur rounded-xl border border-stone-200 p-7">
        <h3 className="text-base font-semibold mb-6 pb-4 border-b border-stone-100 text-stone-700">Nuovo Contenuto</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-1.5 text-stone-700">Titolo *</label>
            <input type="text" value={form.title} onChange={set('title')} placeholder="Es: Reel promo estate 2026" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-stone-700">Brand *</label>
            <select value={form.brand} onChange={set('brand')} className={inputCls}>
              <option value="guida-e-vai">Guida e Vai</option>
              <option value="quiz-patente">Quiz Patente</option>
              <option value="rinnovala">Rinnovala</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-stone-700">Tipo *</label>
            <select value={form.content_type} onChange={set('content_type')} className={inputCls}>
              <option value="video">Video</option>
              <option value="grafica">Grafica Statica</option>
              <option value="sviluppo">Sviluppo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-stone-700">Canale *</label>
            <select value={form.channel} onChange={set('channel')} className={inputCls}>
              <option value="organico">Organico</option>
              <option value="adv">ADV</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-stone-700">Origine</label>
            <select value={form.source} onChange={set('source')} className={inputCls}>
              <option value="interno">Interno (scritto da me)</option>
              <option value="marketing">Richiesta Marketing</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-stone-700">Assegna a</label>
            <select value={form.assigned_to} onChange={set('assigned_to')} className={inputCls}>
              <option value="">Non assegnato</option>
              <option value="federico">Federico</option>
              <option value="marzia">Marzia</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5 text-stone-700">Scadenza</label>
            <input type="date" value={form.deadline} onChange={set('deadline')} className={inputCls} />
          </div>
          {scriptBriefs.length > 0 && (
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold mb-1.5 text-stone-700">
                <FileText size={14} className="inline mr-1.5 -mt-0.5" />
                Collega Script / Brief esistente
              </label>
              <select value={form.script_brief_id} onChange={handleSelectScriptBrief} className={inputCls}>
                <option value="">Nessuno (scrivi manualmente)</option>
                {filteredSB.map(sb => (
                  <option key={sb.id} value={sb.id}>
                    [{sb.brief_type === 'script' ? 'Script' : 'Brief'}] {sb.title}
                    {sb.assigned_to ? ` — ${sb.assigned_to}` : ''}
                  </option>
                ))}
              </select>
              {form.script_brief_id && (
                <p className="text-xs text-accent mt-1">Lo script/brief selezionato verrà collegato a questo contenuto.</p>
              )}
            </div>
          )}
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-1.5 text-stone-700">Script / Brief</label>
            <textarea value={form.script} onChange={set('script')} placeholder="Scrivi qui lo script del video o il brief della grafica..." rows={6} className={`${inputCls} resize-y`} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-1.5 text-stone-700">Note aggiuntive</label>
            <textarea value={form.notes} onChange={set('notes')} placeholder="Riferimenti, link, indicazioni specifiche..." rows={3} className={`${inputCls} resize-y`} />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-stone-100">
          <button onClick={() => setForm({ ...EMPTY })} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium border border-stone-200 hover:bg-stone-50 transition-colors">
            <RotateCcw size={15} /> Annulla
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-mercury-800 disabled:opacity-50 transition-colors">
            <Save size={15} /> {saving ? 'Salvataggio...' : 'Salva Contenuto'}
          </button>
        </div>
      </div>
    </div>
  )
}
