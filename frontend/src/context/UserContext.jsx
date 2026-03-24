import React, { createContext, useContext, useState, useCallback } from 'react'
import { setAuthToken } from '../api/client'

const UserContext = createContext(null)

export const USERS = {
  fulvio: { name: 'Fulvio', initials: 'FU', role: 'admin', color: '#e8580c' },
  federico: { name: 'Federico', initials: 'FE', role: 'collaborator', color: '#ff9800' },
  marzia: { name: 'Marzia', initials: 'MA', role: 'collaborator', color: '#ef4444' },
  marketing: { name: 'Marketing', initials: 'MK', role: 'marketing', color: '#9333ea' },
}

export function UserProvider({ children }) {
  const [userId, setUserIdState] = useState(null)
  const [token, setToken] = useState(null)
  const [loginError, setLoginError] = useState(null)

  const user = userId ? USERS[userId] : null
  const isAdmin = user?.role === 'admin'
  const isMarketing = user?.role === 'marketing'

  const login = useCallback(async (id) => {
    setLoginError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Errore di rete' }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      const data = await res.json()
      setAuthToken(data.token)
      setToken(data.token)
      setUserIdState(id)
    } catch (err) {
      setLoginError(err.message)
      throw err
    }
  }, [])

  const logout = useCallback(() => {
    setAuthToken(null)
    setToken(null)
    setUserIdState(null)
    setLoginError(null)
  }, [])

  return (
    <UserContext.Provider value={{ userId, user, isAdmin, isMarketing, token, login, logout, loginError }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
