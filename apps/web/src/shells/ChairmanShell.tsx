/**
 * ChairmanShell — /b/:buildingId/*
 *
 * Dashboard + sekcie pre predsedu / správcu budovy.
 * Hlavná myšlienka: dashboard odpovedá na otázku
 * "Čo potrebuje moju pozornosť teraz?" — preto Attention Row s priority algoritmom.
 *
 * Sidebar vľavo, obsah vpravo. Mobil = skrytý sidebar (top dropdown navrhneme vo v2).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { api } from '../api';
import {
  ActionRow,
  AttentionCard,
  EmptyState,
  Greeting,
  KPITile,
  ListItem,
  Section,
  StatusPill,
} from '../components/ui';
import { AdminSettingsPage } from './AdminSettings';
import {
  MeetingDetailPage,
  NewAnnouncementPage,
  NewMeetingPage,
  NewRevisionPage,
  NewVotingPage,
  TicketDetailPage,
  VotingDetailPage,
} from './ChairmanPages';
import { ApartmentsPage } from './ApartmentsPage';
import { PaymentsPage } from './PaymentsPage';
import { IssueBulkPage } from './InvoicePages';
import { MembersPage } from './MembersPage';
import { AuditPage } from './AuditPage';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import { Icon, IconName } from '../components/Icons';
import type { Me } from '../types';

export function ChairmanShell({ me }: { me: Me }) {
  const { buildingId } = useParams<{ buildingId: string }>();
  const membership = me.memberships.find(
    (m) => m.building.id === buildingId && ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
  );

  if (!membership) {
    return (
      <div className="shell-main">
        <EmptyState
          icon="🔒"
          title="Nemáte prístup k tejto budove"
          body="Prihláste sa so správnym účtom alebo sa vráťte na hlavnú stránku."
          action={{ label: 'Späť', to: '/' }}
        />
      </div>
    );
  }

  return (
    <div className="shell">
      <Sidebar buildingId={membership.building.id} buildingName={membership.building.name} />
      <main className="shell-main" id="main" tabIndex={-1}>
        <Routes>
          <Route index element={<ChairmanHome me={me} membership={membership} />} />
          <Route path="hlasovania" element={<VotingsTab buildingId={membership.building.id} />} />
          <Route path="hlasovania/nove" element={<NewVotingPage />} />
          <Route path="hlasovania/:vid" element={<VotingDetailPage />} />
          <Route path="poruchy" element={<TicketsTab buildingId={membership.building.id} />} />
          <Route path="poruchy/:tid" element={<TicketDetailPage />} />
          <Route path="schodze" element={<MeetingsTab buildingId={membership.building.id} />} />
          <Route path="schodze/nova" element={<NewMeetingPage />} />
          <Route path="schodze/:mid" element={<MeetingDetailPage />} />
          <Route path="oznamy" element={<AnnouncementsTab buildingId={membership.building.id} />} />
          <Route path="oznamy/nova" element={<NewAnnouncementPage />} />
          <Route path="platby" element={<PaymentsPage />} />
          <Route path="platby/nova-davka" element={<IssueBulkPage />} />
          <Route path="revizie" element={<RevisionsTab buildingId={membership.building.id} />} />
          <Route path="revizie/nova" element={<NewRevisionPage />} />
          <Route path="byty" element={<ApartmentsPage />} />
          <Route path="ucastnici" element={<MembersPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="burza" element={<ClassifiedsTab buildingId={membership.building.id} />} />
          <Route path="nastavenia" element={<AdminSettingsPage buildingId={membership.building.id} />} />
          <Route path="*" element={<Navigate to="" replace />} />
        </Routes>
      </main>
    </div>
  );
}

/* ------------------------------ Sidebar ------------------------------ */

function NavItem({ to, icon, label, end }: { to: string; icon: IconName; label: string; end?: boolean }) {
  return (
    <li>
      <NavLink to={to} end={end}>
        <Icon name={icon} size={18} />
        <span>{label}</span>
      </NavLink>
    </li>
  );
}

