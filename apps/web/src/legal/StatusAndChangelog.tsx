/**
 * StatusPage — dostupnosť komponentov (api, web, db, storage, mail, push).
 * ChangelogPage — verejný zoznam zmien verzie.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

interface HealthStatus {
  api: 'ok' | 'degraded' | 'down';
  db: 'ok' | 'degraded' | 'down';
  storage: 'ok' | 'degraded' | 'down';
  mail: 'ok' | 'degraded' | 'down';
  push: 'ok' | 'degraded' | 'down';
  uptime: number;
  version: string;
  checkedAt: string;
}

export function StatusPage() {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const res = await api<HealthStatus>('/health/full');
        setStatus(res);
      } catch {
        setErr('Nepodarilo sa načítať stav. API je pravdepodobne nedostupné.');
      }
    }
    check();
    const timer = setInterval(check, 30000); // refresh every 30s
    return () => clearInterval(timer);
  }, []);

  const components = [
    { key: 'api', label: 'API backend', desc: 'Hlavné REST rozhranie' },
    { key: 'db', label: 'Databáza', desc: 'PostgreSQL — primárne úložisko dát' },
    { key: 'storage', label: 'Úložisko súborov', desc: 'S3 / MinIO — dokumenty, fotky, PDF' },
    { key: 'mail', label: 'Email', desc: 'Transakčné emaily (SMTP)' },
    { key: 'push', label: 'Push notifikácie', desc: 'Web Push (VAPID)' },
  ] as const;

  return (
    <div className="legal-page">
      <div className="legal-container">
        <nav className="legal-breadcrumb">
          <Link to="/">Domov</Link> › <span>Stav služieb</span>
        </nav>
        <h1 className="legal-h1">Stav služieb</h1>

        {err && <div className="status-banner status-banner-err">{err}</div>}

        {!err && !status && <p className="legal-lede">Overujem stav…</p>}

        {status && (
          <>
            <div className={`status-banner status-banner-${overall(status)}`}>
              {overall(status) === 'ok'
                ? '✓ Všetky systémy fungujú bez problémov'
                : overall(status) === 'degraded'
                  ? '⚠ Čiastočne obmedzená funkčnosť — pozrite detaily nižšie'
                  : '✕ Prebieha výpadok niektorých služieb'}
              <div className="status-meta">
                Aktualizované: {new Date(status.checkedAt).toLocaleTimeString('sk-SK')}
                {' · '}Verzia: {status.version}
                {' · '}Uptime: {formatUptime(status.uptime)}
              </div>
            </div>

            <div className="status-list">
              {components.map((c) => {
                const s = status[c.key];
                return (
                  <div key={c.key} className={`status-row status-row-${s}`}>
                    <div>
                      <div className="status-label">{c.label}</div>
                      <div className="status-desc">{c.desc}</div>
                    </div>
                    <div className={`status-pill status-pill-${s}`}>
                      {s === 'ok' ? '● Funguje' : s === 'degraded' ? '● Obmedzené' : '● Výpadok'}
                    </div>
                  </div>
                );
              })}
            </div>

            <h2 className="legal-h2">Záväzok dostupnosti</h2>
            <p>
              Cieľ dostupnosti (SLA): <strong>99 % mesačne</strong> pre core služby (API + DB).
              Plánovaná údržba sa oznamuje minimálne <strong>48 hodín vopred</strong> emailom všetkým
              aktívnym účtom. Incidenty sa publikujú na tejto stránke a v changelog-u.
            </p>

            <h2 className="legal-h2">História incidentov</h2>
            <p className="legal-meta">
              Zatiaľ žiadne zaznamenané incidenty. História sa začína viesť od všeobecnej dostupnosti
              služby (po ukončení pilotu).
            </p>
          </>
        )}

        <footer className="legal-footer">
          <p>
            Problém ktorý nevidíte na tejto stránke? Píšte na{' '}
            <a href="mailto:support@domovplus.sk">support@domovplus.sk</a>.
          </p>
          <Link to="/" className="mk-btn mk-btn-secondary">← Späť na hlavnú stránku</Link>
        </footer>
      </div>
    </div>
  );
}

function overall(s: HealthStatus): 'ok' | 'degraded' | 'down' {
  const vals = [s.api, s.db, s.storage, s.mail, s.push];
  if (vals.includes('down')) return 'down';
  if (vals.includes('degraded')) return 'degraded';
  return 'ok';
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d} d ${h} h`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h} h ${m} min`;
}

/* =========================================================
   CHANGELOG
========================================================= */

