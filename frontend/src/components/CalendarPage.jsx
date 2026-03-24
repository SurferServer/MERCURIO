import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { api } from '../api/client'
import { BRANDS, TYPES } from '../api/constants'
import Tag from './Tag'
import SmartThumb from './SmartThumb'

const MONTHS_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

const DAYS_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  // getDay() returns 0=Sun, we want 0=Mon
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const days = []
  // Fill leading empty slots
  for (let i = 0; i < startDow; i++) days.push(null)
  // Fill actual days
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d)
  return days
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [items, setItems] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)

  useEffect(() => {
    // Load active + archived content
    Promise.all([
      api.listContents(),
      api.listContents({ archived: true }),
    ]).then(([active, archived]) => {
      setItems([...active, ...archived])
    })
  }, [])

  const days = useMemo(() => getMonthDays(year, month), [year, month])

  // Group completed/archived items by completed_at day within the selected month
  const itemsByDay = useMemo(() => {
    const map = {}
    items.forEach(item => {
      if (!item.completed_at) return
      if (!['completato', 'archiviato'].includes(item.status)) return
      const d = new Date(item.completed_at)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate()
        if (!map[day]) map[day] = []
        map[day].push(item)
      }
    })
    return map
  }, [items, year, month])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
  }
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()) }

  const isToday = (day) => day && year === now.getFullYear() && month === now.getMonth() && day === now.getDate()

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1 text-stone-800">Calendario</h2>
      <p className="text-sm text-stone-500 mb-6">Contenuti completati nel mese</p>

      {/* Month navigation */}
      <div className="flex items-center gap-4 mb-5">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h3 className="text-lg font-bold text-stone-700 min-w-[200px] text-center">
          {MONTHS_IT[month]} {year}
        </h3>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
          <ChevronRight size={20} />
        </button>
        <button onClick={goToday} className="text-xs px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-600 font-medium">
          Oggi
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-white/90 backdrop-blur rounded-xl border border-stone-200 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-stone-200">
          {DAYS_IT.map(d => (
            <div key={d} className="text-center text-[11px] uppercase tracking-wide text-stone-500 font-semibold py-2.5 bg-stone-50">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dayItems = day ? (itemsByDay[day] || []) : []
            return (
              <div
                key={idx}
                className={`min-h-[120px] border-b border-r border-stone-100 p-1.5 ${
                  day ? '' : 'bg-stone-50/50'
                } ${isToday(day) ? 'bg-amber-50/60' : ''}`}
              >
                {day && (
                  <>
                    <div
                      className={`text-xs font-semibold mb-1 px-1 ${
                        isToday(day)
                          ? 'text-amber-700'
                          : dayItems.length > 0
                            ? 'text-stone-700'
                            : 'text-stone-400'
                      } ${dayItems.length > 0 ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (dayItems.length === 1) navigate(`/contenuto/${dayItems[0].id}`)
                        else if (dayItems.length > 1) setSelectedDay(day)
                      }}
                    >
                      {day}
                      {dayItems.length > 0 && (
                        <span className="ml-1 text-[10px] font-bold bg-accent/10 text-accent rounded-full px-1.5">
                          {dayItems.length}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {dayItems.slice(0, 3).map(item => {
                        const brand = BRANDS[item.brand] || {}
                        const type = TYPES[item.content_type] || {}
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-1 rounded-md p-0.5 hover:bg-stone-100 cursor-pointer transition-colors group"
                            onClick={() => {
                              if (dayItems.length === 1) navigate(`/contenuto/${item.id}`)
                              else setSelectedDay(day)
                            }}
                            title={item.title}
                          >
                            <SmartThumb item={item} size="xs" />
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-medium text-stone-700 truncate leading-tight">
                                {item.title}
                              </div>
                              <div className="flex gap-0.5 mt-0.5">
                                <span className={`text-[8px] px-1 rounded ${brand.bg || ''} ${brand.text || ''}`}>
                                  {brand.label}
                                </span>
                                <span className={`text-[8px] px-1 rounded ${type.bg || ''} ${type.text || ''}`}>
                                  {type.label}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      {dayItems.length > 3 && (
                        <div
                          className="text-[10px] text-accent font-medium pl-1 cursor-pointer hover:underline"
                          onClick={() => setSelectedDay(day)}
                        >
                          +{dayItems.length - 3} altr{dayItems.length - 3 === 1 ? 'o' : 'i'}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Day detail modal */}
      {selectedDay && itemsByDay[selectedDay] && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedDay(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
              <h3 className="text-base font-bold text-stone-800">
                {selectedDay} {MONTHS_IT[month]} {year}
                <span className="ml-2 text-sm font-normal text-stone-500">
                  {itemsByDay[selectedDay].length} contenut{itemsByDay[selectedDay].length === 1 ? 'o' : 'i'}
                </span>
              </h3>
              <button onClick={() => setSelectedDay(null)} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
                <X size={18} className="text-stone-500" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-4 space-y-2">
              {itemsByDay[selectedDay].map(item => {
                const brand = BRANDS[item.brand] || {}
                const type = TYPES[item.content_type] || {}
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 hover:bg-stone-50 hover:shadow-sm cursor-pointer transition-all"
                    onClick={() => { setSelectedDay(null); navigate(`/contenuto/${item.id}`) }}
                  >
                    <SmartThumb item={item} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-stone-800 truncate">{item.title}</div>
                      <div className="flex gap-1.5 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${brand.bg || ''} ${brand.text || ''}`}>
                          {brand.label}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${type.bg || ''} ${type.text || ''}`}>
                          {type.label}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-stone-300 shrink-0" />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Monthly summary */}
      {Object.keys(itemsByDay).length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(BRANDS).map(([key, brand]) => {
            const brandCount = items.filter(i =>
              i.brand === key &&
              i.completed_at &&
              ['completato', 'archiviato'].includes(i.status) &&
              new Date(i.completed_at).getFullYear() === year &&
              new Date(i.completed_at).getMonth() === month
            ).length
            if (brandCount === 0) return null
            return (
              <div key={key} className="bg-white/90 backdrop-blur rounded-xl p-4 border border-stone-200 border-l-4" style={{ borderLeftColor: brand.color }}>
                <div className="text-xs uppercase tracking-wide font-bold mb-1" style={{ color: brand.color }}>{brand.label}</div>
                <div className="text-2xl font-bold text-stone-800">{brandCount}</div>
                <div className="text-xs text-stone-400">contenuti completati</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
