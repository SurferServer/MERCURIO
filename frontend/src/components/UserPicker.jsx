import React, { useState } from 'react'
import { USERS, useUser } from '../context/UserContext'
import HalftoneBackground from './HalftoneBackground'
import { Lock } from 'lucide-react'

const ROLE_LABELS = {
  admin: 'Responsabile',
  collaborator: 'Collaboratore',
  marketing: 'Ufficio Marketing',
}

export default function UserPicker() {
  const { login, loginError } = useUser()
  const [selectedUser, setSelectedUser] = useState(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSelectUser = (id) => {
    setSelectedUser(id)
    setPassword('')
    setError(null)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!selectedUser || !password) return
    setLoading(true)
    setError(null)
    try {
      await login(selectedUser, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setSelectedUser(null)
    setPassword('')
    setError(null)
  }

  return (
    <>
      <HalftoneBackground opacity={0.4} />
      <div className="h-screen flex flex-col items-center justify-center relative z-10">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black tracking-tight text-stone-800 mb-1">MERCURIO</h1>
          <p className="text-sm text-stone-500">
            {selectedUser ? 'Inserisci la password per accedere' : 'Seleziona il tuo profilo'}
          </p>
        </div>

        {!selectedUser ? (
          /* Step 1: User selection */
          <div className="flex gap-6">
            {Object.entries(USERS).map(([id, u]) => (
              <button
                key={id}
                onClick={() => handleSelectUser(id)}
                className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/80 backdrop-blur border border-stone-200 hover:border-stone-400 hover:shadow-lg transition-all"
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-md"
                  style={{ background: u.color }}
                >
                  {u.initials}
                </div>
                <div className="text-sm font-semibold text-stone-700">{u.name}</div>
                <div className="text-[10px] text-stone-400 uppercase tracking-widest">{ROLE_LABELS[u.role]}</div>
              </button>
            ))}
          </div>
        ) : (
          /* Step 2: Password entry */
          <form onSubmit={handleLogin} className="flex flex-col items-center gap-5 w-80">
            <div className="flex flex-col items-center gap-2 mb-2">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md"
                style={{ background: USERS[selectedUser].color }}
              >
                {USERS[selectedUser].initials}
              </div>
              <div className="text-lg font-semibold text-stone-700">{USERS[selectedUser].name}</div>
              <div className="text-[10px] text-stone-400 uppercase tracking-widest">{ROLE_LABELS[USERS[selectedUser].role]}</div>
            </div>

            <div className="w-full relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoFocus
                className="w-full pl-10 pr-4 py-3 border border-stone-200 rounded-xl text-sm bg-white/80 backdrop-blur focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-mercury-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Accesso...' : 'Accedi'}
            </button>

            <button
              type="button"
              onClick={handleBack}
              className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
            >
              Cambia utente
            </button>
          </form>
        )}

        {(error || loginError) && (
          <div className="mt-6 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error || loginError}
          </div>
        )}
      </div>
    </>
  )
}
