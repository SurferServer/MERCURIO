import React, { useState, useRef } from 'react'
import { USERS, useUser } from '../context/UserContext'
import { api } from '../api/client'
import HalftoneBackground from './HalftoneBackground'
import { Lock, Camera, X } from 'lucide-react'

const ROLE_LABELS = {
  admin: 'Responsabile',
  collaborator: 'Collaboratore',
  marketing: 'Ufficio Marketing',
}

function UserAvatar({ userId, user, size = 'w-16 h-16', textSize = 'text-xl', showCamera = false, onCameraClick }) {
  const [imgError, setImgError] = useState(false)
  const [imgKey, setImgKey] = useState(0)

  // Reset error state when userId changes
  React.useEffect(() => {
    setImgError(false)
    setImgKey(k => k + 1)
  }, [userId])

  return (
    <div className="relative group">
      {!imgError ? (
        <img
          key={imgKey}
          src={`/avatars/${userId}.jpg?v=${imgKey}`}
          alt={user.name}
          onError={() => setImgError(true)}
          className={`${size} rounded-full object-cover shadow-md`}
        />
      ) : (
        <div
          className={`${size} rounded-full flex items-center justify-center text-white ${textSize} font-bold shadow-md`}
          style={{ background: user.color }}
        >
          {user.initials}
        </div>
      )}
      {showCamera && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCameraClick?.() }}
          className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full shadow-md border border-stone-200 flex items-center justify-center text-stone-500 hover:text-accent hover:border-accent transition-all opacity-0 group-hover:opacity-100"
          title="Cambia foto profilo"
        >
          <Camera size={14} />
        </button>
      )}
    </div>
  )
}

export default function UserPicker() {
  const { login, loginError } = useUser()
  const [selectedUser, setSelectedUser] = useState(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pendingAvatar, setPendingAvatar] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef(null)

  const handleSelectUser = (id) => {
    setSelectedUser(id)
    setPassword('')
    setError(null)
    setPendingAvatar(null)
    setAvatarPreview(null)
  }

  const handleCameraClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Seleziona un file immagine (JPG, PNG, ecc.)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Immagine troppo grande (max 5 MB)')
      return
    }
    setPendingAvatar(file)
    setAvatarPreview(URL.createObjectURL(file))
    setError(null)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const handleClearAvatar = () => {
    setPendingAvatar(null)
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarPreview(null)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!selectedUser || !password) return
    setLoading(true)
    setError(null)
    try {
      // Login via context (single call)
      await login(selectedUser, password)

      // If there's a pending avatar, upload it now that we're authenticated
      if (pendingAvatar) {
        setUploadingAvatar(true)
        try {
          await api.uploadAvatar(pendingAvatar)
        } catch (uploadErr) {
          // Non-blocking: avatar upload failure shouldn't prevent login
          console.warn('Avatar upload failed:', uploadErr)
        }
        setUploadingAvatar(false)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setUploadingAvatar(false)
    }
  }

  const handleBack = () => {
    setSelectedUser(null)
    setPassword('')
    setError(null)
    handleClearAvatar()
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
                <UserAvatar userId={id} user={u} />
                <div className="text-sm font-semibold text-stone-700">{u.name}</div>
                <div className="text-[10px] text-stone-400 uppercase tracking-widest">{ROLE_LABELS[u.role]}</div>
              </button>
            ))}
          </div>
        ) : (
          /* Step 2: Password entry */
          <form onSubmit={handleLogin} className="flex flex-col items-center gap-5 w-80">
            <div className="flex flex-col items-center gap-2 mb-2">
              {/* Avatar with preview or current photo */}
              {avatarPreview ? (
                <div className="relative">
                  <img
                    src={avatarPreview}
                    alt="Anteprima"
                    className="w-20 h-20 rounded-full object-cover shadow-md"
                  />
                  <button
                    type="button"
                    onClick={handleClearAvatar}
                    className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full shadow-md flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                    title="Rimuovi foto"
                  >
                    <X size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={handleCameraClick}
                    className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full shadow-md border border-stone-200 flex items-center justify-center text-stone-500 hover:text-accent hover:border-accent transition-colors"
                    title="Cambia foto"
                  >
                    <Camera size={14} />
                  </button>
                </div>
              ) : (
                <UserAvatar
                  userId={selectedUser}
                  user={USERS[selectedUser]}
                  size="w-20 h-20"
                  textSize="text-2xl"
                  showCamera={true}
                  onCameraClick={handleCameraClick}
                />
              )}
              <div className="text-lg font-semibold text-stone-700">{USERS[selectedUser].name}</div>
              <div className="text-[10px] text-stone-400 uppercase tracking-widest">{ROLE_LABELS[USERS[selectedUser].role]}</div>
              {avatarPreview && (
                <div className="text-[11px] text-accent font-medium">
                  Nuova foto pronta — verrà salvata al login
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

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
              {uploadingAvatar ? 'Caricamento foto...' : loading ? 'Accesso...' : 'Accedi'}
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
