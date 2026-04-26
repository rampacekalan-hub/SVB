/**
 * SuppliersPage — databáza dodávateľov SVB.
 *
 * Energie, výťahový servis, plynár, advokát, … opakujúce sa firmy ktoré
 * fakturujú SVB. Pri prijatí novej faktúry sa systém pokúsi rozpoznať
 * dodávateľa podľa IČO — ak existuje, automaticky sa priradí.
 */
import { useEffect, useState } from 'react';
import { api } from '../api';
import { PageHeader } from '../components/PageHeader';
import { Btn } from '../components/Button';
import { Field, Form, Row } from '../components/forms';
import { EmptyState, ListItem, Section, StatusPill } from '../components/ui';
import { SkeletonList } from '../components/Skeleton';
import { Icon } from '../components/Icons';
import { IcoLookupHint } from '../components/IcoLookup';
import type { RegistryResult } from '../hooks/useIcoLookup';
import { CompanyNameSearch, type NameSearchResult } from '../components/CompanyNameSearch';

interface Supplier {
  id: string;
  name: string;
  ico: string | null;
  dic: string | null;
  vatId: string | null;
  iban: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  category: string | null;
  note: string | null;
  _count?: { invoices: number };
}

const CATEGORIES = [
  'Energie', 'Plyn', 'Voda', 'Teplo', 'Elektrina',
  'Výťah', 'Komín', 'Bleskozvod', 'Hasičské', 'Elektroinštalácia',
  'Upratovanie', 'Údržba', 'Stavebné práce',
  'Účtovníctvo', 'Právne služby', 'Banka', 'Poistenie',
  'Iné',
];

