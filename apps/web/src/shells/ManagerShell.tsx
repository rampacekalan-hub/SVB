/**
 * ManagerShell — /admin/*
 *
 * Portfolio pohľad pre správcovskú firmu s viacerými budovami.
 *   - Hlavné KPIs naprieč celým portfóliom (nedoplatky spolu, tikety, revízie)
 *   - Tabuľka budov s color-coded "health dots" v každom stĺpci
 *   - Rýchle prekliky do konkrétnej budovy (Chairman shell)
 *   - [+ Nová budova] vedie do onboarding wizardu
 *
 * Filter: zobraziť iba budovy kde som CHAIRMAN/MANAGER/ADMIN.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, Greeting, KPITile, Section, StatusPill } from '../components/ui';
import type { Me } from '../types';

interface BuildingRow {
  id: string;
  name: string;
  city: string;
  country: string;
  apartmentsCount: number;
  registeredOwners: number;
  registrationRate: number;
  openTickets: number;
  activeVoting: any | null;
  nextMeeting: { id: string; title: string; scheduledAt: string } | null;
  outstandingTotalEur: string;
  upcomingRevisionsCount: number;
}

export function ManagerShell({ me }: { me: Me }) {
  const adminBuildings = useMemo(
    () => me.memberships.filter((m) => ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role)),
    [me],
  );

  if (adminBuildings.length === 0) {
    return (
      <main className="shell-main">
        <EmptyState
          icon="🏢"
          title="Nemáte žiadne budovy pod správou"
          body="Ak ste správcovská firma, vytvorte prvú budovu cez onboarding wizard."
          action={{ label: 'Vytvoriť budovu', to: '/onboarding' }}
        />
      </main>
    );
  }

  return (
    <main className="shell-main" id="main" tabIndex={-1}>
      <Routes>
        <Route index element={<ManagerOverview me={me} />} />
        <Route path="budovy" element={<ManagerBuildings me={me} />} />
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </main>
  );
}

function ManagerOverview({ me }: { me: Me }) {
  const navigate = useNavigate();
  const adminBuildings = me.memberships.filter((m) =>
    ['CHAIRMAN', 'MANAGER', 'ADMIN'].includes(m.role),
  );
  const [rows, setRows] = useState<BuildingRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const unique = Array.from(new Set(adminBuildings.map((m) => m.building.id)));
      const results: BuildingRow[] = [];
      for (const id of unique) {
        try {
          const [info, stats] = await Promise.all([
            api<any>(`/buildings/${id}`),
            api<any>(`/buildings/${id}/admin-stats`),
          ]);
          results.push({
            id,
            name: info.name,
            city: info.city,
            country: info.country,
            apartmentsCount: stats.apartmentsCount,
            registeredOwners: stats.registeredOwners,
            registrationRate: stats.registrationRate,
            openTickets: stats.openTickets,
            activeVoting: stats.activeVoting,
            nextMeeting: stats.nextMeeting,
            outstandingTotalEur: stats.outstandingTotalEur,
            upcomingRevisionsCount: stats.upcomingRevisionsCount,
          });
        } catch {
          // skip buildings we don't have access to
        }
      }
      setRows(results);
      setLoaded(true);
    })();
  }, [adminBuildings.length]);

  const totalApartments = rows.reduce((s, r) => s + r.apartmentsCount, 0);
  const totalOutstanding = rows.reduce((s, r) => s + Number(r.outstandingTotalEur), 0);
  const totalOpenTickets = rows.reduce((s, r) => s + r.openTickets, 0);
  const totalUpcomingRevisions = rows.reduce((s, r) => s + r.upcomingRevisionsCount, 0);
  const avgRegistration = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + r.registrationRate, 0) / rows.length * 100)
    : 0;

  return (
    <>
      <Greeting
        firstName={me.firstName}
        subtitle={`Portfólio — ${rows.length} ${rows.length === 1 ? 'budova' : rows.length < 5 ? 'budovy' : 'budov'}, ${totalApartments} bytov`}
      />

      <Section
        title="Portfolio prehľad"
        action={{ label: '+ Nová budova', to: '/onboarding' }}
      >
        <div className="dp-grid-sm">
          <KPITile
            label="Nedoplatky spolu"
            value={`${totalOutstanding.toFixed(0)} €`}
            tone={totalOutstanding === 0 ? 'ok' : totalOutstanding > 2000 ? 'urgent' : 'pending'}
          />
          <KPITile
            label="Otvorené poruchy"
            value={totalOpenTickets}
            tone={totalOpenTickets === 0 ? 'ok' : 'pending'}
          />
          <KPITile
            label="Revízie do 60 dní"
            value={totalUpcomingRevisions}
            tone={totalUpcomingRevisions === 0 ? 'ok' : 'pending'}
          />
          <KPITile
            label="Priemer registrácie"
            value={`${avgRegistration} %`}
            tone={avgRegistration >= 70 ? 'ok' : avgRegistration >= 40 ? 'pending' : 'urgent'}
          />
          <KPITile label="Bytov spolu" value={totalApartments} />
        </div>
      </Section>

      <Section title="Budovy">
        {loaded && rows.length === 0 && (
          <EmptyState
            icon="🏢"
            title="Zatiaľ žiadna budova"
            body="Vytvorte prvú budovu cez onboarding wizard."
            action={{ label: 'Vytvoriť budovu', to: '/onboarding' }}
          />
        )}
        {rows.length > 0 && (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
            <table className="apt-table">
              <thead>
                <tr>
                  <th>Budova</th>
                  <th>Mesto</th>
                  <th>Byty</th>
                  <th>Registrácia</th>
                  <th>Nedoplatky</th>
                  <th>Tikety</th>
                  <th>Revízie</th>
                  <th>Hlasovanie</th>
                  <th>Schôdza</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const out = Number(r.outstandingTotalEur);
                  return (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/b/${r.id}`)}>
                      <td><strong>{r.name}</strong></td>
                      <td><span className="inline-meta">{r.city}, {r.country}</span></td>
                      <td>{r.apartmentsCount}</td>
                      <td><Dot tone={r.registrationRate >= 0.7 ? 'ok' : r.registrationRate >= 0.4 ? 'pending' : 'urgent'} />{Math.round(r.registrationRate * 100)} %</td>
                      <td><Dot tone={out === 0 ? 'ok' : out > 500 ? 'urgent' : 'pending'} />{out.toFixed(0)} €</td>
                      <td><Dot tone={r.openTickets === 0 ? 'ok' : 'pending'} />{r.openTickets}</td>
                      <td><Dot tone={r.upcomingRevisionsCount === 0 ? 'ok' : 'pending'} />{r.upcomingRevisionsCount}</td>
                      <td>{r.activeVoting ? <StatusPill tone="info" dot>Prebieha</StatusPill> : <span className="inline-meta">—</span>}</td>
                      <td>{r.nextMeeting ? <span className="inline-meta">{new Date(r.nextMeeting.scheduledAt).toLocaleDateString('sk-SK')}</span> : <span className="inline-meta">—</span>}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Link to={`/b/${r.id}`} className="ui-btn ui-btn-ghost" style={{ minHeight: 28, padding: '0 10px', fontSize: 12 }} onClick={(e) => e.stopPropagation()}>
                          Otvoriť →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

function ManagerBuildings({ me }: { me: Me }) {
  return <ManagerOverview me={me} />;
}

function Dot({ tone }: { tone: 'ok' | 'pending' | 'urgent' }) {
  const color = tone === 'ok' ? 'var(--ok-600)' : tone === 'pending' ? 'var(--pending)' : 'var(--urgent)';
  return (
    <span
      aria-hidden="true"
      style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: color, marginRight: 6, verticalAlign: 'middle' }}
    />
  );
}
