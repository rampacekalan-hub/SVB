/**
 * MarketingMenu — navigácia pre marketing stránku, montovaná do Topbar-u.
 *
 * - Desktop (≥ 880px): inline anchor linky priamo v topbar-e (à la Vercel/Linear)
 * - Mobile (< 880px): hamburger button vľavo → side drawer s rovnakými linkmi
 *
 * Scrollspy: aktívna sekcia (vidíš ju vo viewport-e) má teal podčiarknutie/highlight.
 * Smooth scroll s offsetom kvôli sticky topbar-u.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface NavItem {
  id: string;
  label: string;
}

const ITEMS: NavItem[] = [
  { id: 'funkcie', label: 'Funkcie' },
  { id: 'porovnanie', label: 'Pred / Po' },
  { id: 'how', label: 'Ako funguje' },
  { id: 'cennik', label: 'Cenník' },
  { id: 'faq', label: 'FAQ' },
  { id: 'demo-call', label: 'Kontakt' },
];

export function MarketingMenu() {
  const [active, setActive] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Scrollspy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-15% 0px -65% 0px', threshold: [0, 0.2, 0.5] },
    );
    ITEMS.forEach((it) => {
      const el = document.getElementById(it.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  // Zatvor drawer pri klike na link / pri zmene routy
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Body scroll lock pri otvorenom draweri
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  function go(id: string, e: React.MouseEvent) {
    e.preventDefault();
    setDrawerOpen(false);
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  return (
    <>
      {/* Desktop inline menu — skryté na mobile */}
      <nav className="mk-menu mk-menu-desktop" aria-label="Sekcie stránky">
        {ITEMS.map((it) => (
          <a
            key={it.id}
            href={`#${it.id}`}
            onClick={(e) => go(it.id, e)}
            className={active === it.id ? 'mk-menu-link mk-menu-link-active' : 'mk-menu-link'}
          >
            {it.label}
          </a>
        ))}
      </nav>

      {/* Mobile hamburger — viditeľné na mobile */}
      <button
        type="button"
        className="mk-menu-toggle"
        onClick={() => setDrawerOpen(true)}
        aria-label="Otvoriť menu"
        aria-expanded={drawerOpen}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="mk-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <aside
            className="mk-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Hlavné menu"
          >
            <div className="mk-drawer-head">
              <strong>Menu</strong>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Zavrieť menu"
                className="mk-drawer-close"
              >
                ✕
              </button>
            </div>
            <ul className="mk-drawer-list">
              {ITEMS.map((it) => (
                <li key={it.id}>
                  <a
                    href={`#${it.id}`}
                    onClick={(e) => go(it.id, e)}
                    className={active === it.id ? 'mk-drawer-link mk-drawer-link-active' : 'mk-drawer-link'}
                  >
                    {it.label}
                    <span className="mk-drawer-arrow" aria-hidden="true">→</span>
                  </a>
                </li>
              ))}
            </ul>
            <div className="mk-drawer-cta">
              <Link to="/prihlasenie" className="mk-btn mk-btn-secondary mk-btn-block" onClick={() => setDrawerOpen(false)}>
                Prihlásenie
              </Link>
              <Link to="/registracia" className="mk-btn mk-btn-primary mk-btn-block" onClick={() => setDrawerOpen(false)}>
                Registrovať
              </Link>
            </div>
            <div className="mk-drawer-foot">
              <a href="mailto:hello@domovplus.sk">hello@domovplus.sk</a>
              <a href="tel:+421911000000">+421 911 000 000</a>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
