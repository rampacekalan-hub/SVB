/**
 * ResidentShell — /moj-dom/*
 *
 * Minimalistický dashboard pre vlastníka bytu.
 * Ukazuje iba to, čo si vyžaduje jeho pozornosť (hlasovania, zostatok,
 * neprečítané oznamy, najbližšia schôdza). Prázdny dashboard = "Všetko v poriadku".
 *
 * Navigácia cez bottom tabbar (mobile-first). Žiadne admin akcie tu nikdy nebudú.
 */
import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { AttentionCard, EmptyState, Greeting, ListItem, Section, StatusPill } from '../components/ui';
import { Icon, IconName } from '../components/Icons';
import {
  ClassifiedsResidentPage,
  InvoiceDetailPage,
  MeetingsResidentPage,
  ReportIssuePage,
  VoteScreen,
} from './ResidentPages';
import type { Me } from '../types';

export function ResidentShell({ me }: { me: Me }) {
  // Vlastník spravidla patrí do jednej budovy. Ak do viac, default = prvá s apartmentId.
  const ownerMembership =
    me.memberships.find((m) => m.role === 'OWNER' && m.apartment) ?? me.memberships[0];

  if (!ownerMembership) {
    return (
      <main className="shell-main">
        <EmptyState
          icon="🏠"
          title="Zatiaľ nie ste priradený k žiadnemu bytu"
          body="Požiadajte správcu vášho bytového domu o aktivačný kód z vyúčtovania alebo SMS."
        />
      </main>
    );
  }

  return (
    <div className="shell resident-shell">
      <ResidentSidebar buildingName={ownerMembership.building.name} unitNumber={ownerMembership.apartment?.unitNumber} />
      <main className="shell-main" id="main" tabIndex={-1}>
        <Routes>
          <Route index element={<Navigate to="domov" replace />} />
          <Route path="domov" element={<ResidentHome me={me} membership={ownerMembership} />} />
          <Route path="hlasovania/:vid" element={<VoteScreen me={me} />} />
          <Route path="faktury" element={<InvoicesPage membership={ownerMembership} />} />
          <Route path="faktury/:iid" element={<InvoiceDetailPage />} />
          <Route path="oznamy" element={<AnnouncementsPage />} />
          <Route path="poruchy/nova" element={<ReportIssuePage me={me} />} />
          <Route path="schodze" element={<MeetingsResidentPage me={me} />} />
          <Route path="burza" element={<ClassifiedsResidentPage me={me} />} />
          <Route path="viac" element={<MorePage />} />
          <Route path="*" element={<Navigate to="domov" replace />} />
        </Routes>
      </main>
      <ResidentTabbar />
    </div>
  );
}

/* --------------------------- Desktop sidebar --------------------------- */

function ResItem({ to, icon, label }: { to: string; icon: IconName; label: string }) {
  return (
    <li>
      <NavLink to={to}>
        <Icon name={icon} size={18} />
        <span>{label}</span>
      </NavLink>
    </li>
  );
}

function ResidentSidebar({ buildingName, unitNumber }: { buildingName: string; unitNumber?: string }) {
  return (
    <aside className="shell-sidebar" aria-label="Navigácia">
      <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: 12, color: 'var(--fg-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Môj byt
        </div>
        <div style={{ fontWeight: 600, marginTop: 2 }}>
          {buildingName}{unitNumber && <span style={{ color: 'var(--fg-muted)' }}> · byt {unitNumber}</span>}
        </div>
      </div>
      <nav>
        <ul className="shell-nav">
          <ResItem to="/moj-dom/domov" icon="home" label="Prehľad" />
          <ResItem to="/moj-dom/faktury" icon="money" label="Faktúry" />
          <ResItem to="/moj-dom/oznamy" icon="announcement" label="Oznamy" />
          <ResItem to="/moj-dom/schodze" icon="calendar" label="Schôdze" />
          <li className="shell-nav-group">Akcie</li>
          <ResItem to="/moj-dom/poruchy/nova" icon="wrench" label="Nahlásiť poruchu" />
          <ResItem to="/moj-dom/burza" icon="bazaar" label="Burza susedov" />
        </ul>
      </nav>
    </aside>
  );
}

/* --------------------------- Dashboard --------------------------- */

