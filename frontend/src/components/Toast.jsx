import React from 'react'
import { CheckCircle, AlertCircle } from 'lucide-react'

export default function Toast({ message, type = 'success' }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-soft-xl text-sm font-medium text-white animate-toast-in backdrop-blur-md ${
      type === 'success'
        ? 'bg-gradient-to-r from-emerald-600 to-emerald-500'
        : 'bg-gradient-to-r from-red-600 to-red-500'
    }`} style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
      {type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
      {message}
    </div>
  )
}
