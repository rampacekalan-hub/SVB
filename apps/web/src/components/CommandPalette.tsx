/**
 * CommandPalette — ⌘K / Ctrl+K globálne hľadanie a navigácia.
 *
 * Podobne ako Linear/Notion/Stripe dashboard. Kombinuje:
 *   - Navigačné príkazy (preskoč na sekciu)
 *   - Data search (vlastníci, byty, hlasovania, tikety)
 *   - Akcie (vytvoriť hlasovanie, oznam, schôdzu)
 *
 * Fuzzy match cez jednoduchý score (každé slovo musí byť niekde v label-e).
 * Nezávislé od react-router — prijíma buildingId z context-u, navigáciu cez push.
 */
import { KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { Me } from '../types';

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
  group: 'Navigácia' | 'Akcia' | 'Budovy' | 'Byty' | 'Vlastníci' | 'Hlasovania' | 'Poruchy' | 'Nedávne';
  shortcut?: string;
  run: () => void;
}

interface BuildingData {
  buildingId: string;
  buildingName: string;
  apartments: any[];
  votings: any[];
  tickets: any[];
}

export function CommandPalette({ me, buildingId }: { me: Me; buildingId?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const [buildingsData, setBuildingsData] = useState<BuildingData[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Zoznam unikátnych admin-budov používateľa — pre portfolio mode na /admin.
  const adminBuildings = useMemo(
    () =>
      Array.from(
        new Map(
          me.memberships
            .filter((m) => ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role))
            .map((m) => [m.building.id, m.building]),
        ).values(),
      ),
    [me],
  );

  // Globálny ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
      setQ('');
      setCursor(0);
    }
  }, [open]);

  // Pri otvorení načítame dáta.
  //   - Ak sme v budove (/b/:id), iba tej jednej
  //   - Ak sme na portfolio (/admin) alebo inej trase, tak všetkých admin-budov súčasne
  useEffect(() => {
    if (!open) return;
    const scope = buildingId
      ? adminBuildings.filter((b) => b.id === buildingId)
      : adminBuildings;
    if (scope.length === 0) {
      setBuildingsData([]);
      return;
    }
    Promise.all(
      scope.map(async (b): Promise<BuildingData> => {
        const [apartments, votings, tickets] = await Promise.all([
          api<any[]>(`/apartments/by-building/${b.id}`).catch(() => []),
          api<any[]>(`/voting/building/${b.id}`).catch(() => []),
          api<any[]>(`/tickets/building/${b.id}`).catch(() => []),
        ]);
        return { buildingId: b.id, buildingName: b.name, apartments, votings, tickets };
      }),
    ).then(setBuildingsData);
  }, [open, buildingId, adminBuildings]);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];

    // --- Akcie (Chairman)
    if (buildingId) {
      list.push(
        { id: 'new-vote', label: 'Vytvoriť hlasovanie', hint: 'Nové hlasovanie s termínom', group: 'Akcia', icon: '🗳️', shortcut: 'G V', run: () => navigate(`/b/${buildingId}/hlasovania/nove`) },
        { id: 'new-ann', label: 'Pridať oznam', hint: 'Digitálna nástenka', group: 'Akcia', icon: '📢', shortcut: 'G O', run: () => navigate(`/b/${buildingId}/oznamy/nova`) },
        { id: 'new-meeting', label: 'Naplánovať schôdzu', hint: 'Termín + program', group: 'Akcia', icon: '📅', shortcut: 'G S', run: () => navigate(`/b/${buildingId}/schodze/nova`) },
        { id: 'new-revision', label: 'Pridať revíziu', hint: 'Kotol, výťah, bleskozvod…', group: 'Akcia', icon: '🛠️', run: () => navigate(`/b/${buildingId}/revizie/nova`) },
      );
    }

    // --- Navigácia
    const navBase = buildingId ? `/b/${buildingId}` : '/moj-dom';
    list.push(
      { id: 'nav-dashboard', label: 'Prehľad', group: 'Navigácia', icon: '🏠', shortcut: 'G D', run: () => navigate(buildingId ? `/b/${buildingId}` : '/moj-dom/domov') },
      { id: 'nav-votings', label: 'Hlasovania', group: 'Navigácia', icon: '🗳️', run: () => navigate(`${navBase}/hlasovania`) },
      { id: 'nav-tickets', label: 'Poruchy', group: 'Navigácia', icon: '🔧', run: () => navigate(`${navBase}/poruchy`) },
      { id: 'nav-meetings', label: 'Schôdze', group: 'Navigácia', icon: '📅', run: () => navigate(`${navBase}/schodze`) },
      { id: 'nav-announcements', label: 'Oznamy', group: 'Navigácia', icon: '📢', run: () => navigate(`${navBase}/oznamy`) },
    );
    if (buildingId) {
      list.push(
        { id: 'nav-payments', label: 'Platby vlastníkov', group: 'Navigácia', icon: '💸', run: () => navigate(`/b/${buildingId}/platby`) },
        { id: 'nav-revisions', label: 'Revízie', group: 'Navigácia', icon: '🛠️', run: () => navigate(`/b/${buildingId}/revizie`) },
        { id: 'nav-apartments', label: 'Evidencia bytov', group: 'Navigácia', icon: '🏢', run: () => navigate(`/b/${buildingId}/byty`) },
        { id: 'nav-settings', label: 'Nastavenia budovy', group: 'Navigácia', icon: '⚙️', run: () => navigate(`/b/${buildingId}/nastavenia`) },
      );
    }
    list.push(
      { id: 'nav-account', label: 'Môj účet', group: 'Navigácia', icon: '👤', run: () => navigate('/nastavenia') },
    );

    // --- Portfolio mode: ak user je na /admin (bez buildingId), pridaj skratky
    //     na jednotlivé budovy ako „Prejsť do <názov>".
    if (!buildingId && adminBuildings.length > 1) {
      for (const b of adminBuildings) {
        list.push({
          id: `bldg-${b.id}`,
          label: `Otvoriť ${b.name}`,
          hint: b.city,
          group: 'Budovy',
          icon: '🏢',
          run: () => navigate(`/b/${b.id}`),
        });
      }
    }

    // --- Search results z dát (môže byť jedna budova alebo všetky)
    // Každý item je tagnutý názvom budovy v hint-e, aby manager vedel, kam patrí.
    const multi = buildingsData.length > 1;
    for (const bd of buildingsData) {
      const bTag = multi ? ` · ${bd.buildingName}` : '';
      for (const apt of bd.apartments) {
        const owner = apt.registeredOwners[0]?.user;
        list.push({
          id: `apt-${bd.buildingId}-${apt.id}`,
          label: `Byt ${apt.unitNumber}${bTag}`,
          hint: owner
            ? `${owner.firstName} ${owner.lastName} · ${owner.email}`
            : apt.pendingActivation
              ? `Čaká na registráciu · kód ${apt.pendingActivation.code}`
              : 'bez vlastníka',
          group: 'Byty',
          icon: '🏢',
          run: () => navigate(`/b/${bd.buildingId}/byty`),
        });
        if (owner) {
          list.push({
            id: `owner-${bd.buildingId}-${owner.id}`,
            label: `${owner.firstName} ${owner.lastName}`,
            hint: `${owner.email} · byt ${apt.unitNumber}${bTag}`,
            group: 'Vlastníci',
            icon: '👤',
            run: () => navigate(`/b/${bd.buildingId}/byty`),
          });
        }
      }
      for (const v of bd.votings) {
        list.push({
          id: `vote-${bd.buildingId}-${v.id}`,
          label: `${v.title}${bTag}`,
          hint:
            v.status === 'OPEN'
              ? `Prebieha · uzávierka ${new Date(v.closesAt).toLocaleDateString('sk-SK')}`
              : v.status,
          group: 'Hlasovania',
          icon: '🗳️',
          run: () => navigate(`/b/${bd.buildingId}/hlasovania/${v.id}`),
        });
      }
      for (const t of bd.tickets) {
        list.push({
          id: `ticket-${bd.buildingId}-${t.id}`,
          label: `${t.title}${bTag}`,
          hint: `${t.priority} · ${t.status}${t.apartment ? ` · byt ${t.apartment.unitNumber}` : ''}`,
          group: 'Poruchy',
          icon: '🔧',
          run: () => navigate(`/b/${bd.buildingId}/poruchy/${t.id}`),
        });
      }
    }

    return list;
  }, [buildingId, buildingsData, adminBuildings, navigate]);

  const filtered = useMemo(() => {
    if (!q.trim()) return commands.slice(0, 20);
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return commands
      .map((c) => {
        const hay = `${c.label} ${c.hint ?? ''} ${c.group}`.toLowerCase();
        let score = 0;
        for (const t of terms) {
          const idx = hay.indexOf(t);
          if (idx === -1) return { c, score: -1 };
          score += (idx === 0 ? 3 : idx < 5 ? 2 : 1);
        }
        return { c, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((x) => x.c);
  }, [commands, q]);

  const grouped = useMemo(() => {
    const g: Record<string, Command[]> = {};
    for (const c of filtered) {
      (g[c.group] = g[c.group] ?? []).push(c);
    }
    return g;
  }, [filtered]);

  useEffect(() => { setCursor(0); }, [q, filtered.length]);

  if (!open) return <CmdKButton onClick={() => setOpen(true)} />;

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[cursor];
      if (cmd) {
        setOpen(false);
        cmd.run();
      }
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Príkazy"
      onClick={() => setOpen(false)}
      className="cmdk-overlay"
    >
      <div onClick={(e) => e.stopPropagation()} className="cmdk">
        <div className="cmdk-input-wrap">
          <svg className="cmdk-search" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Čo chcete spraviť? Napíšte hlasovanie, byt, meno…"
            className="cmdk-input"
            aria-label="Hľadať"
          />
          <kbd className="cmdk-kbd">esc</kbd>
        </div>
        <div className="cmdk-list">
          {filtered.length === 0 && (
            <div className="cmdk-empty">Nič nenájdené pre „{q}".</div>
          )}
          {Object.entries(grouped).map(([group, cmds]) => (
            <div key={group} className="cmdk-group">
              <div className="cmdk-group-label">{group}</div>
              {cmds.map((c) => {
                const idx = filtered.indexOf(c);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`cmdk-item ${idx === cursor ? 'cmdk-active' : ''}`}
                    onMouseEnter={() => setCursor(idx)}
                    onClick={() => {
                      setOpen(false);
                      c.run();
                    }}
                  >
                    <span className="cmdk-icon">{c.icon}</span>
                    <span className="cmdk-main">
                      <span className="cmdk-label">{c.label}</span>
                      {c.hint && <span className="cmdk-hint">{c.hint}</span>}
                    </span>
                    {c.shortcut && <kbd className="cmdk-kbd cmdk-kbd-sm">{c.shortcut}</kbd>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cmdk-foot">
          <span><kbd className="cmdk-kbd-sm">↑↓</kbd> výber</span>
          <span><kbd className="cmdk-kbd-sm">↵</kbd> potvrdiť</span>
          <span><kbd className="cmdk-kbd-sm">esc</kbd> zavrieť</span>
          <span className="spacer" />
          <span>DomovPlus</span>
        </div>
      </div>
    </div>
  );
}

function CmdKButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="cmdk-trigger" aria-label="Otvoriť príkazy">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
      </svg>
      <span>Hľadať</span>
      <kbd className="cmdk-kbd cmdk-kbd-sm">⌘K</kbd>
    </button>
  );
}
