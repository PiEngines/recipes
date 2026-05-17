import { useCallback, useEffect, useRef, useState } from 'react'
import client from '../api/client'

const POLL_INTERVAL = 3000

// ── Helpers ───────────────────────────────────────────────────────────────────

function humanSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ width: '24px', height: '24px', border: '3px solid var(--border-input)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
  )
}

// ── Media thumbnail card ───────────────────────────────────────────────────────

function MediaCard({ media, index, total, onSetPrimary, onRequestDelete, onMoveLeft, onMoveRight }) {
  const isProcessing = media.processing_status === 'processing'
  const isError = media.processing_status === 'error'
  const isPrimary = media.is_primary
  const imageCount = total

  return (
    <div style={{
      position: 'relative',
      borderRadius: 'var(--radius-input)',
      overflow: 'hidden',
      border: isPrimary ? '2.5px solid #C8602A' : '1.5px solid var(--border-input)',
      background: 'var(--bg)',
      aspectRatio: '1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {/* Thumbnail / status */}
      {isProcessing ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '0.5rem' }}>
          <Spinner />
          <span style={{ fontSize: '0.68rem', color: 'var(--subtext)', textAlign: 'center' }}>Verarbeite …</span>
        </div>
      ) : isError ? (
        <div style={{ textAlign: 'center', padding: '0.5rem' }}>
          <div style={{ fontSize: '1.5rem' }}>⚠️</div>
          <span style={{ fontSize: '0.68rem', color: '#C84444' }}>Fehler</span>
        </div>
      ) : media.thumbnail_url ? (
        <img src={media.thumbnail_url} alt={media.original_filename || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ fontSize: '2rem' }}>{media.media_type === 'video' ? '🎬' : '🖼️'}</div>
      )}

      {/* Primary badge */}
      {isPrimary && (
        <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(200,96,42,0.85)', color: '#fff', fontSize: '0.65rem', fontWeight: 600, textAlign: 'center', padding: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Titelbild
        </span>
      )}

      {/* Delete button (top right) */}
      <button
        onClick={() => onRequestDelete(media.id)}
        title="Löschen"
        style={{ position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}
      >×</button>

      {/* Set primary button (images only, not already primary, only if >1 image) */}
      {media.media_type === 'image' && !isPrimary && !isProcessing && !isError && imageCount > 1 && (
        <button
          onClick={() => onSetPrimary(media.id)}
          title="Als Titelbild setzen"
          style={{ position: 'absolute', top: '4px', left: '4px', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.6rem', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}
        >★ Titelbild</button>
      )}

      {/* Move left / right arrows (bottom, only if not first/last) */}
      {(index > 0 || index < total - 1) && (
        <div style={{ position: 'absolute', bottom: isPrimary ? '1.2rem' : '4px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '2px' }}>
          {index > 0 && (
            <button
              onClick={e => { e.stopPropagation(); onMoveLeft(index) }}
              title="Nach links"
              style={{ width: '20px', height: '20px', borderRadius: '4px', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
            >←</button>
          )}
          {index < total - 1 && (
            <button
              onClick={e => { e.stopPropagation(); onMoveRight(index) }}
              title="Nach rechts"
              style={{ width: '20px', height: '20px', borderRadius: '4px', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
            >→</button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MediaUpload({ entityType, entityId, existingMedia = [], onMediaChange, allowVideo = false }) {
  const [mediaList, setMediaList] = useState(existingMedia)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [uploadToast, setUploadToast] = useState(null)
  const [uploadToastFading, setUploadToastFading] = useState(false)
  const inputRef = useRef(null)
  const pollTimers = useRef({})
  const toastAutoTimer = useRef(null)
  const toastFadeTimer = useRef(null)

  const dismissUploadToast = useCallback(() => {
    clearTimeout(toastAutoTimer.current)
    clearTimeout(toastFadeTimer.current)
    setUploadToastFading(true)
    toastFadeTimer.current = setTimeout(() => {
      setUploadToast(null)
      setUploadToastFading(false)
    }, 300)
  }, [])

  const showUploadToast = useCallback((msg) => {
    clearTimeout(toastAutoTimer.current)
    clearTimeout(toastFadeTimer.current)
    setUploadToast(msg)
    setUploadToastFading(false)
    toastAutoTimer.current = setTimeout(dismissUploadToast, 4000)
  }, [dismissUploadToast])

  useEffect(() => {
    if (!uploadToast || uploadToastFading) return
    const handler = () => dismissUploadToast()
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [uploadToast, uploadToastFading, dismissUploadToast])

  useEffect(() => () => {
    clearTimeout(toastAutoTimer.current)
    clearTimeout(toastFadeTimer.current)
  }, [])

  // Sync existingMedia wenn es sich von leer auf gefüllt ändert (z.B. async geladen)
  const didSyncRef = useRef(false)
  useEffect(() => {
    if (!didSyncRef.current && existingMedia.length > 0) {
      didSyncRef.current = true
      setMediaList(existingMedia)
    }
  }, [existingMedia])

  // Start polling for processing videos
  useEffect(() => {
    mediaList.forEach(m => {
      if (m.processing_status === 'processing' && !pollTimers.current[m.id]) {
        pollTimers.current[m.id] = setInterval(async () => {
          try {
            const { data } = await client.get(`/api/media/status/${m.id}`)
            if (data.processing_status !== 'processing') {
              clearInterval(pollTimers.current[m.id])
              delete pollTimers.current[m.id]
              // Reload full media entry
              const { data: updated } = await client.get(`/api/media/entity/${entityType}/${entityId}`)
              setMediaList(updated)
              onMediaChange?.(updated)
            }
          } catch {}
        }, POLL_INTERVAL)
      }
    })
    return () => {
      // Cleanup timers only for media no longer in list
      const ids = new Set(mediaList.map(m => m.id))
      Object.keys(pollTimers.current).forEach(id => {
        if (!ids.has(Number(id))) {
          clearInterval(pollTimers.current[id])
          delete pollTimers.current[id]
        }
      })
    }
  }, [mediaList, entityType, entityId, onMediaChange])

  const uploadFiles = useCallback(async (files) => {
    if (!files.length) return
    setUploading(true)
    setError(null)

    const newMedia = []
    for (const file of files) {
      const isVideo = file.type.startsWith('video/')
      if (isVideo && !allowVideo) continue

      const endpoint = isVideo
        ? `/api/media/upload/video?entity_type=${entityType}&entity_id=${entityId}`
        : `/api/media/upload/image?entity_type=${entityType}&entity_id=${entityId}`
      const form = new FormData()
      form.append('file', file)

      try {
        const { data } = await client.post(endpoint, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        newMedia.push(data)
      } catch (err) {
        const msg = err.response?.data?.detail || 'Upload fehlgeschlagen'
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
      }
    }

    if (newMedia.length) {
      setMediaList(prev => {
        const updated = [...prev, ...newMedia]
        onMediaChange?.(updated)
        return updated
      })
      showUploadToast('Bild gespeichert')
    }
    setUploading(false)
  }, [entityType, entityId, allowVideo, onMediaChange])

  const handleFiles = useCallback((files) => {
    const arr = Array.from(files).filter(f => {
      if (f.type.startsWith('image/')) return true
      if (allowVideo && f.type.startsWith('video/')) return true
      return false
    })
    uploadFiles(arr)
  }, [uploadFiles, allowVideo])

  const handleMove = async (fromIdx, toIdx) => {
    setMediaList(prev => {
      const arr = [...prev]
      ;[arr[fromIdx], arr[toIdx]] = [arr[toIdx], arr[fromIdx]]
      const updated = arr.map((m, i) => ({ ...m, sort_order: i }))
      onMediaChange?.(updated)
      // Persist new sort_orders for the two swapped items
      Promise.all([
        client.patch(`/api/media/${updated[fromIdx].id}`, { sort_order: fromIdx }),
        client.patch(`/api/media/${updated[toIdx].id}`, { sort_order: toIdx }),
      ]).catch(() => {})
      return updated
    })
  }

  const handleSetPrimary = async (mediaId) => {
    try {
      const { data } = await client.patch(`/api/media/${mediaId}/set-primary`)
      setMediaList(prev => {
        const updated = prev.map(m => ({ ...m, is_primary: m.id === data.id }))
        onMediaChange?.(updated)
        return updated
      })
    } catch (err) {
      setError('Konnte Titelbild nicht setzen')
    }
  }

  const handleDelete = async (mediaId) => {
    try {
      await client.delete(`/api/media/${mediaId}`)
      setMediaList(prev => {
        const updated = prev.filter(m => m.id !== mediaId)
        onMediaChange?.(updated)
        return updated
      })
    } catch {
      setError('Löschen fehlgeschlagen')
    }
  }

  const accept = allowVideo
    ? 'image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime'
    : 'image/jpeg,image/png,image/webp,image/heic'

  return (
    <div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes mu-toast-in  { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes mu-toast-out { from { opacity: 1; transform: translateX(-50%) translateY(0); } to { opacity: 0; transform: translateX(-50%) translateY(-8px); } }
      `}</style>

      {/* Drop zone */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        style={{
          border: `2px dashed ${dragOver ? 'var(--accent)' : uploading ? 'var(--secondary)' : 'var(--border-input)'}`,
          borderRadius: 'var(--radius-input)',
          padding: '1.25rem',
          textAlign: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          background: dragOver ? 'rgba(200,96,42,0.05)' : 'var(--bg)',
          transition: 'border-color 0.2s ease, background 0.2s ease',
          marginBottom: mediaList.length > 0 ? '0.875rem' : 0,
        }}
      >
        <input ref={inputRef} type="file" accept={accept} multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
        {uploading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: 'var(--subtext)' }}>
            <Spinner />
            <span style={{ fontSize: '0.875rem' }}>Lädt hoch …</span>
          </div>
        ) : (
          <>
            <div style={{ fontSize: '1.75rem', marginBottom: '0.375rem' }}>{allowVideo ? '📷🎬' : '📷'}</div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--subtext)' }}>
              Hierher ziehen oder klicken zum Auswählen
            </p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--border-input)' }}>
              {allowVideo ? 'JPEG, PNG, WebP, HEIC · MP4, MOV' : 'JPEG, PNG, WebP, HEIC'} · max. {allowVideo ? '1 GB (Video), ' : ''}20 MB
            </p>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ margin: '0.5rem 0', padding: '0.5rem 0.75rem', background: 'rgba(200,68,68,0.1)', border: '1px solid rgba(200,68,68,0.3)', borderRadius: 'var(--radius-input)', fontSize: '0.82rem', color: '#C84444', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C84444', fontSize: '1rem', padding: 0, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Thumbnail grid */}
      {mediaList.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.5rem' }}>
          {mediaList.map((m, i) => (
            <MediaCard
              key={m.id}
              media={m}
              index={i}
              total={mediaList.length}
              onSetPrimary={handleSetPrimary}
              onRequestDelete={setConfirmDeleteId}
              onMoveLeft={idx => handleMove(idx, idx - 1)}
              onMoveRight={idx => handleMove(idx, idx + 1)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation toast */}
      {confirmDeleteId !== null && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(44,44,42,0.92)', color: '#fff',
          borderRadius: '8px', padding: '12px 24px',
          fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', fontWeight: 500,
          zIndex: 1001, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '1rem',
          animation: 'mu-toast-in 0.2s ease',
        }}>
          <span>Bild wirklich löschen?</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => { handleDelete(confirmDeleteId); setConfirmDeleteId(null) }}
              style={{ padding: '0.3rem 0.875rem', background: '#C8602A', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}
            >Löschen</button>
            <button
              onClick={() => setConfirmDeleteId(null)}
              style={{ padding: '0.3rem 0.875rem', background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >Abbrechen</button>
          </div>
        </div>
      )}

      {/* Upload success toast */}
      {uploadToast && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(44,44,42,0.92)', color: '#fff',
          borderRadius: '8px', padding: '12px 24px',
          fontSize: '0.9rem', fontFamily: 'Inter, sans-serif', fontWeight: 500,
          zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          whiteSpace: 'nowrap', pointerEvents: 'none',
          animation: uploadToastFading ? 'mu-toast-out 0.3s ease forwards' : 'mu-toast-in 0.2s ease',
        }}>
          {uploadToast}
        </div>
      )}
    </div>
  )
}
