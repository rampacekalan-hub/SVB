/**
 * BuildingSwitcher — dropdown v topbare pre užívateľa s viacerými budovami.
 * Vidno iba ak správca/admin má 2+ budov pod správou.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Me } from '../types';

export function BuildingSwitcher({ me }: { me: Me }) {
  const { buildingId } = useParams<{ buildingId?: string }>();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Unique buildings where user has admin role
  const buildings = Array.from(
    new Map(
      me.memberships
        .filter((m) => ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role))
        .map((m) => [m.building.id, m.building]),
    ).values(),
  );

  // Má zároveň OWNER rolu niekde? Potom ukážeme „🏠 Moja domácnosť"
  const ownerMembership = me.memberships.find((m) => m.role === 'OWNER' && m.apartment);

  // Ak je user čisto OWNER (bez admin role) — nepotrebuje switcher
  // Ak má 1 admin budovu ALE aj OWNER účet, switcher dáva zmysel (dual-role user)
  if (buildings.length < 2 && !ownerMembership) return null;
  if (buildings.length < 1 && !ownerMembership) return null;

  const onResident = location.pathname.startsWith('/moj-dom');
  const active = onResident
    ? { id: 'resident', name: 'Moja domácnosť', city: ownerMembership?.apartment ? `byt ${ownerMembership.apartment.unitNumber}` : '' }
    : (buildings.find((b) => b.id === buildingId) ?? buildings[0]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="ui-btn ui-btn-ghost"
        onClick={() => setOpen((o) => !o)}
        style={{ minHeight: 36, padding: '0 0.75rem', fontSize: 13, gap: 6 }}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span aria-hidden="true">🏢</span>
        <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {active.name}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="bs-menu" role="menu">
          <div className="bs-head">Vaše budovy</div>
          {buildings.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`bs-item ${b.id === buildingId ? 'active' : ''}`}
              onClick={() => {
                setOpen(false);
                navigate(`/b/${b.id}`);
              }}
            >
              <span className="bs-dot" aria-hidden="true" />
              <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                <div style={{ color: 'var(--fg-subtle)', fontSize: 12 }}>{b.city}</div>
              </div>
              {b.id === buildingId && <span aria-hidden="true">✓</span>}
            </button>
          ))}
          <div className="bs-foot">
            {ownerMembership && (
              <Link
                to="/moj-dom/domov"
                onClick={() => setOpen(false)}
                className={`bs-link ${onResident ? 'active-hint' : ''}`}
              >
                🏠 Moja domácnosť {onResident && '✓'}
              </Link>
            )}
            {buildings.length >= 2 && (
              <Link to="/admin" onClick={() => setOpen(false)} className="bs-link">
                📊 Portfolio prehľad
              </Link>
            )}
            <Link to="/onboarding" onClick={() => setOpen(false)} className="bs-link">
              + Pridať novú budovu
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
