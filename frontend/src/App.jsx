import React, { useState, useEffect } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, Columns3, Archive, Image, LogOut, FileText, CalendarDays, MessageSquare } from 'lucide-react'
import { useUser } from './context/UserContext'
import { setAuthToken } from './api/client'
import UserPicker from './components/UserPicker'
import HalftoneBackground from './components/HalftoneBackground'
import Dashboard from './components/Dashboard'
import CreateContent from './components/CreateContent'
import Board from './components/Board'
import Gallery from './components/Gallery'
import ArchivePage from './components/ArchivePage'
import ContentDetail from './components/ContentDetail'
import ScriptBriefPage from './components/ScriptBriefPage'
import CalendarPage from './components/CalendarPage'
import PopupAdmin from './components/PopupAdmin'
import DailyPopupModal from './components/DailyPopupModal'
import Toast from './components/Toast'

function SidebarAvatar({ userId, user }) {
  const [imgError, setImgError] = React.useState(false)
  const cacheBuster = window.__avatarCacheBuster || ''
  if (!imgError) {
    return (
      <img
        src={`/avatars/${userId}.jpg${cacheBuster ? '?v=' + cacheBuster : ''}`}
        alt={user.name}
        onError={() => setImgError(true)}
        className="w-8 h-8 rounded-full object-cover"
      />
    )
  }
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
      style={{ background: user.color }}
    >
      {user.initials}
    </div>
  )
}

export default function App() {
  const { user, userId, isAdmin, isMarketing, logout, token } = useUser()
  const [toast, setToast] = useState(null)

  // Sync auth token with API client whenever it changes
  useEffect(() => {
    setAuthToken(token)
  }, [token])

  // Handle forced logout on 401
  useEffect(() => {
    const handler = () => {
      logout()
      setToast({ msg: 'Sessione scaduta. Effettua nuovamente l\'accesso.', type: 'error' })
    }
    window.addEventListener('mercurio:unauthorized', handler)
    return () => window.removeEventListener('mercurio:unauthorized', handler)
  }, [logout])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  if (!user) return <UserPicker />

  const isCollaborator = !isAdmin && !isMarketing

  const navItems = isMarketing
    ? [
        { to: '/script-brief', icon: FileText, label: 'Script / Brief' },
        { to: '/calendario', icon: CalendarDays, label: 'Calendario' },
        { to: '/galleria', icon: Image, label: 'Galleria' },
        { to: '/archivio', icon: Archive, label: 'Archivio' },
      ]
    : [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/script-brief', icon: FileText, label: 'Script / Brief' },
        { to: '/nuovo', icon: PlusCircle, label: 'Crea Contenuto' },
        { to: '/board', icon: Columns3, label: 'Board Lavori', highlight: true },
        { to: '/calendario', icon: CalendarDays, label: 'Calendario' },
        { to: '/galleria', icon: Image, label: 'Galleria' },
        { to: '/archivio', icon: Archive, label: 'Archivio' },
      ]

  return (
    <>
      <HalftoneBackground opacity={0.35} />
      <div className="flex h-screen relative z-10">
        {/* Sidebar */}
        <nav className="w-60 bg-sidebar text-white flex flex-col shrink-0 relative overflow-hidden">
          <div className="px-6 py-5 border-b border-white/10 relative z-10">
            <h1 className="text-xl font-black tracking-tight text-mercury-400">MERCURIO</h1>
            <span className="text-[10px] text-white/40 uppercase tracking-widest">Gestione Contenuti</span>
          </div>
          <div className="flex-1 py-2 relative z-10 overflow-y-auto">
            {navItems.map(({ to, icon: Icon, label, highlight }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  highlight
                    ? `flex items-center gap-3 mx-3 my-1 px-4 py-3.5 text-[15px] font-bold rounded-xl transition-all border-l-0 ${
                        isActive
                          ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                          : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/40 hover:text-amber-200'
                      }`
                    : `flex items-center gap-3 px-6 py-3 text-sm transition-colors border-l-[3px] ${
                        isActive
                          ? 'bg-mercury-500/15 text-mercury-400 border-mercury-500'
                          : 'text-white/50 border-transparent hover:bg-white/5 hover:text-white/80'
                      }`
                }
              >
                <Icon size={highlight ? 22 : 18} />
                {label}
              </NavLink>
            ))}

            {/* Admin-only: Popup management links */}
            {isAdmin && (
              <div className="mt-4 pt-3 mx-4 border-t border-white/10">
                <div className="text-[9px] text-white/25 uppercase tracking-widest px-2 mb-2">Comunicazioni</div>
                <NavLink
                  to="/popup/federico"
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors ${
                      isActive
                        ? 'bg-orange-500/20 text-orange-300'
                        : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                    }`
                  }
                >
                  <MessageSquare size={14} />
                  Popup Federico
                </NavLink>
                <NavLink
                  to="/popup/marzia"
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors ${
                      isActive
                        ? 'bg-red-500/20 text-red-300'
                        : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                    }`
                  }
                >
                  <MessageSquare size={14} />
                  Popup Marzia
                </NavLink>
              </div>
            )}
          </div>
          <div className="p-4 border-t border-white/10 relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <SidebarAvatar userId={userId} user={user} />
              <div>
                <div className="text-sm font-medium text-white/80">{user.name}</div>
                <div className="text-[10px] text-white/30">{isAdmin ? 'Responsabile' : isMarketing ? 'Ufficio Marketing' : 'Collaboratore'}</div>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              <LogOut size={12} /> Cambia utente
            </button>
          </div>
        </nav>

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-8" style={{ background: 'rgba(254, 252, 248, 0.55)' }}>
          <Routes>
            <Route path="/" element={<Navigate to={isMarketing ? '/calendario' : '/dashboard'} replace />} />
            {!isMarketing && <Route path="/dashboard" element={<Dashboard showToast={showToast} />} />}
            <Route path="/script-brief" element={<ScriptBriefPage showToast={showToast} />} />
            {!isMarketing && <Route path="/nuovo" element={<CreateContent showToast={showToast} />} />}
            {!isMarketing && <Route path="/board" element={<Board showToast={showToast} />} />}
            <Route path="/calendario" element={<CalendarPage />} />
            <Route path="/galleria" element={<Gallery />} />
            <Route path="/archivio" element={<ArchivePage showToast={showToast} />} />
            <Route path="/contenuto/:id" element={<ContentDetail showToast={showToast} />} />
            {isAdmin && <Route path="/popup/:targetUser" element={<PopupAdmin showToast={showToast} />} />}
          </Routes>
        </main>

        {/* Daily popup for collaborators — shows once per day on first login */}
        {isCollaborator && <DailyPopupModal />}

        {toast && <Toast message={toast.msg} type={toast.type} />}
      </div>
    </>
  )
}
