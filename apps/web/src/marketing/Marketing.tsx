/**
 * Marketing / landing page — clean, modern, less-is-more (Vercel/Linear vibe).
 *
 * Štruktúra:
 *   1. Hero          — veľké H1 + app preview
 *   2. Proof row     — kde nás používajú (miesta, jeden riadok)
 *   3. Feature strip — 6 kariet s ikonami
 *   4. Role gateway  — pre každú rolu
 *   5. How it works  — 3 kroky
 *   6. Pricing       — 3 stĺpce
 *   7. Quote         — jeden veľký citát
 *   8. Final CTA     — forma + tlačidlo
 *   9. Footer
 *
 * Reveal komponent aplikuje fade-up animáciu na scroll cez IntersectionObserver.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setTokens } from '../api';
import { RoleGateway } from '../components/RoleGateway';
import { HeroPreview } from './HeroPreview';
import { useMarketingCopy } from './copy';

export function MarketingPage() {
  // Scroll-to-top pri navigácii cez # linky (Safari bug fix)
  useEffect(() => {
    if (location.hash) return;
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="mk">
      <Hero />
      <ProofRow />
      <FeatureStrip />
      <BeforeAfter />
      <ProductShowcase />
      <RoleGateway variant="full" />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <LeadMagnet />
      <Quote />
      <DemoCall />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* =============================== Hero =============================== */

function Hero() {
  const c = useMarketingCopy();
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoErr, setDemoErr] = useState<string | null>(null);

  async function startDemo() {
    setDemoBusy(true);
    setDemoErr(null);
    try {
      const res = await api<{ accessToken: string; refreshToken: string }>('/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setTokens(res.accessToken, res.refreshToken);
      window.location.assign('/');
    } catch (e) {
      setDemoErr((e as Error).message);
      setDemoBusy(false);
    }
  }

  return (
    <section className="mk-hero" id="hero" aria-labelledby="hero-h">
      <div className="mk-hero-inner">
        <div className="mk-hero-text">
          <span className="mk-eyebrow">
            <span className="mk-dot" /> {c.hero.eyebrow}
          </span>
          <h1 id="hero-h" className="mk-h1">
            {c.hero.h1Pre}<span className="mk-accent">{c.hero.h1Accent}</span>{c.hero.h1Post}
          </h1>
          <p className="mk-lead">{c.hero.lead}</p>
          <div className="mk-cta">
            <button
              type="button"
              onClick={startDemo}
              disabled={demoBusy}
              className="mk-btn mk-btn-primary"
            >
              {demoBusy ? c.hero.ctaDemoBusy : c.hero.ctaDemo}
            </button>
            <Link to="/registracia" className="mk-btn mk-btn-secondary">
              {c.hero.ctaFree}
            </Link>
          </div>
          {demoErr && <p className="mk-err">{demoErr}</p>}
          <p className="mk-trust">{c.hero.trust}</p>
          <p className="mk-trust mk-trust-alt">
            <a href="#demo-call">{c.hero.trustAlt}</a>
          </p>
        </div>
        <HeroPreview />
      </div>
    </section>
  );
}

/* =============================== Proof =============================== */

function ProofRow() {
  const c = useMarketingCopy();
  return (
    <Reveal>
      <section className="mk-pilot-banner" aria-label="Pilot">
        <div className="mk-container">
          <div className="mk-pilot-inner">
            <div className="mk-pilot-badge">
              <span className="mk-pilot-pulse" aria-hidden="true" />
              {c.pilot.badge}
            </div>
            <div className="mk-pilot-text">
              <strong>{c.pilot.text.strong}</strong>{c.pilot.text.rest}
            </div>
            <a href="#demo-call" className="mk-pilot-cta">{c.pilot.cta}</a>
          </div>
        </div>
      </section>
    </Reveal>
  );
}

/* =========================== Feature strip =========================== */