function Sidebar({ buildingId, buildingName }: { buildingId: string; buildingName: string }) {
  const base = `/b/${buildingId}`;
  return (
    <aside className="shell-sidebar" aria-label="Navigácia budovy">
      <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.75rem' }}>
        <div style={{ fontSize: 12, color: 'var(--fg-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Budova
        </div>
        <div style={{ fontWeight: 600, marginTop: 2 }}>{buildingName}</div>
      </div>
      <nav>
        <ul className="shell-nav">
          <NavItem to={base} end icon="home" label="Prehľad" />
          <li className="shell-nav-group">Denná prevádzka</li>
          <NavItem to={`${base}/hlasovania`} icon="vote" label="Hlasovania" />
          <NavItem to={`${base}/poruchy`} icon="wrench" label="Poruchy" />
          <NavItem to={`${base}/schodze`} icon="calendar" label="Schôdze" />
          <NavItem to={`${base}/oznamy`} icon="announcement" label="Oznamy" />
          <li className="shell-nav-group">Evidencia</li>
          <NavItem to={`${base}/platby`} icon="money" label="Platby" />
          <NavItem to={`${base}/revizie`} icon="inspection" label="Revízie" />
          <NavItem to={`${base}/byty`} icon="apartment" label="Byty" />
          <NavItem to={`${base}/ucastnici`} icon="users" label="Účastníci" />
          <NavItem to={`${base}/burza`} icon="bazaar" label="Burza" />
          <li className="shell-nav-group">Admin</li>
          <NavItem to={`${base}/nastavenia`} icon="settings" label="Nastavenia budovy" />
          <NavItem to={`${base}/audit`} icon="shield" label="Auditná stopa" />
        </ul>
      </nav>
    </aside>
  );
}

/* ------------------------------ Dashboard ------------------------------ */

interface AttentionItem {
  id: string;
  severity: 'urgent' | 'pending' | 'info';
  priority: number; // nižšie = vyššie priority
  render: () => React.ReactNode;
}

function ChairmanHome({ me, membership }: { me: Me; membership: Me['memberships'][number] }) {
  const bId = membership.building.id;
  const [stats, setStats] = useState<any | null>(null);
  const [votings, setVotings] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      api<any>(`/buildings/${bId}/admin-stats`).catch(() => null),
      api<any[]>(`/voting/building/${bId}`).catch(() => []),
      api<any[]>(`/tickets/building/${bId}`).catch(() => []),
      api<any[]>(`/revisions/building/${bId}`).catch(() => []),
      api<any[]>(`/meetings/building/${bId}`).catch(() => []),
    ]).then(([s, v, t, r, m]) => {
      setStats(s);
      setVotings(v);
      setTickets(t);
      setRevisions(r);
      setMeetings(m);
      setLoaded(true);
    });
  }, [bId]);

  const attention = useMemo<AttentionItem[]>(() => {
    const now = Date.now();
    const items: AttentionItem[] = [];

    // 1) Kritické / otvorené tikety
    tickets
      .filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS')
      .forEach((t) => {
        const critical = t.priority === 'CRITICAL' || t.priority === 'HIGH';
        items.push({
          id: `ticket-${t.id}`,
          severity: critical ? 'urgent' : 'pending',
          priority: critical ? 10 : 60,
          render: () => (
            <AttentionCard
              severity={critical ? 'urgent' : 'pending'}
              meta={critical ? 'Kritická porucha' : 'Otvorená porucha'}
              icon="🔧"
              title={t.title}
              body={<span style={{ whiteSpace: 'pre-wrap' }}>{t.description.slice(0, 180)}</span>}
              primaryAction={{ label: 'Otvoriť', to: `/b/${bId}/poruchy/${t.id}` }}
              footer={`Byt ${t.apartment?.unitNumber ?? '—'} · nahlásené ${fmtRelative(t.createdAt)}`}
            />
          ),
        });
      });

    // 2) Hlasovania: OPEN uzaviera sa < 24 h
    votings
      .filter((v) => v.status === 'OPEN')
      .forEach((v) => {
        const hoursLeft = (new Date(v.closesAt).getTime() - now) / 3_600_000;
        if (hoursLeft < 24) {
          items.push({
            id: `voting-${v.id}`,
            severity: 'urgent',
            priority: 20,
            render: () => (
              <AttentionCard
                severity="urgent"
                meta={`Hlasovanie uzaviera sa o ${Math.max(0, Math.round(hoursLeft))} h`}
                icon="🗳️"
                title={v.title}
                body="Napíšte oznam s pripomienkou, nech vlastníci stihli hlasovať."
                primaryAction={{ label: 'Pripomenúť vlastníkom', to: `/b/${bId}/oznamy/nova` }}
                secondaryAction={{ label: 'Zobraziť hlasovanie', to: `/b/${bId}/hlasovania/${v.id}` }}
              />
            ),
          });
        }
      });

    // 3) Po splatnosti / nadchádzajúce revízie
    revisions
      .filter((r) => !r.completedAt)
      .forEach((r) => {
        const daysLeft = Math.round((new Date(r.dueDate).getTime() - now) / 86400_000);
        if (daysLeft < 0) {
          items.push({
            id: `rev-${r.id}`,
            severity: 'urgent',
            priority: 15,
            render: () => (
              <AttentionCard
                severity="urgent"
                meta={`Revízia ${-daysLeft} dní po splatnosti`}
                icon="🛠️"
                title={r.title}
                body={r.contractorName ? `Dodávateľ: ${r.contractorName} ${r.contractorPhone ?? ''}` : 'Dodávateľ ešte nie je uložený.'}
                primaryAction={{ label: 'Označiť ako hotové', to: `/b/${bId}/revizie` }}
              />
            ),
          });
        } else if (daysLeft <= 30) {
          items.push({
            id: `rev-${r.id}`,
            severity: 'pending',
            priority: 50,
            render: () => (
              <AttentionCard
                severity="pending"
                meta={`Revízia o ${daysLeft} dní`}
                icon="🛠️"
                title={r.title}
                body={r.contractorName ? `Dodávateľ: ${r.contractorName} ${r.contractorPhone ?? ''}` : 'Dodávateľ ešte nie je uložený.'}
                primaryAction={{ label: 'Naplánovať', to: `/b/${bId}/revizie` }}
              />
            ),
          });
        }
      });

    // 4) Schôdza za <48 h
    const upcoming = meetings
      .filter((m) => m.status === 'SCHEDULED' && new Date(m.scheduledAt) > new Date())
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
    if (upcoming) {
      const hoursLeft = (new Date(upcoming.scheduledAt).getTime() - now) / 3_600_000;
      if (hoursLeft < 48) {
        items.push({
          id: `meeting-${upcoming.id}`,
          severity: 'pending',
          priority: 40,
          render: () => (
            <AttentionCard
              severity="pending"
              meta={`Schôdza o ${Math.round(hoursLeft)} h`}
              icon="📅"
              title={upcoming.title}
              body={upcoming.location ?? 'Miesto nie je zadané'}
              primaryAction={{ label: 'Otvoriť schôdzu', to: `/b/${bId}/schodze/${upcoming.id}` }}
            />
          ),
        });
      }
    }

    return items.sort((a, b) => a.priority - b.priority).slice(0, 4);
  }, [votings, tickets, revisions, meetings, bId]);

  const outstanding = stats?.outstandingTotalEur ? Number(stats.outstandingTotalEur) : 0;
  const nextMeeting = meetings
    .filter((m) => m.status === 'SCHEDULED' && new Date(m.scheduledAt) > new Date())
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];

  return (
    <>
      <Greeting
        firstName={me.firstName}
        subtitle={
          loaded && attention.length > 0
            ? `${attention.length} ${plural(attention.length, ['vec čaká', 'veci čakajú', 'vecí čaká'])} na rozhodnutie.`
            : loaded
              ? 'Všetko je v poriadku.'
              : 'Načítavam prehľad…'
        }
      />

      {/* Sprievodca rozbehom — viditeľné iba kým nie sú všetky 4 kroky splnené */}
      {stats && <OnboardingChecklist buildingId={bId} stats={stats} />}

      {/* Attention Row */}
      {attention.length > 0 ? (
        <section className="dp-section">
          <div className="dp-grid">{attention.map((a) => <div key={a.id}>{a.render()}</div>)}</div>
        </section>
      ) : loaded ? (
        <EmptyState
          tone="success"
          icon="✓"
          title="Dnes nič nehorí"
          body="Ak chcete mať iniciatívu, môžete napísať oznam alebo naplánovať schôdzu."
        />
      ) : null}

      {/* Rýchle akcie */}
      <Section title="Rýchle akcie">
        <ActionRow
          actions={[
            { label: 'Nové hlasovanie', to: `/b/${bId}/hlasovania/nove`, icon: '🗳️', primary: true },
            { label: 'Pridať oznam', to: `/b/${bId}/oznamy/nova`, icon: '📢' },
            { label: 'Naplánovať schôdzu', to: `/b/${bId}/schodze/nova`, icon: '📅' },
          ]}
        />
      </Section>

      {/* 2-col finance + meeting */}
      <div className="dp-two-col" style={{ marginBottom: '2rem' }}>
        <AttentionCard
          severity={outstanding > 0 ? 'pending' : 'ok'}
          meta="Financie"
          icon="💸"
          title={outstanding > 0 ? `${outstanding.toFixed(2)} € nedoplatkov` : 'Bez nedoplatkov'}
          body={
            outstanding > 0
              ? 'Môžete poslať upomienky vlastníkom s otvoreným zostatkom.'
              : 'Všetky byty sú v termíne. Ďalšie mesačné faktúry sa generujú automaticky.'
          }
          primaryAction={
            outstanding > 0
              ? { label: 'Poslať upomienky', to: `/b/${bId}/platby` }
              : { label: 'Zobraziť platby', to: `/b/${bId}/platby` }
          }
        />
        {nextMeeting ? (
          <AttentionCard
            severity="info"
            meta="Najbližšia schôdza"
            icon="📅"
            title={nextMeeting.title}
            body={new Date(nextMeeting.scheduledAt).toLocaleString('sk-SK', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}
            primaryAction={{ label: 'Otvoriť', to: `/b/${bId}/schodze/${nextMeeting.id}` }}
          />
        ) : (
          <EmptyState
            icon="📅"
            title="Žiadna schôdza"
            body="Môžete naplánovať ďalšiu schôdzu vlastníkov."
            action={{ label: 'Naplánovať', to: `/b/${bId}/schodze/nova` }}
          />
        )}
      </div>

      {/* Health strip */}
      {stats && (
        <Section title="Zdravie budovy">
          <div className="dp-grid-sm">
            <KPITile
              label="Registrovaní vlastníci"
              value={`${stats.registeredOwners}/${stats.apartmentsCount}`}
              tone={stats.registrationRate >= 0.8 ? 'ok' : stats.registrationRate >= 0.5 ? 'pending' : 'urgent'}
              hint={`${Math.round(stats.registrationRate * 100)} %`}
            />
            <KPITile
              label="Otvorené poruchy"
              value={stats.openTickets}
              tone={stats.openTickets === 0 ? 'ok' : 'pending'}
            />
            <KPITile
              label="Čítanosť oznamov"
              value={`${Math.round(stats.announcementReadRate * 100)} %`}
              tone={stats.announcementReadRate >= 0.7 ? 'ok' : 'pending'}
            />
            <KPITile
              label="Revízie do 60 dní"
              value={stats.upcomingRevisionsCount}
              tone={stats.upcomingRevisionsCount === 0 ? 'ok' : 'pending'}
            />
            <KPITile
              label="Uzavreté hlasovania"
              value={stats.totalClosedVotings}
              hint={`${Math.round(stats.votingAcceptanceRate * 100)} % prijatých`}
            />
          </div>
        </Section>
      )}
    </>
  );
}

