import React, { useEffect, useState } from 'react'
import { api } from '../api/client'
import ContentThumb from './ContentThumb'

/**
 * Shows the real uploaded thumbnail when available,
 * falls back to the gradient ContentThumb placeholder.
 *
 * Props:
 *  - item: content object with { id, content_type, has_thumbnail }
 *  - size: 'xs' | 'sm' | 'md' | 'lg'
 */
export default function SmartThumb({ item, size = 'sm' }) {
  const [src, setSrc] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!item?.has_thumbnail || !item?.id) return
    let cancelled = false
    api.getThumbnail(item.id).then(url => {
      if (!cancelled && url) setSrc(url)
    }).catch(() => {
      if (!cancelled) setFailed(true)
    })
    return () => { cancelled = true }
  }, [item?.id, item?.has_thumbnail])

  // No thumbnail or failed → fallback gradient
  if (!item?.has_thumbnail || failed || !src) {
    return <ContentThumb type={item?.content_type} size={size} />
  }

  const sizeClasses = {
    xs: 'w-7 h-7',
    sm: 'w-10 h-10',
    md: 'w-14 h-full min-h-[60px]',
    lg: 'w-full h-32',
  }

  return (
    <div className={`${sizeClasses[size]} rounded-lg overflow-hidden shrink-0 bg-stone-200`}>
      <img
        src={src}
        alt=""
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  )
}
