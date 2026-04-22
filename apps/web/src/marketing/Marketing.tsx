/**
 * Marketing / landing page.
 *
 * High-converting layout podľa redesign briefu:
 *   Hero → Social proof → Problem/Solution → Features (F→B→O) → How it works
 *   → Pricing → Testimonials → FAQ → Final CTA → Footer
 *
 * Každá sekcia používa `<Link>` (SPA) pre vnútorné navigácie.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { RoleGateway } from '../components/RoleGateway';
import { HeroPreview } from './HeroPreview';

export function MarketingPage() {
  return (
    <div className="mk">
      <Hero />
      <SocialProof />
      <RoleGateway variant="full" />
      <WaveDivider label="Ako to funguje" />
      <Problem />
      <Features />
      <Preview />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function WaveDivider({ label }: { label?: string }) {
  return (
    <div className="mk-wave" aria-hidden="true">
      <div className="mk-wave-dot">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <circle cx="5" cy="5" r="3" fill="currentColor" />
          <circle cx="5" cy="5" r="4.5" fill="none" stroke="currentColor" strokeOpacity="0.4" />
        </svg>
        {label && <span>{label}</span>}
      </div>
    </div>
  );
}

/* ============================ Role section ============================ */

/* (Role sekcia presunutá do shared RoleGateway komponentu) */

/* ============================ Preview mockup ============================ */

