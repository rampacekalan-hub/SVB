/**
 * PaymentsPage — /b/:buildingId/platby
 *
 * Jeden pohľad na finančné zdravie budovy:
 *   - KPIs (celkové nedoplatky, zaplatené, % bytov bez nedoplatku)
 *   - Tabuľka bytov zoradená podľa nedoplatku (najväčší prvý)
 *   - Akcie: poslať upomienku, otvoriť detail bytu
 *
 * Backend: GET /finance/building/:id/payments-overview
 *          POST /finance/apartment/:id/send-reminder
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, KPITile, Section, StatusPill } from '../components/ui';
import { PageHeader } from '../components/PageHeader';

interface PaymentsRow {
  apartmentId: string;
  unitNumber: string;
  floor: number | null;
  owner: string | null;
  ownerEmail: string | null;
  outstanding: string;
  paid: string;
  unpaidCount: number;
  oldestDueDate: string | null;
  daysOverdue: number;
}

interface Overview {
  buildingId: string;
  totalOutstanding: string;
  totalPaid: string;
  apartmentsCount: number;
  unpaidApartments: number;
  rows: PaymentsRow[];
}

type Filter = 'all' | 'unpaid' | 'overdue';

export function PaymentsPage() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const [data, setData] = useState<Overview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>('unpaid');
  const [sending, setSending] = useState<string | null>(null);

  async function load() {
    if (!buildingId) return;
    try {
      const r = await api<Overview>(`/finance/building/${buildingId}/payments-overview`);
      setData(r);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { load(); }, [buildingId]);

  async function sendReminder(apartmentId: string, unitNumber: string) {
    if (!confirm(`Poslať upomienku vlastníkovi bytu ${unitNumber}?`)) return;
    setSending(apartmentId);
    try {
      await api(`/finance/apartment/${apartmentId}/send-reminder`, { method: 'POST' });
      alert('Upomienka odoslaná.');
    } catch (e) {
      alert('Chyba: ' + (e as Error).message);
    } finally {
      setSending(null);
    }
  }

  const rows = data?.rows ?? [];
  const filtered =
    filter === 'all' ? rows
    : filter === 'unpaid' ? rows.filter((r) => Number(r.outstanding) > 0)
    : rows.filter((r) => r.daysOverdue > 0);

  const outstanding = data ? Number(data.totalOutstanding) : 0;
  const paid = data ? Number(data.totalPaid) : 0;
  const collectionRate = data && (outstanding + paid) > 0
    ? Math.round((paid / (outstanding + paid)) * 100)
    : 100;

  return (
    <>
      <PageHeader
        title="Platby"
        subtitle="Stav platieb vlastníkov a upomienky. Vystavte novú dávku faktúr alebo sledujte kto ešte nezaplatil."
        action={
          <Link to={`/b/${buildingId}/platby/nova-davka`} className="ui-btn ui-btn-primary">
            + Mesačná dávka
          </Link>
        }
      />

      <Section title="Prehľad budovy">
        <div className="dp-grid-sm">
          <KPITile
            label="Nedoplatky spolu"
            value={`${outstanding.toFixed(2)} €`}
            tone={outstanding === 0 ? 'ok' : outstanding > 500 ? 'urgent' : 'pending'}
          />
          <KPITile label="Vybrané spolu (12m)" value={`${paid.toFixed(2)} €`} />
          <KPITile
            label="Úspešnosť inkasa"
            value={`${collectionRate} %`}
            tone={collectionRate >= 95 ? 'ok' : collectionRate >= 80 ? 'pending' : 'urgent'}
          />
          <KPITile
            label="Byty s nedoplatkom"
            value={data ? `${data.unpaidApartments}/${data.apartmentsCount}` : '—'}
            tone={data?.unpaidApartments === 0 ? 'ok' : 'pending'}
          />
        </div>
      </Section>

      <Section title="Stav po bytoch">
        <div className="pay-filter">
          <button className={`pay-chip ${filter === 'unpaid' ? 'active' : ''}`} onClick={() => setFilter('unpaid')}>
            Neuhradené ({rows.filter((r) => Number(r.outstanding) > 0).length})
          </button>
          <button className={`pay-chip ${filter === 'overdue' ? 'active' : ''}`} onClick={() => setFilter('overdue')}>
            Po splatnosti ({rows.filter((r) => r.daysOverdue > 0).length})
          </button>
          <button className={`pay-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            Všetky ({rows.length})
          </button>
        </div>

        {loaded && filtered.length === 0 && (
          <EmptyState
            tone="success"
            icon="✓"
            title={filter === 'all' ? 'Žiadne byty' : 'Všetky byty sú v termíne'}
            body={filter === 'all' ? 'Pridajte byty v evidencii.' : 'Nič netreba riešiť, pekná práca.'}
          />
        )}

        {filtered.length > 0 && (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
            <table className="apt-table">
              <thead>
                <tr>
                  <th>Byt</th>
                  <th>Vlastník</th>
                  <th>Faktúry</th>
                  <th>Nedoplatok</th>
                  <th>Zaplatené</th>
                  <th>Stav</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const out = Number(r.outstanding);
                  const overdue = r.daysOverdue > 0;
                  return (
                    <tr key={r.apartmentId}>
                      <td><strong>{r.unitNumber}</strong>{r.floor !== null && <span className="inline-meta"> · {r.floor}. posch.</span>}</td>
                      <td>
                        {r.owner ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{r.owner}</span>
                            <span className="inline-meta">{r.ownerEmail}</span>
                          </div>
                        ) : <span className="inline-meta">— nepriradený —</span>}
                      </td>
                      <td>{r.unpaidCount}</td>
                      <td>
                        <strong style={{ color: out > 0 ? 'var(--urgent)' : 'var(--ok-600)' }}>
                          {out.toFixed(2)} €
                        </strong>
                      </td>
                      <td>{Number(r.paid).toFixed(2)} €</td>
                      <td>
                        {out === 0 ? (
                          <StatusPill tone="ok">V termíne</StatusPill>
                        ) : overdue ? (
                          <StatusPill tone="urgent">{r.daysOverdue} dní po splatnosti</StatusPill>
                        ) : (
                          <StatusPill tone="pending">Neuhradené</StatusPill>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {out > 0 && (
                          <button
                            className="ui-btn ui-btn-ghost"
                            style={{ minHeight: 28, padding: '0 10px', fontSize: 12 }}
                            disabled={sending === r.apartmentId}
                            onClick={() => sendReminder(r.apartmentId, r.unitNumber)}
                          >
                            {sending === r.apartmentId ? 'Posielam…' : 'Upomienka'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <p className="inline-meta" style={{ marginTop: 16 }}>
        Chcete vystaviť novú dávku faktúr? Použite{' '}
        <Link to={`/b/${buildingId}/nastavenia`}>Nastavenia → CSV bank import</Link> alebo Swagger API.
      </p>
    </>
  );
}