export function SuppliersPage({ buildingId }: { buildingId: string }) {
  const [items, setItems] = useState<Supplier[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);

  async function load() {
    try {
      const r = await api<Supplier[]>(`/suppliers/building/${buildingId}`);
      setItems(r);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { load(); }, [buildingId]);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Budova', to: `/b/${buildingId}` }, { label: 'Dodávatelia' }]}
        title="Dodávatelia"
        subtitle="Firmy, ktoré opakovane fakturujú SVB. Pri uploadu novej faktúry sa rozpozná dodávateľ podľa IČO."
        action={
          <Btn iconLeft={<Icon name="plus" size={16} />} onClick={() => setEditing('new')}>
            Pridať dodávateľa
          </Btn>
        }
      />

      {!loaded && <SkeletonList n={3} />}
      {loaded && items.length === 0 && !editing && (
        <EmptyState
          icon={<Icon name="users" size={40} />}
          title="Zatiaľ žiadny dodávateľ"
          body="Pridajte prvého dodávateľa — energie, výťahový servis, plynár, advokát, …"
          action={{ label: 'Pridať dodávateľa', onClick: () => setEditing('new') }}
        />
      )}

      {items.length > 0 && (
        <Section title={`Zoznam (${items.length})`}>
          {items.map((s) => (
            <ListItem
              key={s.id}
              icon={categoryIcon(s.category)}
              title={s.name}
              subtitle={
                <>
                  {s.ico && <>IČO {s.ico}</>}
                  {s.iban && <> · {formatIban(s.iban)}</>}
                  {s.email && <> · {s.email}</>}
                  {s._count?.invoices != null && <> · {s._count.invoices} faktúr</>}
                </>
              }
              status={s.category ? <StatusPill>{s.category}</StatusPill> : undefined}
              onClick={() => setEditing(s)}
            />
          ))}
        </Section>
      )}

      {editing && (
        <SupplierEditor
          buildingId={buildingId}
          supplier={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      )}
    </>
  );
}

function SupplierEditor({
  buildingId, supplier, onClose, onSaved,
}: {
  buildingId: string;
  supplier: Supplier | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !supplier;
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    ico: supplier?.ico ?? '',
    dic: supplier?.dic ?? '',
    vatId: supplier?.vatId ?? '',
    iban: supplier?.iban ?? '',
    email: supplier?.email ?? '',
    phone: supplier?.phone ?? '',
    address: supplier?.address ?? '',
    category: supplier?.category ?? '',
    note: supplier?.note ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [icoApplied, setIcoApplied] = useState(false);

  function applyRegistry(r: RegistryResult) {
    setForm((f) => ({
      ...f,
      name: r.name ?? f.name,
      dic: r.dic ?? f.dic,
      vatId: r.vatId ?? f.vatId,
      address: r.address ?? f.address,
    }));
    setIcoApplied(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      // Trim a vypratam '' → undefined
      const payload: any = { buildingId };
      Object.entries(form).forEach(([k, v]) => {
        const t = (v ?? '').trim();
        payload[k] = t || (isNew ? undefined : null);
      });
      payload.name = form.name.trim(); // povinné

      if (isNew) {
        await api('/suppliers', { method: 'POST', body: JSON.stringify(payload) });
      } else {
        await api(`/suppliers/${supplier!.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      }
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!supplier) return;
    if (!confirm(`Naozaj vymazať dodávateľa „${supplier.name}"?`)) return;
    setBusy(true);
    try {
      await api(`/suppliers/${supplier.id}`, { method: 'DELETE' });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="modal-head">
          <h2>{isNew ? 'Nový dodávateľ' : `Upraviť: ${supplier!.name}`}</h2>
          <Btn variant="ghost" onClick={onClose} style={{ minHeight: 32, padding: '0 10px' }}>✕</Btn>
        </div>
        <Form
          title=""
          onSubmit={submit}
          error={err}
          actions={
            <>
              <Btn type="submit" busy={busy}>
                {busy ? 'Ukladám…' : isNew ? 'Vytvoriť' : 'Uložiť zmeny'}
              </Btn>
              <Btn variant="ghost" onClick={onClose}>Zrušiť</Btn>
              {!isNew && (
                <>
                  <span style={{ flex: 1 }} />
                  <Btn variant="danger" onClick={remove}>Vymazať</Btn>
                </>
              )}
            </>
          }
        >
          <Field label="Názov firmy" required hint="Pri písaní sa zobrazia návrhy z ORSR.sk">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="napr. Tatra banka, ZSE Energia, OTIS Slovakia"
              autoComplete="off"
            />
            <CompanyNameSearch
              query={form.name}
              country="SK"
              onPick={(r: NameSearchResult) => {
                setForm((f) => ({
                  ...f,
                  name: r.name ?? f.name,
                  ico: r.ico ?? f.ico,
                  dic: r.dic ?? f.dic,
                  vatId: r.vatId ?? f.vatId,
                  address: r.address ?? f.address,
                }));
                if (r.ico) setIcoApplied(true);
              }}
            />
          </Field>
          <Row>
            <Field label="Kategória" hint="Pomáha pri triedení faktúr">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">— vyberte —</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="IČO" hint="Po zadaní IČO sa údaje firmy automaticky doplnia z RPO / ARES">
              <input
                value={form.ico}
                onChange={(e) => { setForm({ ...form, ico: e.target.value }); setIcoApplied(false); }}
                placeholder="12345678"
                inputMode="numeric"
                maxLength={8}
              />
              <IcoLookupHint
                ico={form.ico}
                country="SK"
                onApply={applyRegistry}
                applied={icoApplied}
              />
            </Field>
          </Row>
          <Row>
            <Field label="DIČ">
              <input value={form.dic} onChange={(e) => setForm({ ...form, dic: e.target.value })} placeholder="2023456789" />
            </Field>
            <Field label="IČ DPH">
              <input value={form.vatId} onChange={(e) => setForm({ ...form, vatId: e.target.value })} placeholder="SK2023456789" />
            </Field>
          </Row>
          <Field label="IBAN" hint="Bankový účet pre úhrady">
            <input
              value={form.iban}
              onChange={(e) => setForm({ ...form, iban: e.target.value })}
              placeholder="SK00 0000 0000 0000 0000 0000"
              style={{ fontFamily: 'ui-monospace, monospace' }}
            />
          </Field>
          <Field label="Adresa">
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Mlynská 1, 811 06 Bratislava" />
          </Field>
          <Row>
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="info@dodavatel.sk" />
            </Field>
            <Field label="Telefón">
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+421 911 000 000" />
            </Field>
          </Row>
          <Field label="Poznámka" hint="Voliteľne">
            <textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </Form>
      </div>
    </div>
  );
}

function categoryIcon(cat: string | null): React.ReactNode {
  if (!cat) return <Icon name="users" size={20} />;
  const map: Record<string, React.ReactNode> = {
    'Energie': '⚡',
    'Plyn': '🔥',
    'Voda': '💧',
    'Teplo': '🌡️',
    'Elektrina': '⚡',
    'Výťah': '🛗',
    'Komín': '🏭',
    'Upratovanie': '🧹',
    'Údržba': '🔧',
    'Účtovníctvo': '📊',
    'Právne služby': '⚖️',
    'Banka': '🏦',
    'Poistenie': '🛡️',
  };
  return map[cat] ?? <Icon name="users" size={20} />;
}

function formatIban(iban: string): string {
  const clean = iban.replace(/\s+/g, '').toUpperCase();
  return clean.match(/.{1,4}/g)?.join(' ') ?? iban;
}
