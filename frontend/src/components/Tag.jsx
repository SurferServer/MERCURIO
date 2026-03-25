import React from 'react'

export default function Tag({ children, bg = 'bg-stone-100', text = 'text-stone-700', className = '' }) {
  return (
    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded ${bg} ${text} ${className}`}>
      {children}
    </span>
  )
}

export function Avatar({ name, className = '' }) {
  const [imgError, setImgError] = React.useState(false)

  const colors = {
    fulvio: 'bg-orange-600',
    federico: 'bg-orange-500',
    marzia: 'bg-red-500',
    marketing: 'bg-purple-600',
  }

  if (!name) {
    return <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-stone-200 text-stone-500 text-[10px] font-bold ${className}`}>?</span>
  }

  const photoUrl = `/avatars/${name}.jpg`

  // Try photo first, fallback to initials
  if (!imgError) {
    return (
      <img
        src={photoUrl}
        alt={name}
        onError={() => setImgError(true)}
        className={`w-6 h-6 rounded-full object-cover ${className}`}
      />
    )
  }

  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[10px] font-bold ${colors[name] || 'bg-stone-400'} ${className}`}>
      {name[0].toUpperCase()}
    </span>
  )
}
