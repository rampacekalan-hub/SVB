/**
 * RoleGateway — jednotný výber vstupnej cesty (Vlastník / Predseda / Správca).
 *
 * Používa sa na 3 miestach:
 *   - Marketing page ako hlavná sekcia (variant="full")
 *   - Pod formulárom /prihlasenie (variant="compact")
 *   - Pod formulárom /registracia a /aktivacia (variant="compact")
 *
 * Cieľ: user, ktorý omylom skončil na zlom vstupe, má vždy viditeľnú cestu
 * kam patrí, bez "ako sa mám vlastne prihlásiť?".
 */
import { Link } from 'react-router-dom';

interface Role {
  title: string;
  short: string;
  body: string;
  bullets: string[];
  cta: string;
  to: string;
  icon: string;
  highlight?: boolean;
}

const ROLES: Role[] = [
  {
    title: 'Vlastník bytu',
    short: 'Mám kód',
    body: 'Hlasuje z mobilu, dostáva faktúry s QR platbou, píše o poruchách, vidí program schôdze. Jedno miesto namiesto troch chatov.',
    bullets: ['Hlasovať v mobile', 'QR platba z banky', 'Nahlásiť poruchu s fotkou'],
    cta: 'Aktivovať účet kódom →',
    to: '/aktivacia',
    icon: '🏠',
  },
  {
    title: 'Predseda SVB / BD',
    short: 'Nová budova',
    body: 'Sprievodca pre rozbeh za 30 minút. Vystavíte dávku faktúr jedným klikom, zápisnicu s XAdES podpisom banka akceptuje.',
    bullets: ['Excel import bytov', 'Mesačná dávka faktúr', 'PDF zápisnica podpísaná'],
    cta: 'Vytvoriť účet správcu →',
    to: '/registracia',
    icon: '👤',
    highlight: true,
  },
  {
    title: 'Správcovská firma',
    short: 'Viac budov',
    body: 'Portfolio pohľad cez všetky budovy. Ktorá má nedoplatky, neriešený tiket, revíziu do 30 dní — všetko v jednej tabuľke.',
    bullets: ['Portfolio dashboard', 'Bank CSV import', 'Účtovné exporty'],
    cta: 'Konzultácia s nami →',
    to: '/#pilot',
    icon: '🏢',
  },
];

export function RoleGateway({ variant = 'full', title, subtitle }: {
  variant?: 'full' | 'compact';
  title?: string;
  subtitle?: string;
}) {
  if (variant === 'compact') {
    return (
      <div className="rg-compact" role="navigation" aria-label="Vstupné cesty">
        <div className="rg-compact-head">
          {title ?? 'Ste v správnej sekcii?'}
        </div>
        <div className="rg-compact-grid">
          {ROLES.map((r) => (
            <Link key={r.title} to={r.to} className="rg-compact-card">
              <span className="rg-compact-icon" aria-hidden="true">{r.icon}</span>
              <span className="rg-compact-text">
                <strong>{r.short}</strong>
                <span>{r.title}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="rg-full mk-section" id="role" aria-labelledby="role-h">
      <div className="mk-container">
        <h2 id="role-h" className="mk-h2">{title ?? 'Pre každú rolu v bytovom dome'}</h2>
        <p className="mk-sub">
          {subtitle ?? 'Jedno prihlásenie, tri rozdielne pohľady — podľa toho, či ste vlastník, predseda alebo správca.'}
        </p>
        <div className="rg-grid">
          {ROLES.map((r) => (
            <div key={r.title} className={`rg-card ${r.highlight ? 'rg-highlight' : ''}`}>
              <div className="rg-icon" aria-hidden="true">{r.icon}</div>
              <h3>{r.title}</h3>
              <p className="rg-body">{r.body}</p>
              <ul className="rg-bullets">
                {r.bullets.map((b) => <li key={b}>{b}</li>)}
              </ul>
              {r.to.startsWith('/#') ? (
                <a href={r.to} className="rg-cta">{r.cta}</a>
              ) : (
                <Link to={r.to} className="rg-cta">{r.cta}</Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
