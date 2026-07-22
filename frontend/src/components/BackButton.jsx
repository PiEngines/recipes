/**
 * BackButton — zentraler Zurück-Button (Design-Handoff v2, `.pe-back`).
 *
 * Standard ist ein dezenter Chevron im 36px-Kreis (icon-only). Die Variante
 * richtet sich nach dem Untergrund, auf dem der Button sitzt:
 *
 *   light  — heller Flächen-Hintergrund (Default)
 *   brown  — dunkelbrauner Header/Sheet
 *   green  — dunkelgrüner Header/Sheet
 *   photo  — direkt auf einem Foto (getönt + Blur, damit er lesbar bleibt)
 *
 * `label` schaltet auf die Pill-Form mit Text „Zurück" — gedacht für Wizard-
 * und Sheet-Header, wo der Rücksprung benannt sein soll.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { de } from '../i18n/de'

// Werte 1:1 aus dem Design-Handoff (`.pe-back` + Modifier).
const VARIANTEN = {
  light: {
    background: 'rgba(46,38,24,.05)',
    borderColor: 'rgba(46,38,24,.14)',
    hover: 'rgba(46,38,24,.10)',
    stroke: '#2a2218',
  },
  brown: {
    background: 'rgba(240,232,208,.09)',
    borderColor: 'rgba(240,232,208,.18)',
    hover: 'rgba(240,232,208,.18)',
    stroke: '#f0e8d0',
  },
  green: {
    background: 'rgba(232,240,216,.10)',
    borderColor: 'rgba(232,240,216,.20)',
    hover: 'rgba(232,240,216,.20)',
    stroke: '#e8f0d8',
  },
  photo: {
    background: 'rgba(30,24,14,.42)',
    borderColor: 'rgba(255,255,255,.22)',
    hover: 'rgba(30,24,14,.58)',
    stroke: '#fff',
    strokeWidth: 2.2,
    backdropFilter: 'blur(6px)',
  },
}

export default function BackButton({ onClick, fallback = '/', variant = 'light', label = false }) {
  const navigate = useNavigate()
  const [hov, setHov] = useState(false)
  const v = VARIANTEN[variant] || VARIANTEN.light

  const handleClick = () => {
    if (onClick) onClick()
    else if (window.history.length > 1) navigate(-1)
    else navigate(fallback)
  }

  const iconSize = label ? 15 : 17

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      aria-label={de.backButton}
      data-track-id="back-button-click"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        cursor: 'pointer',
        transition: 'background .15s',
        background: hov ? v.hover : v.background,
        border: `1px solid ${v.borderColor}`,
        backdropFilter: v.backdropFilter,
        WebkitBackdropFilter: v.backdropFilter,
        height: 36,
        ...(label
          ? { width: 'auto', borderRadius: 18, padding: '0 14px 0 11px', gap: 7 }
          : { width: 36, borderRadius: '50%', padding: 0 }),
      }}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke={v.stroke}
        strokeWidth={v.strokeWidth || 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ display: 'block' }}
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 10,
          letterSpacing: '.06em', color: v.stroke,
        }}>
          {de.backButton}
        </span>
      )}
    </button>
  )
}