interface ChangeEntry {
  version: string;
  date: string;
  tag: 'feature' | 'fix' | 'security' | 'infra';
  title: string;
  body: string[];
}

const CHANGELOG: ChangeEntry[] = [
  {
    version: '0.1.0',
    date: '24. apríl 2026',
    tag: 'feature',
    title: 'Pilot verzia',
    body: [
      'Kompletná funkcionalita pre predsedov SVB a vlastníkov bytov',
      'Hlasovanie s XAdES-BES podpísanou zápisnicou v PDF',
      'SEPA QR kódy na faktúrach, bank CSV import',
      'Poruchové tikety s push notifikáciami a foto prílohami',
      'Hash-chain audit log (SHA-256) — každá zmena má nesprevirateľný otlačok',
      'Archív dokumentov (6 kategórií) s SHA-256 integritou',
      'Onboarding wizard pre rýchly štart do 30 minút',
    ],
  },
  {
    version: '0.0.9',
    date: '22. apríl 2026',
    tag: 'security',
    title: 'Deterministické hashovanie audit logu',
    body: [
      'Canonical JSON serialization (triedené kľúče) pre reprodukovateľný SHA-256',
      'Oprava verify endpointu — chain integrity teraz správne validuje',
      'Reset demo seed s čistým hash-chain od genesis',
    ],
  },
  {
    version: '0.0.8',
    date: '20. apríl 2026',
    tag: 'feature',
    title: 'Plán revízií + pripomienky',
    body: [
      'Evidencia revízií: kotol, výťah, bleskozvod, elektroinštalácia, komín',
      'Automatická pripomienka 30 dní pred expiráciou (cron)',
      'História vykonaných revízií s technikom a nálezom',
    ],
  },
  {
    version: '0.0.7',
    date: '18. apríl 2026',
    tag: 'feature',
    title: 'Burza susedov',
    body: [
      'Komunitná výmena medzi vlastníkmi: predám / hľadám / zadarmo / straty a nálezy / balík suseda',
      'Voliteľný kontakt (telefón, byt), pole na cenu',
    ],
  },
  {
    version: '0.0.6',
    date: '15. apríl 2026',
    tag: 'feature',
    title: 'Energy module',
    body: [
      'Mesačné odpočty spotreby (voda, teplo, elektrina spoločných priestorov)',
      'Grafy spotreby v čase',
    ],
  },
  {
    version: '0.0.5',
    date: '12. apríl 2026',
    tag: 'infra',
    title: 'Web push notifikácie',
    body: [
      'VAPID-based Web Push API',
      'Vlastník dostane push pri: novej faktúre, otvorenom hlasovaní, pozvánke na schôdzu',
    ],
  },
  {
    version: '0.0.4',
    date: '10. apríl 2026',
    tag: 'security',
    title: '2FA / TOTP',
    body: [
      'Dvojfaktorové overenie pre admin role (predseda, správca)',
      'Kompatibilné s Google Authenticator, Microsoft Authenticator, 1Password, Authy',
      'Záchranné kódy (10 ks, každý na jedno použitie)',
    ],
  },
];

export function ChangelogPage() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <nav className="legal-breadcrumb">
          <Link to="/">Domov</Link> › <span>Changelog</span>
        </nav>
        <h1 className="legal-h1">Čo je nové</h1>
        <p className="legal-lede">
          História zmien v DomovPlus. Sledujte, čo pribúda, čo sa zlepšuje a čo sa opravilo.
        </p>

        <div className="changelog-list">
          {CHANGELOG.map((c) => (
            <article key={c.version} className="changelog-item">
              <header className="changelog-head">
                <span className="changelog-version">v{c.version}</span>
                <span className={`changelog-tag changelog-tag-${c.tag}`}>{labelFor(c.tag)}</span>
                <span className="changelog-date">{c.date}</span>
              </header>
              <h2 className="changelog-title">{c.title}</h2>
              <ul className="changelog-body">
                {c.body.map((b, i) => (<li key={i}>{b}</li>))}
              </ul>
            </article>
          ))}
        </div>

        <footer className="legal-footer">
          <p>
            Máte feature request alebo chybu? Napíšte na{' '}
            <a href="mailto:hello@domovplus.sk">hello@domovplus.sk</a>.
          </p>
          <Link to="/" className="mk-btn mk-btn-secondary">← Späť na hlavnú stránku</Link>
        </footer>
      </div>
    </div>
  );
}

function labelFor(tag: ChangeEntry['tag']): string {
  return { feature: 'Nová funkcia', fix: 'Oprava', security: 'Bezpečnosť', infra: 'Infraštruktúra' }[tag];
}
