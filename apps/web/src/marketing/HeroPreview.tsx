/**
 * HeroPreview — dual mockup (desktop browser + mobile phone).
 *
 * Desktop: chairman dashboard s KPI tiles + 2 attention cards
 * Mobile: resident view s poruchou + hlasovaním (prekrýva desktop cez roh)
 */
import { KPITile, AttentionCard } from '../components/ui';

export function HeroPreview() {
  return (
    <div className="hero-preview" aria-hidden="true">
      {/* Desktop browser mockup */}
      <div className="hero-preview-browser">
        <div className="hero-preview-topbar">
          <span className="hero-preview-dot" style={{ background: '#fc6058' }} />
          <span className="hero-preview-dot" style={{ background: '#fed84b' }} />
          <span className="hero-preview-dot" style={{ background: '#36cd4d' }} />
          <span className="hero-preview-url">domovplus.sk/b/hviezdoslavova-12</span>
          <span className="hero-preview-live">
            <span className="hero-preview-live-dot" /> Live
          </span>
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

      {/* Mobile phone mockup — overlap pravý dolný roh */}
      <div className="hero-preview-phone">
        <div className="phone-notch" />
        <div className="phone-screen">
          <div className="phone-statusbar">
            <span>9:41</span>
            <span className="phone-signal">•••</span>
          </div>
          <div className="phone-app-head">
            <div className="phone-app-greet">Dobré ráno, Peter</div>
            <div className="phone-app-sub">Byt 02 · Hviezdoslavova 12</div>
          </div>

          <div className="phone-qr-card">
            <div className="phone-qr-pattern" />
            <div className="phone-qr-body">
              <div className="phone-qr-title">Faktúra · január</div>
              <div className="phone-qr-amount">124,50 €</div>
              <div className="phone-qr-cta">Zaplatiť QR</div>
            </div>
          </div>

          <div className="phone-vote-card">
            <div className="phone-vote-meta">HLASOVANIE</div>
            <div className="phone-vote-title">Rekonštrukcia strechy</div>
            <div className="phone-vote-buttons">
              <span className="phone-vote-btn phone-vote-yes">✓ Áno</span>
              <span className="phone-vote-btn phone-vote-no">✕ Nie</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