function FeatureStrip() {
  const c = useMarketingCopy();
  const icons = [<IcoVote />, <IcoMoney />, <IcoWrench />, <IcoCalendar />, <IcoTool />, <IcoShield />, <IcoMegaphone />, <IcoEnergy />, <IcoBazaar />];
  const items = c.features.items.map((it, i) => ({ t: it.t, b: it.b, i: icons[i] }));
  return (
    <Reveal>
      <section className="mk-section mk-soft" id="funkcie" aria-labelledby="feat-h">
        <div className="mk-container">
          <SectionHead
            kicker={c.features.kicker}
            title={c.features.title}
            subtitle={c.features.subtitle}
          />
          <div className="feat-grid">
            {items.map((f, i) => (
              <article key={i} className="feat-card" style={{ ['--stagger' as any]: `${i * 60}ms` }}>
                <div className="feat-icon" aria-hidden="true">{f.i}</div>
                <h3 className="feat-title">{f.t}</h3>
                <p className="feat-body">{f.b}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </Reveal>
  );
}

/* ============================ Before / After ============================ */

function BeforeAfter() {
  const c = useMarketingCopy();
  return (
    <Reveal>
      <section className="mk-section mk-soft mk-ba" id="porovnanie" aria-labelledby="ba-h">
        <div className="mk-container">
          <SectionHead
            kicker={c.beforeAfter.kicker}
            title={c.beforeAfter.title}
            subtitle={c.beforeAfter.subtitle}
          />
          <div className="ba-table">
            <div className="ba-thead">
              <div className="ba-th-area">{c.beforeAfter.headers.area}</div>
              <div className="ba-th-before">
                <span className="ba-th-pill ba-th-pill-before">{c.beforeAfter.headers.before}</span>
              </div>
              <div className="ba-th-after">
                <span className="ba-th-pill ba-th-pill-after">{c.beforeAfter.headers.after}</span>
              </div>
            </div>
            {c.beforeAfter.rows.map((r, i) => (
              <div key={r.area} className="ba-row" style={{ ['--stagger' as any]: `${i * 50}ms` }}>
                <div className="ba-area">{r.area}</div>
                <div className="ba-before">
                  <span className="ba-mark ba-mark-before" aria-hidden="true">✕</span>
                  <span>{r.before}</span>
                </div>
                <div className="ba-after">
                  <span className="ba-mark ba-mark-after" aria-hidden="true">✓</span>
                  <span>{r.after}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="ba-summary">
            {c.beforeAfter.summary.map((s) => (
              <div key={s.label} className="ba-summary-stat">
                <div className="ba-stat-num">{s.num}</div>
                <div className="ba-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Reveal>
  );
}

/* ============================ Product showcase ============================ */

function ProductShowcase() {
  const c = useMarketingCopy();
  return (
    <Reveal>
      <section className="mk-section mk-showcase" aria-labelledby="show-h">
        <div className="mk-container">
          <SectionHead
            kicker={c.showcase.kicker}
            title={c.showcase.title}
            subtitle={c.showcase.subtitle}
          />

          {/* Row 1: Chairman dashboard */}
          <div className="showcase-row">
            <div className="showcase-text">
              <div className="showcase-pill">Predseda SVB / BD</div>
              <h3 className="showcase-h">Všetko na jednom dashboarde</h3>
              <p className="showcase-body">
                Urgentné poruchy, otvorené hlasovania, nedoplatky a blížiace sa revízie — všetko uvidíte hneď po prihlásení.
                Bez preklikávania cez 5 záložiek.
              </p>
              <ul className="showcase-list">
                <li>Live KPI: nedoplatky, tikety, revízie</li>
                <li>Attention cards s akciou (jedno kliknutie = vyriešené)</li>
                <li>Audit log všetkého, čo sa v dome deje</li>
              </ul>
            </div>
            <MockupChairman />
          </div>

          {/* Row 2: Resident mobile (reverse) */}
          <div className="showcase-row showcase-reverse">
            <div className="showcase-text">
              <div className="showcase-pill showcase-pill-blue">Vlastník bytu</div>
              <h3 className="showcase-h">Z mobilu, aj keď ste na dovolenke</h3>
              <p className="showcase-body">
                Vlastník vidí iba to, čo ho reálne zaujíma: svoju faktúru s QR platbou, otvorené hlasovanie a nahlásené
                poruchy. Žiadne tabuľky, žiadne PDF.
              </p>
              <ul className="showcase-list">
                <li>SEPA QR platba — banka predvyplní všetko</li>
                <li>Hlasovanie jedným ťuknutím</li>
                <li>Push notifikácia pri novej schôdzi / faktúre</li>
              </ul>
            </div>
            <MockupResident />
          </div>

          {/* Row 3: Voting */}
          <div className="showcase-row">
            <div className="showcase-text">
              <div className="showcase-pill showcase-pill-orange">Hlasovania</div>
              <h3 className="showcase-h">Zápisnica s XAdES podpisom za 3 dni</h3>
              <p className="showcase-body">
                Predseda otvorí hlasovanie, vlastníci hlasujú z mobilu, po uzávierke sa automaticky vygeneruje zápisnica
                vo formáte PDF s detached XAdES-BES podpisom. Žiaden notár, žiadne prepisovanie.
              </p>
              <ul className="showcase-list">
                <li>Quorum-aware: systém počíta podiely automaticky</li>
                <li>Listinný hlas má prednosť — anti-duplicity</li>
                <li>Audit hash-chain (SHA-256) neprepíšete</li>
              </ul>
            </div>
            <MockupVoting />
          </div>
        </div>
      </section>
    </Reveal>
  );
}

function MockupChairman() {
  return (
    <RealMockup
      src="/screenshots/chairman-dashboard.png"
      alt="Floory chairman dashboard — KPI tiles, urgent ticket, otvorené hlasovanie"
    />
  );
}

function MockupResident() {
  return (
    <div className="mockup mockup-phone-lg">
      <div className="phone-lg-frame">
        <div className="phone-lg-notch" />
        <div className="phone-lg-screen-img">
          <img src="/screenshots/mobile-home.png" alt="Floory resident view — faktúra QR, hlasovanie z mobilu" />
        </div>
      </div>
    </div>
  );
}

function MockupVoting() {
  return (
    <RealMockup
      src="/screenshots/chairman-voting.png"
      alt="Floory voting screen — quorum tracker, vote counts, status"
    />
  );
}

/* Generický wrapper pre reálny screenshot — browser frame okolo PNG-čka */
function RealMockup({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="mockup mockup-desktop mockup-real">
      <div className="mockup-bar">
        <span className="mockup-dot" style={{ background: '#fc6058' }} />
        <span className="mockup-dot" style={{ background: '#fed84b' }} />
        <span className="mockup-dot" style={{ background: '#36cd4d' }} />
        <span className="mockup-url">floory.sk</span>
      </div>
      <div className="mockup-real-img">
        <img src={src} alt={alt} loading="lazy" />
      </div>
    </div>
  );
}

/* ============================ How it works ============================ */

function HowItWorks() {
  const c = useMarketingCopy();
  return (
    <Reveal>
      <section className="mk-section" id="how" aria-labelledby="how-h">
        <div className="mk-container">
          <SectionHead
            kicker={c.how.kicker}
            title={c.how.title}
            subtitle={c.how.subtitle}
          />
          <ol className="steps">
            {c.how.steps.map((s, i) => (
              <li key={s.n} className="step" style={{ ['--stagger' as any]: `${i * 120}ms` }}>
                <div className="step-n">{s.n}</div>
                <div>
                  <h3 className="step-t">{s.t}</h3>
                  <p className="step-b">{s.b}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </Reveal>
  );
}

/* =============================== Pricing =============================== */

function Pricing() {
  const c = useMarketingCopy();
  return (
    <Reveal>
      <section className="mk-section mk-soft" id="cennik" aria-labelledby="price-h">
        <div className="mk-container">
          <SectionHead
            kicker={c.pricing.kicker}
            title={c.pricing.title}
            subtitle={c.pricing.subtitle}
          />
          <div className="price-grid">
            {c.pricing.plans.map((p, i) => (
              <PriceCard
                key={p.tag}
                tag={p.tag}
                price={p.price}
                unit={p.unit}
                desc={p.desc}
                bullets={p.bullets}
                cta={p.cta}
                to={i === 2 ? '/#pilot' : '/registracia'}
                highlight={i === 1}
                stagger={i * 120}
              />
            ))}
          </div>
          <p className="inline-meta" style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            {c.pricing.note}
          </p>

          <PriceCalculatorToggle />
        </div>
      </section>
    </Reveal>
  );
}

function PriceCalculatorToggle() {
  const c = useMarketingCopy();
  const [open, setOpen] = useState(false);
  return (
    <div className="price-calc-toggle-wrap">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="price-calc-trigger"
          aria-expanded="false"
          aria-controls="price-calc-panel"
        >
          <span className="price-calc-trigger-ic">🧮</span>
          <span>
            <strong>{c.pricing.calc.trigger}</strong>
            <span className="price-calc-trigger-sub">{c.pricing.calc.triggerSub}</span>
          </span>
          <span className="price-calc-trigger-arrow">↓</span>
        </button>
      ) : (
        <div id="price-calc-panel">
          <PriceCalculator />
          <div className="price-calc-close-wrap">
            <button type="button" className="price-calc-close" onClick={() => setOpen(false)}>
              {c.pricing.calc.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PriceCalculator() {
  const c = useMarketingCopy();
  const [units, setUnits] = useState<number>(24);
  const PRICE_PER_UNIT = 2.49;
  const monthly = units * PRICE_PER_UNIT;
  const yearly = monthly * 12;
  const perUnitYearly = PRICE_PER_UNIT * 12;
  const dailyPerUnit = perUnitYearly / 365;
  const perUnitMonthly = yearly / units / 12;

  return (
    <div className="price-calc">
      <div className="price-calc-head">
        <div className="price-calc-pill">{c.pricing.calc.pill}</div>
        <h3 className="price-calc-h">{c.pricing.calc.h}</h3>
        <p className="price-calc-sub">{c.pricing.calc.sub}</p>
      </div>

      <div className="price-calc-slider-row">
        <div className="price-calc-slider-label">
          <span>{c.pricing.calc.units}</span>
          <strong>{units}</strong>
        </div>
        <input
          type="range"
          min={6}
          max={200}
          step={1}
          value={units}
          onChange={(e) => setUnits(Number(e.target.value))}
          className="price-calc-slider"
          style={{ ['--p' as any]: `${((units - 6) / (200 - 6)) * 100}%` }}
          aria-label={c.pricing.calc.units}
        />
        <div className="price-calc-slider-marks">
          <span>6</span><span>50</span><span>100</span><span>150</span><span>200</span>
        </div>
      </div>

      <div className="price-calc-result">
        <div className="price-calc-cell">
          <div className="price-calc-cell-label">{c.pricing.calc.monthly}</div>
          <div className="price-calc-cell-val">{monthly.toFixed(2)} €</div>
          <div className="price-calc-cell-meta">{units} × 2,49 €</div>
        </div>
        <div className="price-calc-cell price-calc-cell-hl">
          <div className="price-calc-cell-label">{c.pricing.calc.yearly}</div>
          <div className="price-calc-cell-val">{yearly.toFixed(0)} €</div>
          <div className="price-calc-cell-meta">{(yearly / 12).toFixed(2)} € / {c.pricing.calc.monthly.toLowerCase()}</div>
        </div>
        <div className="price-calc-cell">
          <div className="price-calc-cell-label">{c.pricing.calc.perUnit}</div>
          <div className="price-calc-cell-val">{perUnitYearly.toFixed(2)} €</div>
          <div className="price-calc-cell-meta">{dailyPerUnit.toFixed(2)} € / d</div>
        </div>
      </div>

      <div
        className="price-calc-context"
        dangerouslySetInnerHTML={{ __html: c.pricing.calc.contextHtml(units, yearly, perUnitMonthly) }}
      />

      <div className="price-calc-cta">
        <Link to="/registracia" className="mk-btn mk-btn-primary">
          {c.pricing.calc.ctaFree}
        </Link>
        <a href="#demo-call" className="mk-btn mk-btn-secondary">
          {c.pricing.calc.ctaCall}
        </a>
      </div>
    </div>
  );
}

function PriceCard({ tag, price, unit, desc, bullets, cta, to, highlight, stagger = 0 }: {
  tag: string; price: string; unit: string; desc: string; bullets: string[];
  cta: string; to: string; highlight?: boolean; stagger?: number;
}) {
  return (
    <div className={`price-card ${highlight ? 'price-hl' : ''}`} style={{ ['--stagger' as any]: `${stagger}ms` }}>
      {highlight && <div className="price-ribbon">Najobľúbenejšie</div>}
      <div className="price-tag">{tag}</div>
      <div className="price-value"><strong>{price}</strong>{unit && <span> {unit}</span>}</div>
      <p className="price-desc">{desc}</p>
      <ul className="price-bullets">
        {bullets.map((b) => <li key={b}>{b}</li>)}
      </ul>
      {to.startsWith('/#') ? (
        <a href={to.slice(1)} className={`mk-btn ${highlight ? 'mk-btn-primary' : 'mk-btn-secondary'} mk-btn-block`}>{cta}</a>
      ) : (
        <Link to={to} className={`mk-btn ${highlight ? 'mk-btn-primary' : 'mk-btn-secondary'} mk-btn-block`}>{cta}</Link>
      )}
    </div>
  );
}

/* ================================ Quote ================================ */

function Quote() {
  const c = useMarketingCopy();
  return (
    <Reveal>
      <section className="mk-section">
        <div className="mk-container">
          <figure className="big-quote">
            <div className="big-quote-mark" aria-hidden="true">„</div>
            <blockquote>{c.quote.blockquote}</blockquote>
            <figcaption>
              <strong>{c.quote.name}</strong>
              <span>{c.quote.sub}</span>
            </figcaption>
          </figure>
        </div>
      </section>
    </Reveal>
  );
}

/* ================================= FAQ ================================= */

function FAQ() {
  const c = useMarketingCopy();
  const items = c.faq.items;
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, 4);
  const hiddenCount = items.length - 4;

  return (
    <Reveal>
      <section className="mk-section mk-soft" id="faq" aria-labelledby="faq-h">
        <div className="mk-container">
          <SectionHead
            kicker={c.faq.kicker}
            title={c.faq.title}
            subtitle={c.faq.subtitle}
          />
          <div className="faq-list">
            {visible.map((it, i) => (
              <details key={i} className="faq-item" open={i === 0 && !showAll}>
                <summary className="faq-q">
                  <span>{it.q}</span>
                  <span className="faq-chev" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </summary>
                <div className="faq-a">{it.a}</div>
              </details>
            ))}
          </div>
          {!showAll && hiddenCount > 0 && (
            <div className="faq-more-wrap">
              <button type="button" className="faq-more-btn" onClick={() => setShowAll(true)}>
                {c.faq.showMore(hiddenCount)}
              </button>
            </div>
          )}
        </div>
      </section>
    </Reveal>
  );
}

/* ============================ Lead magnet ============================ */

function LeadMagnet() {
  const c = useMarketingCopy();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    setErr(null);
    try {
      // Pošleme do /leads ako "downloaded checklist" lead — capture email pre nurturing
      await api('/leads', {
        method: 'POST',
        body: JSON.stringify({ email, source: 'checklist-download' }),
      }).catch(() => null); // aj keď fail, dovolíme stiahnuť — lead capture je nice-to-have
      setDone(true);
      // Trigger download
      const link = document.createElement('a');
      link.href = '/checklist-prvej-elektronickej-schodze.pdf';
      link.download = 'Floory-checklist-prvej-elektronickej-schodze.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Reveal>
      <section className="mk-section mk-leadmagnet" id="checklist" aria-labelledby="lm-h">
        <div className="mk-container">
          <div className="lm-card">
            <div className="lm-left">
              <div className="lm-pill">{c.leadMagnet.pill}</div>
              <h2 id="lm-h" className="lm-h">
                {c.leadMagnet.h1}<br />{c.leadMagnet.h2}
              </h2>
              <p className="lm-body" dangerouslySetInnerHTML={{ __html: c.leadMagnet.body.replace(/§([\w\d. ]+)/g, '<strong>§$1</strong>') }} />
              <ul className="lm-list">
                {c.leadMagnet.bullets.map((b) => <li key={b}>{b}</li>)}
              </ul>

              {!done ? (
                <form onSubmit={submit} className="lm-form">
                  <input
                    type="email"
                    required
                    placeholder={c.leadMagnet.placeholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-label="Email"
                  />
                  <button type="submit" disabled={busy} className="mk-btn mk-btn-primary">
                    {busy ? c.leadMagnet.submitting : c.leadMagnet.submit}
                  </button>
                </form>
              ) : (
                <div className="lm-thanks">
                  <div className="lm-check" aria-hidden="true">✓</div>
                  <div>
                    <strong>{c.leadMagnet.thanksTitle}</strong>
                    <div>{c.leadMagnet.thanksBody}<a href="/checklist-prvej-elektronickej-schodze.pdf" download>{c.leadMagnet.thanksLink}</a>.</div>
                  </div>
                </div>
              )}
              {err && <p className="mk-err">{err}</p>}
              <p className="lm-trust">{c.leadMagnet.trust}</p>
            </div>
            <div className="lm-right">
              <div className="lm-pdf-preview">
                <div className="lm-pdf-band">{c.leadMagnet.pdfBand}</div>
                <div className="lm-pdf-title">{c.leadMagnet.pdfTitle}</div>
                <div className="lm-pdf-pages">{c.leadMagnet.pdfPages}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Reveal>
  );
}

/* ============================ Demo call CTA ============================ */

function DemoCall() {
  const c = useMarketingCopy();
  return (
    <Reveal>
      <section className="mk-section mk-democall" id="demo-call" aria-labelledby="demo-h">
        <div className="mk-container">
          <div className="democall-card">
            <div className="democall-left">
              <div className="democall-badge">{c.demoCall.badge}</div>
              <h2 id="demo-h" className="democall-h">{c.demoCall.h}</h2>
              <p className="democall-body">{c.demoCall.body}</p>
              <ul className="democall-list">
                {c.demoCall.bullets.map((b) => <li key={b}>{b}</li>)}
              </ul>
            </div>
            <div className="democall-right">
              <a href="mailto:hello@floory.sk?subject=Demo Floory" className="mk-btn mk-btn-primary democall-btn">
                📧 hello@floory.sk
              </a>
              <a href="tel:+421911000000" className="mk-btn mk-btn-secondary democall-btn">
                📞 +421 911 000 000
              </a>
              <div className="democall-hours" style={{ whiteSpace: 'pre-line' }}>
                {c.demoCall.hours}
              </div>
            </div>
          </div>
        </div>
      </section>
    </Reveal>
  );
}

/* ============================= Final CTA ============================= */

function FinalCTA() {
  const c = useMarketingCopy();
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [units, setUnits] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api('/leads', {
        method: 'POST',
        body: JSON.stringify({
          email,
          city: city || undefined,
          units: units ? Number(units) : undefined,
          source: 'landing',
        }),
      });
      setSent(true);
    } catch {
      setErr('Odoslanie zlyhalo. Napíšte priamo na hello@floory.sk.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mk-final" id="pilot" aria-labelledby="final-h">
      <div className="mk-container">
        <h2 id="final-h" className="mk-final-h">
          {c.finalCta.h1}<span className="mk-accent">{c.finalCta.h2}</span>
        </h2>
        <p className="mk-final-sub">{c.finalCta.sub}</p>
        {sent ? (
          <div className="mk-final-thanks">
            <div className="mk-thanks-icon" aria-hidden="true">✓</div>
            <h3>{c.finalCta.thanksTitle}</h3>
            <p>{c.finalCta.thanksBody(email)}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mk-final-form">
            <input type="email" required placeholder={c.finalCta.placeholderEmail} value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
            <input placeholder={c.finalCta.placeholderCity} value={city} onChange={(e) => setCity(e.target.value)} aria-label={c.finalCta.placeholderCity} />
            <input type="number" min={1} placeholder={c.finalCta.placeholderUnits} value={units} onChange={(e) => setUnits(e.target.value)} aria-label={c.finalCta.placeholderUnits} />
            <button type="submit" className="mk-btn mk-btn-primary" disabled={busy}>
              {busy ? c.finalCta.submitting : c.finalCta.submit}
            </button>
          </form>
        )}
        {err && <p className="mk-err" style={{ textAlign: 'center' }}>{err}</p>}
        <p className="mk-final-alt">
          {c.finalCta.alt}<Link to="/registracia">{c.finalCta.altLink}</Link>.
        </p>
      </div>
    </section>
  );
}

/* ================================ Footer ================================ */

function Footer() {
  const c = useMarketingCopy();
  return (
    <footer className="mk-footer">
      <div className="mk-container">
        <div className="mk-footer-top">
          <div className="mk-footer-brand">
            <div className="mk-footer-logo">
              <span className="mk-footer-mark" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </span>
              <strong>Floory</strong>
            </div>
            <p className="mk-footer-tagline" style={{ whiteSpace: 'pre-line' }}>{c.footer.tagline}</p>
            <div className="mk-footer-badges">
              {c.footer.badges.map((b) => (
                <span key={b} className="mk-footer-badge">{b}</span>
              ))}
            </div>
          </div>

          <div className="mk-footer-cols">
            {c.footer.cols.map((col) => (
              <div key={col.title} className="mk-footer-col">
                <div className="mk-footer-h">{col.title}</div>
                {col.links.map((l) =>
                  l.href.startsWith('#') || l.href.startsWith('mailto:') || l.href.startsWith('tel:')
                    ? <a key={l.label} href={l.href}>{l.label}</a>
                    : <Link key={l.label} to={l.href}>{l.label}</Link>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mk-footer-bottom">
          <div className="mk-footer-legal">
            {c.footer.legal} · <Link to="/obchodne-podmienky">{c.footer.legalLinks.terms}</Link> · <Link to="/ochrana-udajov">{c.footer.legalLinks.privacy}</Link> · <Link to="/spracovanie-udajov">{c.footer.legalLinks.dpa}</Link>
          </div>
          <div className="mk-footer-made">
            <Link to="/status">● Status</Link> · <Link to="/changelog">Changelog</Link> · v0.1.0
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ============================= Helpers ============================= */

function SectionHead({ kicker, title, subtitle }: { kicker?: string; title: string; subtitle?: string }) {
  return (
    <header className="section-head">
      {kicker && <div className="section-kicker">{kicker}</div>}
      <h2 className="section-title">{title}</h2>
      {subtitle && <p className="section-sub">{subtitle}</p>}
    </header>
  );
}

// Counter pre stagger — každý Reveal na stránke dostane rastúci delay,
// aby fade-in bolo vidno aj keď je na veľkom monitore viacero sekcií vo
// viewport-e naraz pri mount-e.
let revealCounter = 0;
function Reveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const delayRef = useRef<number>(0);
  if (delayRef.current === 0) {
    revealCounter += 1;
    delayRef.current = revealCounter;
  }
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // stagger: čím ďalej je sekcia od top-u, tým dlhší delay (max 600ms)
          const baseDelay = Math.min((delayRef.current - 1) * 120, 600);
          setTimeout(() => setVisible(true), baseDelay);
          io.disconnect();
        }
      },
      { threshold: 0.05, rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    // Reset counter po poslednom Reveal-e — pri HMR sa inak stackuje
    return () => {
      io.disconnect();
      if (delayRef.current === revealCounter) revealCounter = 0;
    };
  }, []);
  return <div ref={ref} className={`reveal ${visible ? 'reveal-in' : ''}`}>{children}</div>;
}

/* ============================== Icons ============================== */

const iconProps = {
  width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
};
function IcoVote() { return (<svg {...iconProps}><path d="m9 12 2 2 4-4" /><path d="M5 7h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" /><path d="M16 3v4M8 3v4" /></svg>); }
function IcoMoney() { return (<svg {...iconProps}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>); }
function IcoWrench() { return (<svg {...iconProps}><path d="M14.7 6.3a4 4 0 0 0-5.3 5.3L3 18l3 3 6.4-6.4a4 4 0 0 0 5.3-5.3l-2.3 2.3-2-2z" /></svg>); }
function IcoCalendar() { return (<svg {...iconProps}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>); }
function IcoTool() { return (<svg {...iconProps}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13l2 2 4-4" /></svg>); }
function IcoShield() { return (<svg {...iconProps}><path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5z" /><path d="m9 12 2 2 4-4" /></svg>); }
function IcoMegaphone() { return (<svg {...iconProps}><path d="M3 11v2a2 2 0 0 0 2 2h1l3 4V7L6 11H5a2 2 0 0 0-2 0z" /><path d="M14 7a6 6 0 0 1 0 10M18 4a10 10 0 0 1 0 16" /></svg>); }
function IcoEnergy() { return (<svg {...iconProps}><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>); }
function IcoBazaar() { return (<svg {...iconProps}><path d="M3 9h18l-1.5 9a2 2 0 0 1-2 1.8H6.5a2 2 0 0 1-2-1.8L3 9z" /><path d="M8 9V6a4 4 0 0 1 8 0v3" /></svg>); }