function plural(n: number, forms: [string, string, string]) {
  if (n === 1) return forms[0];
  if (n >= 2 && n <= 4) return forms[1];
  return forms[2];
}

function fmtRelative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (diff < 60) return `pred ${Math.max(1, Math.round(diff))} min`;
  if (diff < 1440) return `pred ${Math.round(diff / 60)} h`;
  return `pred ${Math.round(diff / 1440)} dňami`;
}

/* ----------------------- Module sub-pages (V1 stubs) ----------------------- */
/*
 * V tejto iterácii sú tab obrazovky zjednodušené — ukazujú zoznamy cez ListItem.
 * Detailné formy (nové hlasovanie, nový oznam, atď.) presunieme z pôvodného
 * Building page do samostatných routov v ďalšom kroku.
 */

function VotingsTab({ buildingId }: { buildingId: string }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api<any[]>(`/voting/building/${buildingId}`).then(setItems).catch(() => {}); }, [buildingId]);
  return (
    <>
      <Greeting firstName="Hlasovania" subtitle="Prebiehajúce a minulé hlasovania" />
      <Section title="Všetky hlasovania" action={{ label: '+ Nové', to: `/b/${buildingId}/hlasovania/nove`, onClick: undefined }}>
        {items.length === 0 && <EmptyState icon="🗳️" title="Žiadne hlasovania" body="Ešte ste nevytvorili žiadne." />}
        {items.map((v) => (
          <ListItem
            key={v.id}
            icon="🗳️"
            title={v.title}
            subtitle={`Uzávierka ${new Date(v.closesAt).toLocaleDateString('sk-SK')} · ${v.type}`}
            status={votingStatus(v)}
            to={`/b/${buildingId}/hlasovania/${v.id}`}
          />
        ))}
      </Section>
    </>
  );
}
function votingStatus(v: any) {
  if (v.status === 'OPEN') return <StatusPill tone="info" dot>Prebieha</StatusPill>;
  if (v.status === 'DRAFT') return <StatusPill>Pripravené</StatusPill>;
  if (v.status === 'CANCELLED') return <StatusPill tone="urgent">Zrušené</StatusPill>;
  if (v.result?.accepted) return <StatusPill tone="ok">Prijaté</StatusPill>;
  if (v.status === 'CLOSED') return <StatusPill>Uzavreté</StatusPill>;
  return <StatusPill>{v.status}</StatusPill>;
}

