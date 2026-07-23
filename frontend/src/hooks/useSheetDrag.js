/**
 * useSheetDrag — Bottom-Sheets per Ziehen schließen (FR-Sheet-Drag).
 *
 * Vorher hatte nur das Filter-Sheet die Geste, und dort griff sie allein am
 * 36px-Balken. Der Hook gibt `griffProps` zurück, die auf den **ganzen
 * Kopfbereich** eines Sheets gehören — Balken, Titelzeile, Schließen-Button
 * inklusive.
 *
 * Zwei Dinge machen die Geste verträglich:
 *
 *   Richtungs-Lock — gezogen wird erst ab `START_SCHWELLE` Pixeln, und nur
 *   wenn der Zug überwiegend vertikal ist. Ein waagerechter Wisch (Chips,
 *   Karussells im Kopf) lässt das Sheet in Ruhe.
 *
 *   Späte Pointer-Capture — erst wenn der Zug wirklich läuft. Sonst würde ein
 *   Tipp auf einen Button im Kopf beim Capture-Element landen statt beim
 *   Button.
 *
 * Der Aufrufer setzt den Versatz selbst (`transform: translateY(dragY)`) und
 * schaltet seine Transition anhand von `dragging` ab — so bleiben Slide-in und
 * Zieh-Versatz in einer Hand.
 */
import { useCallback, useRef, useState } from 'react'

// Ab hier gilt eine Bewegung als Zug und nicht mehr als Tipp.
const START_SCHWELLE = 6

export default function useSheetDrag({ onClose, schliessAb = 90 } = {}) {
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  // Spiegel des Versatzes: `onPointerUp` muss den Wert lesen, ohne dafür in
  // einen State-Updater zu greifen (dort gehören keine Seiteneffekte hin).
  const dragYRef = useRef(0)
  const startRef = useRef(null)

  const setzeDragY = useCallback(y => { dragYRef.current = y; setDragY(y) }, [])

  const reset = useCallback(() => {
    startRef.current = null
    setDragging(false)
    setzeDragY(0)
  }, [setzeDragY])

  const onPointerDown = useCallback(e => {
    if (e.button !== undefined && e.button > 0) return
    startRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId, aktiv: false }
  }, [])

  const onPointerMove = useCallback(e => {
    const start = startRef.current
    if (!start || start.id !== e.pointerId) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y

    if (!start.aktiv) {
      if (Math.abs(dx) < START_SCHWELLE && Math.abs(dy) < START_SCHWELLE) return
      if (Math.abs(dy) <= Math.abs(dx)) { startRef.current = null; return }
      start.aktiv = true
      setDragging(true)
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }

    // Nur nach unten — nach oben gibt es nichts aufzuziehen.
    setzeDragY(Math.max(0, dy))
  }, [setzeDragY])

  const onPointerUp = useCallback(e => {
    const start = startRef.current
    startRef.current = null
    if (!start?.aktiv) return
    setDragging(false)
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    if (dragYRef.current > schliessAb) onClose?.()
    else setzeDragY(0)
  }, [onClose, schliessAb, setzeDragY])

  return {
    dragY,
    dragging,
    reset,
    griffProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      // Ohne `touchAction: none` scrollt der Browser beim Ziehen die Seite
      // statt das Sheet.
      style: { touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' },
    },
  }
}
