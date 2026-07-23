// Geteilte Label-/Input-Stile der Einstellungsformulare. Bewusst in einer
// eigenen Datei ohne Komponenten — so bleibt `settingsUi.jsx`
// komponenten-only (react-refresh/only-export-components).

export const labelStyle = {
  display: 'block',
  fontSize: '0.775rem',
  fontWeight: 600,
  color: 'var(--subtext)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.375rem',
  fontFamily: 'var(--font-mono)',
}

export const inputStyle = {
  width: '100%',
  padding: '0.6rem 0.875rem',
  border: '1.5px solid var(--border-input)',
  borderRadius: 'var(--radius-input)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: '0.9rem',
  fontFamily: 'var(--font-body)',
  outline: 'none',
  boxSizing: 'border-box',
}
