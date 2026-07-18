// Platzhalter »Mein Beet« (SPEC §2.7 Garten-Slot) — grüne Farbwelt (SPEC §1.1)
// als konsistenter Vorgeschmack. Bewusst minimal: kein 404, keine Illustration/CTA.

export default function Garten() {
  return (
    <div
      data-world="gruen"
      id="garten-placeholder"
      style={{
        minHeight: 'calc(100vh - 200px)',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 14,
        padding: '48px 24px',
      }}
    >
      <i className="ti ti-plant-2" style={{ fontSize: 56, color: 'var(--green-strong)' }} aria-hidden="true" />
      <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 30, color: 'var(--text)' }}>
        Mein Beet
      </h1>
      <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--green-strong)' }}>
        kommt bald
      </p>
      <p style={{ margin: 0, maxWidth: 340, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)' }}>
        Hier wachsen bald dein Gartenkalender und deine Aussaat-Aufgaben.
      </p>
    </div>
  )
}
