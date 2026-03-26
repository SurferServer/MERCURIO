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
    fulvio: 'bg-indigo-500',
    federico: 'bg-orange-500',
    marzia: 'bg-red-500',
    marketing: 'bg-purple-600',
    'federico+marzia': 'bg-purple-500',
    'fulvio+federico': 'bg-blue-500',
    'fulvio+marzia': 'bg-teal-500',
  }

  const initialsMap = {
    'federico+marzia': 'FM',
    'fulvio+federico': 'FF',
    'fulvio+marzia': 'VM',
  }

  if (!name) {
    return <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-stone-200 text-stone-500 text-[10px] font-bold ${className}`}>?</span>
  }

  // Pair assignments — show initials, no photo
  if (name.includes('+')) {
    return (
      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[10px] font-bold ${colors[name] || 'bg-stone-400'} ${className}`}>
        {initialsMap[name] || name.split('+').map(n => n[0].toUpperCase()).join('')}
      </span>
    )
  }

  // Cache-bust with session-based key stored on window
  const cacheBuster = window.__avatarCacheBuster || ''
  const photoUrl = `/avatars/${name}.jpg${cacheBuster ? '?v=' + cacheBuster : ''}`

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