function TicketsTab({ buildingId }: { buildingId: string }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api<any[]>(`/tickets/building/${buildingId}`).then(setItems).catch(() => {}); }, [buildingId]);
  return (
    <>
      <Greeting firstName="Poruchy" subtitle="Nahlásené problémy v dome" />
      {items.length === 0 && <EmptyState icon="🔧" title="Žiadne nahlásené poruchy" body="Keď vlastník nahlási problém, zobrazí sa tu." />}
      {items.map((t) => (
        <ListItem
          key={t.id}
          icon="🔧"
          title={t.title}
          subtitle={`Byt ${t.apartment?.unitNumber ?? '—'} · priorita ${t.priority}`}
          status={ticketStatus(t.status)}
          to={`/b/${buildingId}/poruchy/${t.id}`}
        />
      ))}
    </>
  );
}
function ticketStatus(s: string) {
  if (s === 'OPEN') return <StatusPill tone="urgent">Otvorený</StatusPill>;
  if (s === 'IN_PROGRESS') return <StatusPill tone="pending">V riešení</StatusPill>;
  if (s === 'WAITING') return <StatusPill tone="pending">Čaká</StatusPill>;
  if (s === 'RESOLVED') return <StatusPill tone="ok">Vyriešený</StatusPill>;
  if (s === 'CLOSED') return <StatusPill>Uzavretý</StatusPill>;
  return <StatusPill>{s}</StatusPill>;
}

