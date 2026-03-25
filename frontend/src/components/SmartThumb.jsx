import React, { useEffect, useState } from 'react'
import { api } from '../api/client'
import ContentThumb from './ContentThumb'

/**
 * Shows the real uploaded thumbnail when available,
 * falls back to Google Drive thumbnail for imported content,
 * then to the gradient ContentThumb placeholder.
 *
 * Props:
 *  - item: content object with { id, content_type, has_thumbnail, drive_link, drive_file_id }
 *  - size: 'xs' | 'sm' | 'md' | 'lg'
 */

/** Extract Google Drive file ID from a drive_link URL */
function extractDriveFileId(driveLink) {
  if (!driveLink) return null
  const match = driveLink.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                driveLink.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

export default function SmartThumb({ item, size = 'sm' }) {
  const [src, setSrc] = useState(null)
  const [failed, setFailed] = useState(false)
  const [driveFailed, setDriveFailed] = useState(false)

  // Try MERCURIO thumbnail (uploaded files) — regenerates on-demand from Drive if lost
  useEffect(() => {
    if (!item?.id) return
    // Try if has_thumbnail OR if there's a drive_file_id (server can regenerate)
    if (!item?.has_thumbnail && !item?.drive_file_id) return
    let cancelled = false
    api.getThumbnail(item.id).then(url => {
      if (!cancelled && url) setSrc(url)
      else if (!cancelled) setFailed(true)
    }).catch(() => {
      if (!cancelled) setFailed(true)
    })
    return () => { cancelled = true }
  }, [item?.id, item?.has_thumbnail, item?.drive_file_id])

  // Determine Drive thumbnail URL as fallback
  const driveFileId = item?.drive_file_id || extractDriveFileId(item?.drive_link)
  const driveThumbUrl = driveFileId
    ? `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w480`
    : null

  const sizeClasses = {
    xs: 'w-7 h-7',
    sm: 'w-10 h-10',
    md: 'w-14 h-full min-h-[60px]',
    lg: 'w-full h-32',
  }

  // 1) MERCURIO thumbnail available
  if (src && !failed) {
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

  // 2) Google Drive thumbnail fallback
  if (driveThumbUrl && !driveFailed) {
    return (
      <div className={`${sizeClasses[size]} rounded-lg overflow-hidden shrink-0 bg-stone-200`}>
        <img
          src={driveThumbUrl}
          alt=""
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setDriveFailed(true)}
        />
      </div>
    )
  }

  // 3) Fallback gradient placeholder
  return <ContentThumb type={item?.content_type} size={size} />
}
