/**
 * MarketingNav — sticky in-page navigation pre marketing stránku.
 *
 * - Pod hlavným topbar-om
 * - Anchor linky na sekcie: Funkcie · Porovnanie · Cenník · FAQ · Kontakt
 * - Scrollspy: aktívna sekcia sa zvýrazní
 * - Smooth scroll na klik
 * - Skrýva sa pri scroll dole, zobrazí pri scroll hore (volitelne)
 */
import { useEffect, useState } from 'react';

interface NavSection {
  id: string;
  label: string;
  shortLabel?: string;
}

const SECTIONS: NavSection[] = [
  { id: 'funkcie', label: 'Funkcie' },
  { id: 'porovnanie', label: 'Porovnanie', shortLabel: 'Pred/Po' },
  { id: 'how', label: 'Ako funguje', shortLabel: 'Ako to ide' },
  { id: 'cennik', label: 'Cenník' },
  { id: 'faq', label: 'FAQ' },
  { id: 'demo-call', label: 'Kontakt' },
];

export function MarketingNav() {
  const [active, setActive] = useState<string>('');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Scrollspy cez IntersectionObserver — zachytí aktuálnu sekciu vo viewport-e
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      {
        rootMargin: '-20% 0px -60% 0px', // sekcia sa stane "active" keď je v hornej tretine
        threshold: [0, 0.1, 0.25, 0.5],
      },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    // Sticky shadow keď user scroll-ne pod hero
    const onScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  function go(id: string, e: React.MouseEvent) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  return (
    <nav className={`mk-nav ${scrolled ? 'mk-nav-scrolled' : ''}`} aria-label="Sekcie stránky">
      <div className="mk-nav-inner">
        <ul className="mk-nav-list">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => go(s.id, e)}
                className={active === s.id ? 'mk-nav-link mk-nav-link-active' : 'mk-nav-link'}
              >
                <span className="mk-nav-label-full">{s.label}</span>
                {s.shortLabel && <span className="mk-nav-label-short">{s.shortLabel}</span>}
              </a>
            </li>
          ))}
        </ul>
        <a href="#hero" onClick={(e) => go('hero', e)} className="mk-nav-top" aria-label="Späť hore">↑</a>
      </div>
    </nav>
  );
}
