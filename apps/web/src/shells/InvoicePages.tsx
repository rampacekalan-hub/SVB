/**
 * Invoice creation — dve cesty:
 *   - IssueSingleModal: vystaviť jednu faktúru konkrétnemu bytu (z platieb sekcie)
 *   - IssueBulkPage: dávkové vystavenie rovnakej faktúry všetkým bytom
 *     (najčastejší prípad: mesačné zálohy, fond opráv za mesiac)
 *
 * Backend:
 *   POST /finance/invoices                    — single
 *   POST /finance/building/:id/issue-bulk     — bulk
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/ui';

type Category = 'MAINTENANCE_FUND' | 'SERVICES' | 'MANAGEMENT_FEE' | 'ONE_TIME' | 'OTHER';

const categoryLabel: Record<Category, string> = {
  MAINTENANCE_FUND: 'Fond opráv',
  SERVICES: 'Zálohy na služby',
  MANAGEMENT_FEE: 'Odmena správcu',
  ONE_TIME: 'Mimoriadna platba',
  OTHER: 'Iné',
};

/* ------------------- Bulk issue page ------------------- */

export function IssueBulkPage() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const navigate = useNavigate();
  const [apartments, setApartments] = useState<any[]>([]);
  const now = new Date();
  const [form, setForm] = useState({
    category: 'SERVICES' as Category,
    period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    amount: '',
    dueDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`,
    note: '',
  });
  const [result, setResult] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!buildingId) return;
    api<any[]>(`/apartments/by-building/${buildingId}`).then(setApartments).catch(() => {});
  }, [buildingId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!buildingId) return;
    if (!confirm(`Vystaviť rovnakú faktúru ${apartments.length} bytom za ${Number(form.amount || 0).toFixed(2)} €?`)) return;
    setBusy(true); setErr(null);
    try {
      const r = await api<any>(`/finance/building/${buildingId}/issue-bulk`, {
        method: 'POST',
        body: JSON.stringify({
          category: form.category,
          period: form.period,
          amount: form.amount,
          dueDate: new Date(form.dueDate).toISOString(),
          note: form.note || undefined,
        }),
      });
      setResult(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const totalEur = Number(form.amount || 0) * apartments.length;

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Platby', to: `/b/${buildingId}/platby` },
          { label: 'Hromadné vystavenie' },
        ]}
        title="Mesačná dávka faktúr"
        subtitle={`Vystavíte rovnakú faktúru všetkým ${apartments.length} bytom naraz.`}
      />

      {result ? (
        <ResultCard result={result} buildingId={buildingId!} />
      ) : (
        <form onSubmit={submit} className="card" style={{ padding: '1.5rem', maxWidth: 720 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label>
              Kategória
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>
                {Object.entries(categoryLabel).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <label>
              Obdobie
              <input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="2026-04" required />
              <span className="hint">Formát ROK-MESIAC alebo ROK-Q1</span>
            </label>
            <label>
              Suma na byt (€)
              <input required type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="124.50" />
            </label>
            <label>
              Dátum splatnosti
              <input required type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </label>
          </div>
          <label style={{ marginTop: 12 }}>
            Poznámka (voliteľné — objaví sa na faktúre)
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Zálohy na teplo, vodu a spoločnú elektrinu" />
          </label>

          <div className="issue-preview">
            <strong>Náhľad</strong>
            <div className="inline-meta">
              {apartments.length} bytov × {Number(form.amount || 0).toFixed(2)} € = <strong>{totalEur.toFixed(2)} €</strong>
            </div>
            <div className="inline-meta">
              Každá faktúra dostane číslo <code>{form.period}-01</code>, <code>{form.period}-02</code> atď.
            </div>
            <div className="inline-meta">
              Kategória: {categoryLabel[form.category]} · Obdobie: {form.period} · Splatnosť {new Date(form.dueDate).toLocaleDateString('sk-SK')}
            </div>
          </div>

          {err && <p role="alert" style={{ color: 'var(--urgent)' }}>{err}</p>}

          <div className="form-actions" style={{ marginTop: 16 }}>
            <button type="submit" className="ui-btn ui-btn-primary" disabled={busy || apartments.length === 0}>
              {busy ? 'Vystavujem…' : `Vystaviť ${apartments.length} faktúr`}
            </button>
            <button type="button" className="ui-btn ui-btn-ghost" onClick={() => navigate(`/b/${buildingId}/platby`)}>Zrušiť</button>
          </div>
        </form>
      )}
    </>
  );
}

function ResultCard({ result, buildingId }: { result: any; buildingId: string }) {
  return (
    <div className="card" style={{ padding: '1.5rem', maxWidth: 560, margin: '0 auto' }}>
      <div className="success-hero">
        <div className="success-icon">✓</div>
        <h3 style={{ margin: 0 }}>Faktúry vystavené</h3>
        <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
          <StatusPill tone="ok">Vytvorených: {result.created}</StatusPill>
          {result.skipped > 0 && <StatusPill>Preskočené: {result.skipped}</StatusPill>}
          {result.errors?.length > 0 && <StatusPill tone="urgent">Chyby: {result.errors.length}</StatusPill>}
        </div>
        <p style={{ color: 'var(--fg-muted)', marginTop: 12 }}>
          Vlastníci uvidia faktúru okamžite vo svojej appke s QR kódom. Stav úhrad sledujte v{' '}
          <Link to={`/b/${buildingId}/platby`}>Platby</Link>.
        </p>
      </div>
      <div className="form-actions" style={{ justifyContent: 'center' }}>
        <Link to={`/b/${buildingId}/platby`} className="ui-btn ui-btn-primary">Prejsť na Platby</Link>
        <Link to={`/b/${buildingId}/platby/nova-davka`} className="ui-btn ui-btn-ghost" onClick={() => window.location.reload()}>Ďalšia dávka</Link>
      </div>
    </div>
  );
}