function ResidentHome({ me, membership }: { me: Me; membership: Me['memberships'][number] }) {
  const [voting, setVoting] = useState<any | null>(null);
  const [balance, setBalance] = useState<{ outstanding: string; unpaidCount: number } | null>(null);
  const [unread, setUnread] = useState<any[]>([]);
  const [nextMeeting, setNextMeeting] = useState<any | null>(null);
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const bId = membership.building.id;
    const aId = membership.apartment?.id;
    Promise.all([
      api<any[]>(`/voting/building/${bId}`).catch(() => []),
      aId ? api<{ outstanding: string; unpaidCount: number }>(`/finance/apartment/${aId}/balance`).catch(() => null) : Promise.resolve(null),
      api<any[]>(`/announcements/feed`).catch(() => []),
      api<any[]>(`/meetings/building/${bId}`).catch(() => []),
    ]).then(([votings, bal, ann, meetings]) => {
      setVoting(votings.find((v: any) => v.status === 'OPEN') ?? null);
      setBalance(bal);
      setUnread(ann.filter((r: any) => !r.readAt));
      const upcoming = meetings
        .filter((m: any) => m.status === 'SCHEDULED' && new Date(m.scheduledAt) > new Date())
        .sort((a: any, b: any) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
      setNextMeeting(upcoming ?? null);
      setLoaded(true);
    });
  }, [membership.building.id, membership.apartment?.id]);

  const outstanding = balance ? Number(balance.outstanding) : 0;
  const hasAttention = voting || outstanding > 0 || unread.length > 0 || nextMeeting;

  return (
    <>
      <Greeting firstName={me.firstName} subtitle={membership.building.name} />

      {loaded && !hasAttention && (
        <EmptyState
          tone="success"
          icon="✓"
          title="Všetko je v poriadku"
          body="Momentálne pre vás nič nečaká. Ak máte problém v byte alebo v dome, môžete ho nahlásiť."
          action={{ label: 'Nahlásiť poruchu', to: '/moj-dom/viac' }}
        />
      )}

      {voting && (
        <AttentionCard
          severity="pending"
          meta="Aktívne hlasovanie"
          icon="🗳️"
          title={voting.title}
          body={
            <>
              {voting.description}
              <div style={{ marginTop: 8, fontSize: 14, color: 'var(--fg-subtle)' }}>
                Uzávierka{' '}
                {new Date(voting.closesAt).toLocaleString('sk-SK', {
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </>
          }
          primaryAction={{ label: 'Hlasovať teraz →', onClick: () => navigate(`hlasovania/${voting.id}`) }}
        />
      )}

      {outstanding > 0 && (
        <AttentionCard
          severity="urgent"
          meta="Nedoplatok"
          icon="💸"
          title={`${outstanding.toFixed(2)} € na úhradu`}
          body={`${balance!.unpaidCount} neuhradená faktúra. Môžete zaplatiť QR kódom priamo z mobilnej banky.`}
          primaryAction={{ label: 'Zobraziť faktúry', to: '/moj-dom/faktury' }}
        />
      )}

      {outstanding === 0 && balance && (
        <AttentionCard
          severity="ok"
          meta="Financie"
          icon="✓"
          title="Bez nedoplatku"
          body="Všetky vaše faktúry sú zaplatené. Ďakujeme."
          secondaryAction={{ label: 'História faktúr', to: '/moj-dom/faktury' }}
        />
      )}

      {unread.length > 0 && (
        <Section
          title={`Nové oznamy (${unread.length})`}
          action={{ label: 'Všetky oznamy →', to: '/moj-dom/oznamy' }}
        >
          {unread.slice(0, 3).map((r: any) => (
            <ListItem
              key={r.id}
              icon="📢"
              title={r.announcement.title}
              subtitle={r.announcement.body.slice(0, 120)}
              status={<StatusPill tone="info">Nové</StatusPill>}
              to="/moj-dom/oznamy"
            />
          ))}
        </Section>
      )}

      {nextMeeting && (
        <AttentionCard
          severity="info"
          meta="Najbližšia schôdza"
          icon="📅"
          title={nextMeeting.title}
          body={
            <>
              {new Date(nextMeeting.scheduledAt).toLocaleString('sk-SK', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {nextMeeting.location && ` · ${nextMeeting.location}`}
            </>
          }
          primaryAction={{ label: 'Potvrdiť účasť', onClick: () => rsvp(nextMeeting.id, 'YES') }}
          secondaryAction={{ label: 'Neprídem', onClick: () => rsvp(nextMeeting.id, 'NO') }}
        />
      )}
    </>
  );

  async function rsvp(meetingId: string, choice: 'YES' | 'NO' | 'MAYBE') {
    try {
      await api(`/meetings/${meetingId}/rsvp`, { method: 'POST', body: JSON.stringify({ rsvp: choice }) });
      alert(choice === 'YES' ? 'Ďakujeme, vidíme sa.' : 'Poznamenané.');
    } catch {
      alert('Nepodarilo sa zaznamenať odpoveď.');
    }
  }
}

/* --------------------------- Invoices --------------------------- */

function InvoicesPage({ membership }: { membership: Me['memberships'][number] }) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const aId = membership.apartment?.id;

  useEffect(() => {
    if (!aId) return;
    api<any[]>(`/finance/apartment/${aId}/invoices`)
      .then(setInvoices)
      .catch(() => setInvoices([]))
      .finally(() => setLoaded(true));
  }, [aId]);

  return (
    <>
      <Greeting firstName="Faktúry" subtitle={`Byt ${membership.apartment?.unitNumber ?? ''}, ${membership.building.name}`} />
      {loaded && invoices.length === 0 ? (
        <EmptyState icon="🧾" title="Zatiaľ žiadne faktúry" body="Keď vám správca vystaví prvú faktúru, objaví sa tu." />
      ) : (
        invoices.map((inv) => (
          <ListItem
            key={inv.id}
            icon="🧾"
            title={`${labelCategory(inv.category)} · ${inv.period}`}
            subtitle={`Č. ${inv.number} · splatnosť ${new Date(inv.dueDate).toLocaleDateString('sk-SK')}`}
            status={invStatus(inv.status)}
            trailing={<strong>{Number(inv.amount).toFixed(2)} €</strong>}
            to={`/moj-dom/faktury/${inv.id}`}
          />
        ))
      )}
    </>
  );
}

function labelCategory(c: string) {
  return (
    {
      MAINTENANCE_FUND: 'Fond opráv',
      SERVICES: 'Zálohy služby',
      MANAGEMENT_FEE: 'Odmena správcu',
      ONE_TIME: 'Mimoriadna platba',
      OTHER: 'Iné',
    } as Record<string, string>
  )[c] ?? c;
}
function invStatus(s: string) {
  if (s === 'PAID') return <StatusPill tone="ok">Zaplatená</StatusPill>;
  if (s === 'OVERDUE') return <StatusPill tone="urgent">Po splatnosti</StatusPill>;
  if (s === 'DUE') return <StatusPill tone="pending">Neuhradená</StatusPill>;
  return <StatusPill>{s}</StatusPill>;
}

/* --------------------------- Announcements --------------------------- */

function AnnouncementsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    api<any[]>(`/announcements/feed`)
      .then(setItems)
      .catch(() => [])
      .finally(() => setLoaded(true));
  }, []);

  async function markRead(id: string) {
    await api(`/announcements/receipts/${id}/read`, { method: 'PATCH' });
    setItems((s) => s.map((x) => (x.id === id ? { ...x, readAt: new Date().toISOString() } : x)));
  }

  return (
    <>
      <Greeting firstName="Oznamy" />
      {loaded && items.length === 0 && (
        <EmptyState icon="📪" title="Žiadne oznamy" body="Keď správca zverejní oznam, zobrazí sa tu." />
      )}
      {items.map((r) => (
        <div key={r.id} className="ac ac-info" style={{ marginBottom: 12 }}>
          <div className="ac-head">
            <div className="ac-title-block">
              <div className="ac-meta">{new Date(r.announcement.publishedAt).toLocaleDateString('sk-SK')}</div>
              <h3 className="ac-title">{r.announcement.title}</h3>
            </div>
            {!r.readAt && <StatusPill tone="info">Nové</StatusPill>}
          </div>
          <div className="ac-body" style={{ whiteSpace: 'pre-wrap' }}>{r.announcement.body}</div>
          {!r.readAt && (
            <div className="ac-actions">
              <button className="ui-btn ui-btn-primary" onClick={() => markRead(r.id)}>
                Potvrdiť prečítanie
              </button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

/* --------------------------- More (menu) --------------------------- */

function MorePage() {
  return (
    <>
      <Greeting firstName="Viac" />
      <Section title="Môj dom">
        <ListItem icon="📅" title="Schôdze" to="/moj-dom/schodze" />
        <ListItem icon="🔧" title="Nahlásiť poruchu" to="/moj-dom/poruchy/nova" />
        <ListItem icon="🏘️" title="Burza susedov" to="/moj-dom/burza" />
      </Section>
      <Section title="Účet">
        <ListItem icon="⚙️" title="Nastavenia účtu" to="/nastavenia" />
      </Section>
    </>
  );
}

/* --------------------------- Tabbar --------------------------- */

function ResidentTabbar() {
  return (
    <nav className="tabbar" aria-label="Hlavná navigácia">
      <Link to="/moj-dom/domov"><Icon name="home" size={22} />Domov</Link>
      <Link to="/moj-dom/faktury"><Icon name="money" size={22} />Faktúry</Link>
      <Link to="/moj-dom/oznamy"><Icon name="announcement" size={22} />Oznamy</Link>
      <Link to="/moj-dom/viac"><Icon name="more" size={22} />Viac</Link>
    </nav>
  );
}
