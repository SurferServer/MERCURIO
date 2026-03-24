import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, Download, Save, Trash2, ExternalLink, Send, Clock } from 'lucide-react'
import { api } from '../api/client'
import { BRANDS, TYPES, CHANNELS, SOURCES, STATUSES } from '../api/constants'
import { useUser } from '../context/UserContext'
import Tag from './Tag'
import { Avatar } from './Tag'
import SmartThumb from './SmartThumb'

export default function ContentDetail({ showToast }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileInput = useRef(null)
  const { isAdmin, isMarketing, user, userId } = useUser()
  const [item, setItem] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [uploading, setUploading] = useState(false)
  const [activities, setActivities] = useState([])
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [thumbUrl, setThumbUrl] = useState(null)

  const loadAll = () => {
    api.getContent(id).then(data => {
      setItem(data)
      setForm({
        title: data.title,
        script: data.script || '',
        notes: data.notes || '',
        assigned_to: data.assigned_to || '',
        status: data.status,
        deadline: data.deadline ? data.deadline.split('T')[0] : '',
        drive_link: data.drive_link || '',
      })
      // Load real thumbnail if available
      if (data.has_thumbnail) {
        api.getThumbnail(id).then(url => {
          if (url) setThumbUrl(url)
        })
      } else {
        setThumbUrl(null)
      }
    }).catch(() => navigate('/board'))
    api.getActivities(id).then(setActivities).catch(() => {})
    api.getComments(id).then(setComments).catch(() => {})
  }

  useEffect(() => { loadAll() }, [id])

  if (!item) return <div className="text-stone-400 py-20 text-center">Caricamento...</div>

  const brand = BRANDS[item.brand] || {}
  const type = TYPES[item.content_type] || {}
  const channel = CHANNELS[item.channel] || {}
  const source = SOURCES[item.source] || {}
  const status = STATUSES.find(s => s.value === item.status) || { label: item.status, color: '#8a7260' }

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        assigned_to: form.assigned_to || null,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        drive_link: form.drive_link || null,
      }
      const updated = await api.updateContent(id, payload)
      setItem(updated)
      setEditing(false)
      showToast('Salvato!')
      loadAll()
    } catch (err) { showToast(err.message, 'error') }
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      await api.uploadFile(id, file)
      const updated = await api.getContent(id)
      setItem(updated)
      // Reload thumbnail after new upload
      if (updated.has_thumbnail) {
        const url = await api.getThumbnail(id)
        if (url) setThumbUrl(url)
      }
      showToast('File caricato!')
    } catch (err) { showToast('Upload fallito', 'error') }
    finally { setUploading(false) }
  }

  const handleDelete = async () => {
    if (!confirm('Eliminare questo contenuto?')) return
    await api.deleteContent(id)
    showToast('Eliminato')
    navigate('/board')
  }

  const handleComment = async () => {
    if (!newComment.trim()) return
    try {
      await api.addComment(id, { text: newComment })
      setNewComment('')
      api.getComments(id).then(setComments)
    } catch (err) { showToast('Errore invio commento', 'error') }
  }

  return (
    <div className="max-w-4xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 mb-6">
        <ArrowLeft size={16} /> Indietro
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/90 backdrop-blur rounded-xl border border-stone-200 p-7">
            {/* Header */}
            <div className="flex items-start gap-4 mb-6 pb-5 border-b border-stone-100">
              <SmartThumb item={item} size="sm" />
              <div className="flex-1">
                <div className="flex gap-2 mb-2 flex-wrap">
                  <Tag bg={brand.bg} text={brand.text}>{brand.label}</Tag>
                  <Tag bg={type.bg} text={type.text}>{type.label}</Tag>
                  <Tag bg={channel.bg} text={channel.text}>{channel.label}</Tag>
                  <Tag bg={source.bg} text={source.text}>{source.label}</Tag>
                </div>
                {editing ? (
                  <input value={form.title} onChange={set('title')} className="text-xl font-bold w-full border-b border-stone-300 pb-1 focus:outline-none focus:border-accent" />
                ) : (
                  <h2 className="text-xl font-bold text-stone-800">{item.title}</h2>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: status.color }} />
                <span className="text-sm font-medium text-stone-600">{status.label}</span>
              </div>
            </div>

            {/* Preview thumbnail */}
            {thumbUrl && (
              <div className="mb-6 rounded-lg overflow-hidden border border-stone-200 bg-stone-900 flex items-center justify-center">
                <img
                  src={thumbUrl}
                  alt={`Preview: ${item.title}`}
                  className="max-w-full max-h-[360px] object-contain"
                />
              </div>
            )}

            {/* Meta */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <div className="text-[11px] text-stone-500 uppercase tracking-wide mb-1">Assegnato a</div>
                {editing && isAdmin ? (
                  <select value={form.assigned_to} onChange={set('assigned_to')} className="w-full px-2 py-1 border border-stone-200 rounded text-sm">
                    <option value="">Non assegnato</option>
                    <option value="federico">Federico</option>
                    <option value="marzia">Marzia</option>
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <Avatar name={item.assigned_to} />
                    <span className="text-sm">{item.assigned_to ? item.assigned_to.charAt(0).toUpperCase() + item.assigned_to.slice(1) : 'Non assegnato'}</span>
                  </div>
                )}
              </div>
              <div>
                <div className="text-[11px] text-stone-500 uppercase tracking-wide mb-1">Stato</div>
                {editing && isAdmin ? (
                  <select value={form.status} onChange={set('status')} className="w-full px-2 py-1 border border-stone-200 rounded text-sm">
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    <option value="archiviato">Archiviato</option>
                  </select>
                ) : (
                  <span className="text-sm text-stone-700">{status.label}</span>
                )}
              </div>
              <div>
                <div className="text-[11px] text-stone-500 uppercase tracking-wide mb-1">Scadenza</div>
                {editing ? (
                  <input type="date" value={form.deadline} onChange={set('deadline')} className="w-full px-2 py-1 border border-stone-200 rounded text-sm" />
                ) : (
                  <span className="text-sm text-stone-700">{item.deadline ? new Date(item.deadline).toLocaleDateString('it-IT') : '—'}</span>
                )}
              </div>
              <div>
                <div className="text-[11px] text-stone-500 uppercase tracking-wide mb-1">Creato</div>
                <span className="text-sm text-stone-700">{new Date(item.created_at).toLocaleDateString('it-IT')}</span>
              </div>
            </div>

            {/* Script */}
            <div className="mb-6">
              <div className="text-[11px] text-stone-500 uppercase tracking-wide mb-2">Script / Brief</div>
              {editing ? (
                <textarea value={form.script} onChange={set('script')} rows={8} className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm resize-y focus:outline-none focus:border-accent" />
              ) : (
                <div className="bg-stone-50 rounded-lg p-4 text-sm whitespace-pre-wrap min-h-[60px] text-stone-700">
                  {item.script || <span className="text-stone-400 italic">Nessuno script inserito</span>}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="mb-6">
              <div className="text-[11px] text-stone-500 uppercase tracking-wide mb-2">Note</div>
              {editing ? (
                <textarea value={form.notes} onChange={set('notes')} rows={3} className="w-full px-4 py-3 border border-stone-200 rounded-lg text-sm resize-y focus:outline-none focus:border-accent" />
              ) : (
                <div className="bg-stone-50 rounded-lg p-4 text-sm whitespace-pre-wrap min-h-[40px] text-stone-700">
                  {item.notes || <span className="text-stone-400 italic">Nessuna nota</span>}
                </div>
              )}
            </div>

            {/* Drive link */}
            {editing && (
              <div className="mb-6">
                <div className="text-[11px] text-stone-500 uppercase tracking-wide mb-2">Link Google Drive</div>
                <input value={form.drive_link} onChange={set('drive_link')} placeholder="https://drive.google.com/..." className="w-full px-4 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-accent" />
              </div>
            )}
            {!editing && item.drive_link && (
              <div className="mb-6">
                <div className="text-[11px] text-stone-500 uppercase tracking-wide mb-2">Google Drive</div>
                <a href={item.drive_link} target="_blank" rel="noopener" className="text-sm text-accent hover:underline flex items-center gap-1">
                  <ExternalLink size={14} /> Apri su Drive
                </a>
              </div>
            )}

            {/* File */}
            <div className="mb-6">
              <div className="text-[11px] text-stone-500 uppercase tracking-wide mb-2">File allegato</div>
              {item.file_name ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-stone-700">{item.file_name}</span>
                  <button
                    onClick={async () => {
                      try {
                        const url = await api.downloadFile(item.id)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = item.file_name || 'download'
                        a.click()
                        URL.revokeObjectURL(url)
                      } catch { showToast('Download fallito', 'error') }
                    }}
                    className="flex items-center gap-1 text-sm text-accent hover:underline"
                  >
                    <Download size={14} /> Scarica
                  </button>
                </div>
              ) : (
                <span className="text-sm text-stone-400">Nessun file</span>
              )}
              {!isMarketing && (
                <div className="mt-2">
                  <input type="file" ref={fileInput} onChange={handleUpload} className="hidden" />
                  <button
                    onClick={() => fileInput.current.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2 text-sm border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
                  >
                    <Upload size={15} /> {uploading ? 'Caricamento...' : 'Carica file'}
                  </button>
                </div>
              )}
            </div>

            {/* Actions */}
            {!isMarketing && (
              <div className="flex justify-between items-center pt-5 border-t border-stone-100">
                {isAdmin ? (
                  <button onClick={handleDelete} className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700">
                    <Trash2 size={15} /> Elimina
                  </button>
                ) : <div />}
                <div className="flex gap-3">
                  {editing ? (
                    <>
                      <button onClick={() => setEditing(false)} className="px-5 py-2 text-sm border border-stone-200 rounded-lg hover:bg-stone-50">Annulla</button>
                      <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-accent text-white rounded-lg hover:bg-mercury-800">
                        <Save size={15} /> Salva
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setEditing(true)} className="px-5 py-2 text-sm font-medium bg-sidebar text-white rounded-lg hover:bg-stone-800">
                      Modifica
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Timeline & Comments */}
        <div className="space-y-6">
          {/* Timeline */}
          <div className="bg-white/90 backdrop-blur rounded-xl border border-stone-200 p-5">
            <h3 className="text-sm font-semibold text-stone-700 mb-4 flex items-center gap-2">
              <Clock size={16} /> Cronologia
            </h3>
            {activities.length === 0 ? (
              <p className="text-sm text-stone-400">Nessuna attività registrata.</p>
            ) : (
              <div className="space-y-3">
                {activities.map(act => (
                  <div key={act.id} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-mercury-400 mt-1.5 shrink-0" />
                    <div>
                      <div className="text-sm text-stone-700">{act.action}</div>
                      <div className="text-[11px] text-stone-400">{new Date(act.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="bg-white/90 backdrop-blur rounded-xl border border-stone-200 p-5">
            <h3 className="text-sm font-semibold text-stone-700 mb-4">Commenti</h3>
            {comments.length === 0 && (
              <p className="text-sm text-stone-400 mb-4">Nessun commento.</p>
            )}
            <div className="space-y-3 mb-4">
              {comments.map(c => (
                <div key={c.id} className="bg-stone-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-stone-700">{c.author}</span>
                    <span className="text-[10px] text-stone-400">{new Date(c.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm text-stone-600">{c.text}</p>
                </div>
              ))}
            </div>
            {!isMarketing && (
              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleComment()}
                  placeholder="Scrivi un commento..."
                  className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-accent"
                />
                <button onClick={handleComment} className="px-3 py-2 bg-accent text-white rounded-lg hover:bg-mercury-800 transition-colors">
                  <Send size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
