import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'

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

export default function ImageCropModal({ imageUrl, onConfirm, onCancel }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)

  const handleCropComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  const handleConfirm = () => {
    if (!croppedAreaPixels) return
    onConfirm({
      x: Math.round(croppedAreaPixels.x),
      y: Math.round(croppedAreaPixels.y),
      width: Math.round(croppedAreaPixels.width),
      height: Math.round(croppedAreaPixels.height),
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1rem 1.25rem', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Bildausschnitt für Titelbild wählen</h3>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)' }}>
          💡 Der Bildausschnitt kann später jederzeit angepasst werden.
        </p>
      </div>

      <div style={{ position: 'relative', flex: 1 }}>
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={16 / 9}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
        />
      </div>

      <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          style={{ flex: 1, maxWidth: '240px' }}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <button onClick={onCancel} style={BTN_SECONDARY}>Abbrechen</button>
          <button onClick={handleConfirm} disabled={!croppedAreaPixels} style={{ ...BTN_PRIMARY, opacity: croppedAreaPixels ? 1 : 0.5 }}>
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  )
}
