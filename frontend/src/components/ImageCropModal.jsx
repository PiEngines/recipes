import { useRef, useState } from 'react'
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

const ASPECT = 16 / 9

const BTN_PRIMARY = {
  padding: '0.55rem 1.25rem',
  background: '#C8602A',
  border: 'none',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
}

const BTN_SECONDARY = {
  padding: '0.55rem 1.25rem',
  background: 'rgba(255,255,255,0.12)',
  border: 'none',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '0.9rem',
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
}

function centerAspectCrop(mediaWidth, mediaHeight) {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, ASPECT, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  )
}

export default function ImageCropModal({ imageUrl, onConfirm, onCancel }) {
  const [crop, setCrop] = useState()
  const [completedCrop, setCompletedCrop] = useState(null)
  const [forceAspect, setForceAspect] = useState(true)
  const imgRef = useRef(null)

  const onImageLoad = e => {
    const { width, height } = e.currentTarget
    setCrop(centerAspectCrop(width, height))
  }

  const handleConfirm = () => {
    const img = imgRef.current
    if (!img || !completedCrop?.width) return
    const scaleX = img.naturalWidth / img.width
    const scaleY = img.naturalHeight / img.height
    onConfirm({
      x: Math.round(completedCrop.x * scaleX),
      y: Math.round(completedCrop.y * scaleY),
      width: Math.round(completedCrop.width * scaleX),
      height: Math.round(completedCrop.height * scaleY),
      thumbnail_style: forceAspect ? 'crop' : 'blur',
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1rem 1.25rem', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Bildausschnitt für Titelbild wählen</h3>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)' }}>
          💡 Der Bildausschnitt kann später jederzeit über das ✂-Symbol angepasst werden.
        </p>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: '1rem', minHeight: 0 }}>
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          onComplete={c => setCompletedCrop(c)}
          aspect={forceAspect ? ASPECT : undefined}
          minWidth={40}
          keepSelection
        >
          <img
            ref={imgRef}
            src={imageUrl}
            onLoad={onImageLoad}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block' }}
          />
        </ReactCrop>
      </div>

      <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#fff', fontFamily: 'Inter, sans-serif', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={forceAspect}
            onChange={e => setForceAspect(e.target.checked)}
            style={{ accentColor: '#C8602A' }}
          />
          Kachelformat
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={onCancel} style={BTN_SECONDARY}>Abbrechen</button>
          <button onClick={handleConfirm} disabled={!completedCrop?.width} style={{ ...BTN_PRIMARY, opacity: completedCrop?.width ? 1 : 0.5 }}>
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  )
}
