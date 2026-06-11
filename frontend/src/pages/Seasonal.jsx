import { useEffect, useMemo, useState } from 'react'
import client from '../api/client'

const MONTH_LABELS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

const CATEGORIES = [
  { key: 'vegetables', label: 'Gemüse', trackId: 'seasonal-filter-vegetables' },
  { key: 'fruits', label: 'Obst', trackId: 'seasonal-filter-fruits' },
  { key: 'salads', label: 'Salat', trackId: 'seasonal-filter-salads' },
  { key: 'herbs', label: 'Kräuter', trackId: 'seasonal-filter-herbs' },
]

const COLOR_FRESH_CORE = '#3B6D11'
const COLOR_FRESH_EDGE = '#97C459'
const COLOR_STORED = '#B4B2A9'
const COLOR_PLANT = '#8B5E3C'

// ── Helpers ──────────────────────────────────────────────────────────────────

function toRanges(monthNumbers) {
  const sorted = [...monthNumbers].sort((a, b) => a - b)
  const ranges = []
  for (const m of sorted) {
    const last = ranges[ranges.length - 1]
    if (last && m === last[1] + 1) {
      last[1] = m
    } else {
      ranges.push([m, m])
    }
  }
  return ranges
}

function formatRanges(monthNumbers) {
  const ranges = toRanges(monthNumbers)
  return ranges
    .map(([start, end]) => start === end ? MONTH_LABELS[start - 1] : `${MONTH_LABELS[start - 1]}–${MONTH_LABELS[end - 1]}`)
    .join(', ')
}

// ── Sub-components ───────────────────────────────────────────────────────────

function FilterPill({ active, onClick, children, trackId }) {
  return (
    <button
      onClick={onClick}
      data-track-id={trackId}
      style={{
        borderRadius: '999px',
        border: `1px solid ${active ? '#C8602A' : 'var(--border-input)'}`,
        padding: '5px 12px',
        fontSize: '13px',
        background: active ? '#C8602A' : 'transparent',
        color: active ? '#fff' : 'var(--text)',
        cursor: 'pointer',
        fontFamily: 'Inter, sans-serif',
        transition: 'var(--transition)',
      }}
    >
      {children}
    </button>
  )
}

function LegendItem({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--subtext)' }}>
      <span style={{ display: 'inline-block', width: '20px', height: '7px', borderRadius: '3px', background: color }} />
      {label}
    </div>
  )
}

function SeasonalRow({ item, currentMonth, expanded, onToggle }) {
  const months = item.months || {}
  const freshMonths = []
  const seasonMonths = []
  for (let m = 1; m <= 12; m++) {
    const status = months[String(m)]
    if (status === 'fresh') { freshMonths.push(m); seasonMonths.push(m) }
    else if (status === 'stored') { seasonMonths.push(m) }
  }
  const edgeMonths = new Set(freshMonths.length > 0 ? [Math.min(...freshMonths), Math.max(...freshMonths)] : [])
  const plantMonths = item.plant || []

  return (
    <>
      <tr
        onClick={onToggle}
        data-track-id="seasonal-row-expand"
        style={{ cursor: 'pointer' }}
      >
        <td className="seasonal-name-col" style={{ padding: '0.4rem 0.5rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg)' }}>
          {item.name}
        </td>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
          const status = months[String(m)]
          let seasonColor = 'transparent'
          if (status === 'stored') seasonColor = COLOR_STORED
          else if (status === 'fresh') seasonColor = edgeMonths.has(m) ? COLOR_FRESH_EDGE : COLOR_FRESH_CORE
          const plantColor = plantMonths.includes(m) ? COLOR_PLANT : 'transparent'
          const isCurrent = m === currentMonth
          return (
            <td key={m} style={{ padding: '0.4rem 0.2rem', background: isCurrent ? 'rgba(200,96,42,0.05)' : 'transparent' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ height: '7px', borderRadius: '3px', background: seasonColor }} />
                <div style={{ height: '4px', borderRadius: '2px', background: plantColor }} />
              </div>
            </td>
          )
        })}
      </tr>
      {expanded && (
        <tr>
          <td colSpan={13} style={{ padding: '0.6rem 0.5rem', background: 'var(--card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{item.name}</strong>
              {seasonMonths.length > 0 && (
                <span style={{ borderRadius: '999px', padding: '3px 10px', fontSize: '12px', background: 'rgba(59,109,17,0.12)', color: COLOR_FRESH_CORE, fontWeight: 500 }}>
                  Saison: {formatRanges(seasonMonths)}
                </span>
              )}
              {plantMonths.length > 0 && (
                <span style={{ borderRadius: '999px', padding: '3px 10px', fontSize: '12px', background: 'rgba(139,94,60,0.12)', color: COLOR_PLANT, fontWeight: 500 }}>
                  Pflanzen: {formatRanges(plantMonths)}
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Seasonal() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('vegetables')
  const [expandedId, setExpandedId] = useState(null)

  const currentMonth = new Date().getMonth() + 1

  useEffect(() => {
    document.title = 'Saisonkalender – PiEngines Recipes'
  }, [])

  useEffect(() => {
    setLoading(true)
    client.get('/api/seasonal/all')
      .then(({ data }) => setData(data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const items = useMemo(() => data?.[category] || [], [data, category])

  return (
    <div data-track-id="seasonal-page" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.6rem', color: 'var(--text)', margin: '0 0 1rem' }}>
          Saisonkalender
        </h1>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {CATEGORIES.map(c => (
            <FilterPill key={c.key} active={category === c.key} onClick={() => { setCategory(c.key); setExpandedId(null) }} trackId={c.trackId}>
              {c.label}
            </FilterPill>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <LegendItem color={COLOR_FRESH_CORE} label="Frisch" />
          <LegendItem color={COLOR_FRESH_EDGE} label="Randzeit" />
          <LegendItem color={COLOR_STORED} label="Lager" />
          <LegendItem color={COLOR_PLANT} label="Pflanzen" />
        </div>

        <style>{`
          .seasonal-name-col {
            width: 100px;
            min-width: 100px;
          }
          td.seasonal-name-col {
            font-size: 0.85rem;
          }
          @media (max-width: 480px) {
            .seasonal-name-col {
              width: 80px;
              min-width: 80px;
            }
            td.seasonal-name-col {
              font-size: 11px;
            }
          }
        `}</style>

        {loading ? (
          <p style={{ color: 'var(--subtext)' }}>Lädt …</p>
        ) : items.length === 0 ? (
          <p style={{ color: 'var(--subtext)' }}>Keine Daten verfügbar.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '760px' }}>
              <thead>
                <tr>
                  <th className="seasonal-name-col" style={{ textAlign: 'left', padding: '0.4rem 0.5rem', fontSize: '0.78rem', color: 'var(--subtext)', position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg)' }} />
                  {MONTH_LABELS.map((label, i) => {
                    const m = i + 1
                    const isCurrent = m === currentMonth
                    return (
                      <th
                        key={m}
                        style={{
                          padding: '0.4rem 0.2rem',
                          fontSize: '0.75rem',
                          fontWeight: isCurrent ? 700 : 500,
                          color: isCurrent ? '#C8602A' : 'var(--subtext)',
                          background: isCurrent ? 'rgba(200,96,42,0.05)' : 'transparent',
                          textAlign: 'center',
                        }}
                      >
                        {label}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <SeasonalRow
                    key={item.id}
                    item={item}
                    currentMonth={currentMonth}
                    expanded={expandedId === item.id}
                    onToggle={() => setExpandedId(prev => prev === item.id ? null : item.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
