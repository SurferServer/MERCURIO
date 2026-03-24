import React, { useState } from 'react'
import { USERS, useUser } from '../context/UserContext'
import HalftoneBackground from './HalftoneBackground'

const ROLE_LABELS = {
  admin: 'Responsabile',
  collaborator: 'Collaboratore',
  marketing: 'Ufficio Marketing',
}

export default function UserPicker() {
  const { login, loginError } = useUser()
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState(null)

  const handlePick = async (id) => {
    setLoading(id)
    setError(null)
    try {
      await login(id)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      <HalftoneBackground opacity={0.4} />
      <div className="h-screen flex flex-col items-center justify-center relative z-10">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black tracking-tight text-stone-800 mb-1">MERCURIO</h1>
          <p className="text-sm text-stone-500">Seleziona il tuo profilo per accedere</p>
        </div>
        <div className="flex gap-6">
          {Object.entries(USERS).map(([id, u]) => (
            <button
              key={id}
              onClick={() => handlePick(id)}
              disabled={loading !== null}
              className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/80 backdrop-blur border border-stone-200 hover:border-stone-400 hover:shadow-lg transition-all disabled:opacity-50"
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-md"
                style={{ background: u.color }}
              >
                {loading === id ? '...' : u.initials}
              </div>
              <div className="text-sm font-semibold text-stone-700">{u.name}</div>
              <div className="text-[10px] text-stone-400 uppercase tracking-widest">{ROLE_LABELS[u.role]}</div>
            </button>
          ))}
        </div>
        {(error || loginError) && (
          <div className="mt-6 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error || loginError}
          </div>
        )}
      </div>
    </>
  )
}
