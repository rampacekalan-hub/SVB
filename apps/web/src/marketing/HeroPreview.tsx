/**
 * HeroPreview — live-looking screenshot appky v hero sekcii.
 *
 * Vytvorený z reálnych komponentov aplikácie (KPITile, AttentionCard, StatusPill)
 * aby user hneď videl, ako appka reálne vyzerá — nie generický mockup.
 * Obsahuje floating UI karty (toast, quick action) pre pocit živej appky.
 */
import { KPITile, AttentionCard, StatusPill } from '../components/ui';

export function HeroPreview() {
  return (
    <div className="hero-preview" aria-hidden="true">
      <div className="hero-preview-browser">
        <div className="hero-preview-topbar">
          <span className="hero-preview-dot" style={{ background: '#fc6058' }} />
          <span className="hero-preview-dot" style={{ background: '#fed84b' }} />
          <span className="hero-preview-dot" style={{ background: '#36cd4d' }} />
          <span className="hero-preview-url">domovplus.sk/b/hviezdoslavova-12</span>
        </div>
        <div className="hero-preview-body">
          <div className="hero-preview-title">
            <div className="hero-preview-h">Dobré ráno, Jana.</div>
            <div className="hero-preview-sub">2 veci čakajú na rozhodnutie.</div>
          </div>

          <div className="hero-preview-kpi">
            <KPITile label="Nedoplatky" value="169,50 €" tone="pending" />
            <KPITile label="Tikety" value={2} tone="pending" />
            <KPITile label="Revízie" value={1} tone="ok" />
          </div>

          <div className="hero-preview-card">
            <AttentionCard
              severity="urgent"
              meta="Porucha"
              icon="🔧"
              title="Výtok vody v pivnici"
              body="Nahlásené pred 2 h · byt 03"
            />
          </div>
          <div className="hero-preview-card">
            <AttentionCard
              severity="pending"
              meta="Hlasovanie · 6 h"
              icon="🗳️"
              title="Rekonštrukcia strechy"
              body="34 % kvórum dosiahnuté"
            />
          </div>
        </div>
      </div>

      {/* Floating UI */}
      <div className="hero-float hero-float-toast">
        <span className="hero-float-dot" />
        <div>
          <strong>Peter uhradil faktúru</strong>
          <div>124,50 € · byt 02</div>
        </div>
      </div>

      <div className="hero-float hero-float-qr">
        <div className="hero-qr-stripes" />
        <div className="hero-qr-text">
          <StatusPill tone="ok" dot>QR platba pripravená</StatusPill>
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--fg-muted)' }}>
            Naskenovať v mobilnej banke
          </div>
        </div>
      </div>
    </div>
  );
}