function MeetingsTab({ buildingId }: { buildingId: string }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api<any[]>(`/meetings/building/${buildingId}`).then(setItems).catch(() => {}); }, [buildingId]);
  return (
    <>
      <Greeting firstName="Schôdze" subtitle="Plánované a uskutočnené schôdze vlastníkov" />
      <Section title="Všetky schôdze" action={{ label: '+ Nová schôdza', to: `/b/${buildingId}/schodze/nova` }}>
        {items.length === 0 && <EmptyState icon="📅" title="Žiadne schôdze" />}
        {items.map((m) => (
          <ListItem
            key={m.id}
            icon="📅"
            title={m.title}
            subtitle={new Date(m.scheduledAt).toLocaleString('sk-SK', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            status={meetingStatus(m.status)}
            to={`/b/${buildingId}/schodze/${m.id}`}
          />
        ))}
      </Section>
    </>
  );
}
function meetingStatus(s: string) {
  if (s === 'SCHEDULED') return <StatusPill tone="info">Naplánovaná</StatusPill>;
  if (s === 'COMPLETED') return <StatusPill tone="ok">Uskutočnená</StatusPill>;
  if (s === 'CANCELLED') return <StatusPill tone="urgent">Zrušená</StatusPill>;
  return <StatusPill>{s}</StatusPill>;
}

function AnnouncementsTab({ buildingId }: { buildingId: string }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api<any[]>(`/announcements/building/${buildingId}`).then(setItems).catch(() => {}); }, [buildingId]);
  return (
    <>
      <Greeting firstName="Oznamy" subtitle="Digitálna nástenka — všetky oznamy v budove s čítanosťou" />
      <Section title="Všetky oznamy" action={{ label: '+ Nový oznam', to: `/b/${buildingId}/oznamy/nova` }}>
        {items.length === 0 && <EmptyState icon="📢" title="Zatiaľ žiadne oznamy" body="Prvý oznam uvidia vlastníci ihneď po publikovaní." action={{ label: '+ Nový oznam', to: `/b/${buildingId}/oznamy/nova` }} />}
        {items.map((a) => {
          const pct = Math.round(a.readRate * 100);
          return (
            <ListItem
              key={a.id}
              icon="📢"
              title={a.title}
              subtitle={`${new Date(a.publishedAt).toLocaleDateString('sk-SK')} · ${a.body.slice(0, 80)}`}
              status={
                <StatusPill tone={pct === 100 ? 'ok' : pct >= 60 ? 'info' : 'pending'}>
                  {a.readCount}/{a.delivered} prečítalo · {pct} %
                </StatusPill>
              }
            />
          );
        })}
      </Section>
    </>
  );
}