function Preview() {
  return (
    <section className="mk-section mk-grid-light" aria-labelledby="prev-h">
      <div className="mk-container">
        <h2 id="prev-h" className="mk-h2">Takto to vyzerá v praxi</h2>
        <p className="mk-sub">Náhľad dashboardu predsedu — priority-triedený attention row namiesto zoznamu položiek.</p>
        <div className="mk-preview">
          <div className="mk-preview-bar">
            <span className="mk-preview-dot" /><span className="mk-preview-dot" /><span className="mk-preview-dot" />
            <span className="mk-preview-url">domovplus.sk/b/hviezdoslavova-12</span>
          </div>
          <div className="mk-preview-body">
            <div className="mk-preview-greet">
              <strong>Dobrý deň, Jana.</strong>
              <span>3 veci čakajú na rozhodnutie.</span>
            </div>
            <div className="mk-preview-cards">
              <div className="mk-prev-card urgent">
                <span className="mk-prev-tag">🔴 Kritická porucha</span>
                <strong>Výtok vody v pivnici</strong>
                <span className="mk-prev-meta">pred 2 h · byt 05 · nepridelená</span>
                <span className="mk-prev-btn">Prideliť údržbárovi</span>
              </div>
              <div className="mk-prev-card urgent">
                <span className="mk-prev-tag">🔴 Hlasovanie končí</span>
                <strong>Rekonštrukcia strechy</strong>
                <span className="mk-prev-meta">za 6 h · 34 % kvórum</span>
                <span className="mk-prev-btn">Pripomenúť</span>
              </div>
              <div className="mk-prev-card pending">
                <span className="mk-prev-tag">🟠 Revízia 12 dní</span>
                <strong>Úradná skúška výťahu</strong>
                <span className="mk-prev-meta">Schindler SK · +421 2 …</span>
                <span className="mk-prev-btn">Naplánovať</span>
              </div>
            </div>
            <div className="mk-preview-stats">
              <div><span>6/6</span>registrovaní</div>
              <div><span>83 %</span>čítanosť oznamov</div>
              <div><span>8 420 €</span>fond opráv</div>
              <div><span>0</span>revízie po splatnosti</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================ Hero ================================ */

function Hero() {
  return (
    <section className="mk-hero" aria-labelledby="hero-h">
      <div className="mk-hero-inner">
        <div className="mk-hero-text">
          <span className="mk-eyebrow">
            <span className="mk-dot" /> Pre SVB · BD · SVJ v SR a ČR
          </span>
          <h1 id="hero-h" className="mk-h1">
            Bytový dom bez <span className="mk-accent">papierov, chatov</span> a zmätku.
          </h1>
          <p className="mk-lead">
            DomovPlus je operačný systém pre bytový dom. Hlasovania, faktúry, poruchy, schôdze
            a komunikácia so susedmi — všetko na jednom mieste, aj pre tých, ktorí technike
            nerozumejú.
          </p>
          <div className="mk-cta">
            <Link to="/registracia" className="mk-btn mk-btn-primary">
              Vyskúšať zadarmo 30 dní →
            </Link>
            <a href="#how" className="mk-btn mk-btn-secondary">
              Ako to funguje
            </a>
          </div>
          <p className="mk-trust">
            Používajú nás SVB z Bratislavy, Trnavy a Košíc · bez platobnej karty · 14-denná
            záruka vrátenia peňazí
          </p>
        </div>
        <HeroPreview />
      </div>
    </section>
  );
}

/* =========================== Social proof ============================ */

function SocialProof() {
  const quotes = [
    { by: 'Jana, predseda SVB', city: 'Bratislava', body: 'Ušetril mi 4 hodiny mesačne.' },
    { by: 'Marek, správca', city: 'Trnava', body: 'Konečne viem, kto zaplatil a kto nie.' },
    { by: 'Lucia, vlastníčka', city: 'Brno', body: 'Hlasujem z mobilu cez kávu v práci.' },
  ];
  return (
    <section className="mk-section mk-proof" aria-label="Referencie">
      <div className="mk-container">
        <div className="mk-proof-grid">
          {quotes.map((q) => (
            <div key={q.by} className="mk-proof-item">
              <p className="mk-proof-body">„{q.body}"</p>
              <p className="mk-proof-by">— {q.by}, {q.city}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================ Problem / After =========================== */

function Problem() {
  const without = [
    'Oznamy na papieri, ktoré nikto nečíta',
    'WhatsApp skupina, kde sa susedia hádajú',
    'Hlasovania na schôdzi o 19:00 v stredu',
    'Excel tabuľka s faktúrami od 2019',
    'Porucha = 15 SMS predsedovi o polnoci',
  ];
  const withIt = [
    'Oznam s potvrdením prečítania',
    'Diskusia pri oznámení, nie v 3 chatoch',
    'Hlasovanie cez týždeň, kedykoľvek sa hodí',
    'QR kód na faktúre, peniaze na účte',
    'Fotka poruchy → údržbár to vie za minútu',
  ];
  return (
    <section className="mk-section mk-section-warm mk-noise" aria-labelledby="problem-h">
      <div className="mk-container">
        <h2 id="problem-h" className="mk-h2">Bytový dom bez chaosu</h2>
        <p className="mk-sub">Takto to vyzerá predtým a potom.</p>
        <div className="mk-ba-grid">
          <div className="mk-ba mk-ba-before">
            <h3>Bez DomovPlus</h3>
            <ul>{without.map((x) => <li key={x}>❌ {x}</li>)}</ul>
          </div>
          <div className="mk-ba mk-ba-after">
            <h3>S DomovPlus</h3>
            <ul>{withIt.map((x) => <li key={x}>✅ {x}</li>)}</ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =============================== Features (F→B→O) ============================== */

function Features() {
  const items = [
    {
      t: 'Online hlasovanie',
      f: 'Vlastníci hlasujú z mobilu počas celého týždňa',
      b: 'Výsledok máte za 3 dni, nie po 2 mesiacoch plánovania schôdze.',
    },
    {
      t: 'Faktúry s QR platbou',
      f: 'Vlastník naskenuje EPC/SEPA QR kód — banka mu predvyplní prevod',
      b: 'Z 30 vlastníkov platí do termínu 28, nie 18.',
    },
    {
      t: 'Hlásenie porúch',
      f: 'Fotka + popis z mobilu, údržbár dostane push okamžite',
      b: 'Opravy kratšie o 60 %, žiadne zabudnuté tikety.',
    },
    {
      t: 'Schôdze s programom',
      f: 'Bod po bode, RSVP dopredu, zápisnica v PDF',
      b: 'Schôdza trvá 45 minút namiesto 2 hodín.',
    },
    {
      t: 'Plán revízií',
      f: 'Kotol, výťah, bleskozvod — pripomienka 30 dní vopred',
      b: 'Nikdy viac pokuta za nespravenú revíziu.',
    },
    {
      t: 'Senior režim',
      f: 'Väčšie písmo, jednoduchšie obrazovky, hlasové čítanie',
      b: 'Aj babka zo 4. poschodia si zaplatí účet sama.',
    },
  ];
  return (
    <section className="mk-section mk-section-cool" id="funkcie" aria-labelledby="feat-h">
      <div className="mk-container">
        <h2 id="feat-h" className="mk-h2">Všetko čo bytový dom potrebuje</h2>
        <p className="mk-sub">Bez 7 rôznych appiek, bez Google tabuliek, bez štítov na nástenke.</p>
        <div className="mk-cards">
          {items.map((f, i) => (
            <article key={i} className="mk-card">
              <div className="mk-card-num">{String(i + 1).padStart(2, '0')}</div>
              <h3 className="mk-card-title">{f.t}</h3>
              <p className="mk-card-body">{f.f}</p>
              <p className="mk-card-outcome">
                → <strong>{f.b}</strong>
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================ How it works ============================ */

function HowItWorks() {
  const steps = [
    { t: 'Zaregistrujete sa', b: '2 minúty, bez kreditnej karty. Ako predseda SVB alebo správca.' },
    { t: 'Nahráte byty z Excelu', b: 'Systém vygeneruje aktivačné kódy pre vlastníkov.' },
    { t: 'Vlastníci sa pripoja', b: 'V priemere 80 % do týždňa. Pošlete im PDF/SMS/e-mail.' },
    { t: 'Riadite dom odkiaľkoľvek', b: 'Z mobilu, z práce, na dovolenke. Jedno miesto na všetko.' },
  ];
  return (
    <section className="mk-section" id="how" aria-labelledby="how-h">
      <div className="mk-container">
        <h2 id="how-h" className="mk-h2">Od registrácie po fungujúci dom za 30 minút</h2>
        <p className="mk-sub">Žiadne demo hovory, žiadna implementácia. Začnete hneď.</p>
        <ol className="mk-steps">
          {steps.map((s, i) => (
            <li key={i} className="mk-step">
              <div className="mk-step-n">{i + 1}</div>
              <div>
                <h3 className="mk-step-t">{s.t}</h3>
                <p className="mk-step-b">{s.b}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ================================ Pricing ================================ */

function Pricing() {
  return (
    <section className="mk-section mk-section-warm" id="cennik" aria-labelledby="price-h">
      <div className="mk-container">
        <h2 id="price-h" className="mk-h2">Jednoduchá cena</h2>
        <p className="mk-sub">
          Bez skrytých poplatkov. Platí sa zo spoločného účtu SVB, nie z peňazí predsedu.
        </p>
        <div className="mk-price-grid">
          <PriceCard
            tag="Štart"
            price="0 €"
            unit="30 dní zdarma"
            desc="Pre vyskúšanie bez záväzku."
            features={['Plná funkcionalita', 'Bez kreditnej karty', 'Do 1 budovy']}
            cta={{ label: 'Vyskúšať', to: '/registracia' }}
          />
          <PriceCard
            highlight
            tag="Štandard"
            price="0,90 €"
            unit="/ byt / mesiac"
            desc="Pre SVB a BD. Najčastejšia voľba."
            features={[
              'Plná funkcionalita',
              'XAdES podpis zápisníc',
              'SEPA QR + bank CSV import',
              'Pripomienky revízií',
              'Support do 24 h',
            ]}
            cta={{ label: 'Vybrať', to: '/registracia' }}
          />
          <PriceCard
            tag="Profesionál"
            price="Na mieru"
            unit=""
            desc="Pre správcovské firmy s 5+ budovami."
            features={['Dedikovaný server', 'SLA podľa zmluvy', 'Účtovné exporty (Pohoda, Money)', 'Prenos dát zdarma']}
            cta={{ label: 'Konzultácia', to: '/registracia' }}
          />
        </div>
        <p className="mk-small" style={{ textAlign: 'center', marginTop: 24 }}>
          Ceny bez DPH. Prvé 3 budovy pre správcovské firmy získavajú prenos dát zdarma.
        </p>
      </div>
    </section>
  );
}

function PriceCard({
  tag,
  price,
  unit,
  desc,
  features,
  cta,
  highlight,
}: {
  tag: string;
  price: string;
  unit: string;
  desc: string;
  features: string[];
  cta: { label: string; to: string };
  highlight?: boolean;
}) {
  return (
    <div className={`mk-price-card ${highlight ? 'mk-price-card-highlight' : ''}`}>
      {highlight && <div className="mk-price-ribbon">Najobľúbenejšie</div>}
      <div className="mk-price-tag">{tag}</div>
      <div className="mk-price">
        {price} <span className="mk-price-unit">{unit}</span>
      </div>
      <p className="mk-price-desc">{desc}</p>
      <ul className="mk-price-list">
        {features.map((f) => <li key={f}>{f}</li>)}
      </ul>
      <Link to={cta.to} className={`mk-btn ${highlight ? 'mk-btn-primary' : 'mk-btn-secondary'} mk-btn-block`}>
        {cta.label}
      </Link>
    </div>
  );
}

/* ============================ Testimonials ============================ */

function Testimonials() {
  const items = [
    {
      name: 'Jana Predsedová',
      role: 'Predseda SVB, Bratislava',
      body:
        'Pred DomovPlus som platila hodiny pri stole s papiermi. Teraz kliknem a mám zápisnicu podpísanú digitálne. Banku pri úvere to nezastavilo.',
    },
    {
      name: 'Peter Vlastník',
      role: 'Vlastník bytu, Košice',
      body:
        'Babka zo štvrtého poschodia si zaplatila faktúru sama cez QR. To je pre mňa najlepší dôkaz, že to je jednoduché.',
    },
    {
      name: 'Marek Správca',
      role: 'Správca 8 budov, Trnava',
      body:
        'Bankový import CSV súborov ušetrí môjmu tímu 3 dni mesačne. A keď vlastník zaplatí, príde mu automatické potvrdenie.',
    },
  ];
  return (
    <section className="mk-section" aria-labelledby="tst-h">
      <div className="mk-container">
        <h2 id="tst-h" className="mk-h2">Čo hovoria ľudia, ktorí to už používajú</h2>
        <p className="mk-sub">Časť citátov je z pilotnej fázy. Budete tu ďalší?</p>
        <div className="mk-tst-grid">
          {items.map((t) => (
            <figure key={t.name} className="mk-tst">
              <blockquote>„{t.body}"</blockquote>
              <figcaption>
                <strong>{t.name}</strong>
                <span>{t.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =================================== FAQ =================================== */

function FAQ() {
  const faqs = [
    {
      q: 'Je zápisnica z hlasovania akceptovaná bankou pri úvere na zateplenie?',
      a: 'Zápisnica je exportovaná ako PDF a podpísaná detachovaným XAdES-BES podpisom. Pre úvery zo ŠFRB a hypotekárne banky odporúčame použiť kvalifikovaný certifikát od NASES (SR) alebo PostSignum/Disig (CZ). Podpisovací kľúč nastavíte cez env, kód sa nemení.',
    },
    {
      q: 'Kto vidí moje dáta?',
      a: 'Iba vy. Dáta bežia na vašom serveri — neposielame ich do USA a nechodia cez tretie strany. Podľa GDPR čl. 20 si ich stiahnete v JSON, podľa čl. 17 vymažete.',
    },
    {
      q: 'Funguje to pre starších vlastníkov?',
      a: 'Áno — appka má Senior režim (20 px písmo, 56 px tlačidlá, vyšší kontrast, hlasové čítanie). Spĺňa WCAG 2.1 AA. Pre tých, čo nechcú appku, môže správca zadávať listinné hlasy za nich — systém to eviduje oddelene.',
    },
    {
      q: 'Čo ak stratím telefón s 2FA?',
      a: 'Pri zapnutí dvojfaktoru si vygenerujete 10 jednorazových záložných kódov. Stačí uložiť do papierového zoznamu alebo správcu hesiel.',
    },
    {
      q: 'Koľko stojí prenos dát zo súčasného systému?',
      a: 'Pre prvé 3 budovy zdarma, robíme to za vás. Potrebujeme iba export v Excel alebo CSV.',
    },
    {
      q: 'Ako si otestujem ešte pred pilotom?',
      a: 'Zaregistrujete sa na 30 dní zadarmo, bez kreditnej karty. Dostanete plnú funkcionalitu a môžete kedykoľvek skončiť.',
    },
  ];
  return (
    <section className="mk-section mk-section-cool" id="faq" aria-labelledby="faq-h">
      <div className="mk-container" style={{ maxWidth: 760 }}>
        <h2 id="faq-h" className="mk-h2">Časté otázky</h2>
        <div className="mk-faq">
          {faqs.map((f) => (
            <details key={f.q} className="mk-faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================ Final CTA ================================ */

function FinalCTA() {
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
      setErr('Odoslanie zlyhalo. Skúste znova alebo napíšte na hello@domovplus.sk.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mk-final" id="pilot" aria-labelledby="final-h">
      <div className="mk-container">
        <h2 id="final-h" className="mk-final-h">Začnite do 10 minút. Skončite, keď budete chcieť.</h2>
        <p className="mk-final-sub">14-denná záruka vrátenia peňazí · bez kreditnej karty · slovenský support.</p>
        {sent ? (
          <div className="mk-final-thanks">
            <div className="mk-thanks-icon" aria-hidden="true">✓</div>
            <h3>Ďakujeme!</h3>
            <p>Ozveme sa vám do 24 hodín na <strong>{email}</strong>.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mk-final-form">
            <input
              type="email"
              required
              placeholder="predseda@vasa-svb.sk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email"
            />
            <input
              placeholder="Mesto"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              aria-label="Mesto"
            />
            <input
              type="number"
              min={1}
              placeholder="Počet bytov"
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              aria-label="Počet bytov"
            />
            <button type="submit" className="mk-btn mk-btn-primary" disabled={busy}>
              {busy ? 'Odosielam…' : 'Začať zadarmo →'}
            </button>
          </form>
        )}
        {err && <p className="mk-err" style={{ textAlign: 'center' }}>{err}</p>}
        <p className="mk-final-alt">
          Alebo <Link to="/registracia">vytvorte účet priamo</Link> a začnite hneď.
        </p>
      </div>
    </section>
  );
}

/* ================================== Footer ================================== */

function Footer() {
  return (
    <footer className="mk-footer">
      <div className="mk-container mk-footer-inner">
        <div>
          <strong>DomovPlus</strong>
          <p className="mk-small">Operačný systém pre bytový dom · SR / ČR</p>
        </div>
        <nav className="mk-footer-nav" aria-label="Päta">
          <a href="#funkcie">Funkcie</a>
          <a href="#how">Ako to funguje</a>
          <a href="#cennik">Cenník</a>
          <a href="#faq">FAQ</a>
          <Link to="/prihlasenie">Prihlásenie</Link>
          <a href="mailto:hello@domovplus.sk">Kontakt</a>
        </nav>
        <div className="mk-small">© 2026 DomovPlus · VOP · GDPR</div>
      </div>
    </footer>
  );
}
