import React from 'react'
import { TYPES } from '../api/constants'

export default function ContentThumb({ type, size = 'sm' }) {
  const info = TYPES[type] || { icon: '?', gradient: 'from-gray-300 to-gray-400' }

  const sizes = {
    xs: 'w-7 h-7 text-xs',
    sm: 'w-10 h-10 text-sm',
    md: 'w-14 h-full text-lg min-h-[60px]',
    lg: 'w-full h-32 text-3xl',
  }

  return (
    <div className={`bg-gradient-to-br ${info.gradient} rounded-lg flex items-center justify-center text-white font-bold shrink-0 ${sizes[size]}`}>
      {info.icon}
    </div>
  )
}