function PaymentsTab({ buildingId }: { buildingId: string }) {
  return (
    <>
      <Greeting firstName="Platby" subtitle="Stav platieb a nedoplatkov vlastníkov" />
      <EmptyState
        icon="💸"
        title="Detailný prehľad platieb v prípravě"
        body="V tejto iterácii sa platby spravujú cez Swagger API. UI pre platby príde v ďalšom kroku."
      />
    </>
  );
}

function RevisionsTab({ buildingId }: { buildingId: string }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api<any[]>(`/revisions/building/${buildingId}`).then(setItems).catch(() => {}); }, [buildingId]);
  return (
    <>
      <Greeting firstName="Revízie" subtitle="Zákonné kontroly kotla, výťahu, bleskozvodu…" />
      <Section title="Naplánované revízie" action={{ label: '+ Nová revízia', to: `/b/${buildingId}/revizie/nova` }}>
        {items.length === 0 && <EmptyState icon="🛠️" title="Žiadne revízie" body="Pridajte zákonne povinné kontroly." />}
        {items.map((r) => {
          const days = Math.round((new Date(r.dueDate).getTime() - Date.now()) / 86400_000);
          const status = r.completedAt
            ? <StatusPill tone="ok">Hotové</StatusPill>
            : days < 0
              ? <StatusPill tone="urgent">{-days} dní po splatnosti</StatusPill>
              : days <= 30
                ? <StatusPill tone="pending">O {days} dní</StatusPill>
                : <StatusPill>O {days} dní</StatusPill>;
          return (
            <ListItem
              key={r.id}
              icon="🛠️"
              title={r.title}
              subtitle={r.contractorName ?? '—'}
              status={status}
            />
          );
        })}
      </Section>
    </>
  );
}

function ApartmentsTab({ buildingId }: { buildingId: string }) {
  return (
    <>
      <Greeting firstName="Byty" subtitle="Evidencia bytov a vlastníkov" />
      <EmptyState
        icon="🏢"
        title="Evidencia bytov"
        body="Detailná správa bytov v prípravě. Medzičasom byty importujete v Nastaveniach."
        action={{ label: 'Nastavenia budovy', to: `/b/${buildingId}/nastavenia` }}
      />
    </>
  );
}

function ClassifiedsTab({ buildingId }: { buildingId: string }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { api<any[]>(`/classifieds/building/${buildingId}`).then(setItems).catch(() => {}); }, [buildingId]);
  return (
    <>
      <Greeting firstName="Burza" subtitle="Susedská výmena vecí a informácií" />
      <Section title="Aktívne inzeráty">
        {items.length === 0 && <EmptyState icon="🏘️" title="Zatiaľ nič" body="Byť prvý a pridať inzerát." />}
        {items.map((c) => (
          <ListItem
            key={c.id}
            icon="🏘️"
            title={c.title}
            subtitle={c.body.slice(0, 120)}
            status={c.priceEur ? <StatusPill>{Number(c.priceEur).toFixed(2)} €</StatusPill> : undefined}
          />
        ))}
      </Section>
    </>
  );
}
