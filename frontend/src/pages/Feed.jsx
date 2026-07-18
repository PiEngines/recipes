// Platzhalter »Feed« (SPEC §2.8 Home-Feed-Icon) — Aktivität Gefolgter.
// Analog zu /garten: bewusst minimal, kein 404. Braune (Rezepte-)Welt.

export default function Feed() {
  return (
    <div
      data-world="braun"
      id="feed-placeholder"
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
      <i className="ti ti-users" style={{ fontSize: 56, color: 'var(--accent)' }} aria-hidden="true" />
      <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700, fontSize: 30, color: 'var(--text)' }}>
        Feed
      </h1>
      <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)' }}>
        kommt bald
      </p>
      <p style={{ margin: 0, maxWidth: 340, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)' }}>
        Hier siehst du bald die Aktivität der Menschen, denen du folgst.
      </p>
    </div>
  )
}
