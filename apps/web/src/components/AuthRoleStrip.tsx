/**
 * AuthRoleStrip — horizontálny prepínač v hlavičke auth stránok.
 * Ukazuje tri cesty: Vlastník (kód) / Predseda (nový účet) / Prihlásenie (mám účet).
 * Aktívna cesta je podľa aktuálnej URL podsvietená. Šetrí vertikálny priestor
 * oproti predošlému 3-kartovému bloku pod formulárom.
 */
import { Link, useLocation } from 'react-router-dom';

interface Item { to: string; icon: string; short: string; long: string; matchPrefix: string; }

const ITEMS: Item[] = [
  { to: '/aktivacia',   icon: '🏠', short: 'Mám kód',        long: 'Vlastník',   matchPrefix: '/aktivacia' },
  { to: '/registracia', icon: '👤', short: 'Nová budova',   long: 'Predseda',   matchPrefix: '/registracia' },
  { to: '/prihlasenie', icon: '🔑', short: 'Mám účet',      long: 'Prihlásenie', matchPrefix: '/prihlasenie' },
];

export function AuthRoleStrip() {
  const { pathname } = useLocation();
  return (
    <nav className="auth-role-strip" aria-label="Vstupné cesty">
      {ITEMS.map((it) => {
        const active = pathname.startsWith(it.matchPrefix);
        return (
          <Link
            key={it.to}
            to={it.to}
            className={`auth-role-btn ${active ? 'active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="auth-role-icon" aria-hidden="true">{it.icon}</span>
            <strong>{it.long}</strong>
            <span>{it.short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
