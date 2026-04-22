/**
 * Resident sub-pages.
 *
 *   /moj-dom/hlasovania/:vid     VoteScreen (cast YES/NO/ABSTAIN)
 *   /moj-dom/poruchy/nova        ReportIssuePage
 *   /moj-dom/faktury/:iid        InvoiceDetailPage (s QR modal)
 *   /moj-dom/schodze             MeetingsResidentPage (RSVP)
 *   /moj-dom/burza               ClassifiedsResidentPage
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { AttentionCard, EmptyState, Greeting, ListItem, Section, StatusPill } from '../components/ui';
import { Field, Form, Row } from '../components/forms';
import { Btn } from '../components/Button';
import type { Me } from '../types';

/* =========================================================
   HLASOVAŤ
========================================================= */

export function VoteScreen({ me }: { me: Me }) {
  const { vid } = useParams<{ vid: string }>();
  const navigate = useNavigate();
  const [v, setV] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cast, setCast] = useState<'YES' | 'NO' | 'ABSTAIN' | null>(null);

  useEffect(() => {
    api<any>(`/voting/${vid}`).then(setV).catch((e) => setErr(e.message));
  }, [vid]);

  if (!v) return <p className="inline-meta">Načítavam…</p>;

  const ownerMembership = me.memberships.find((m) => m.role === 'OWNER' && m.apartment && m.building.id === v.buildingId);
  const apartmentId = ownerMembership?.apartment?.id;

  async function vote(choice: 'YES' | 'NO' | 'ABSTAIN') {
    if (!apartmentId) { setErr('Nie ste vlastník bytu v tejto budove.'); return; }
    if (!confirm(`Potvrdiť hlas: ${choice}? Môžete ho zmeniť do uzávierky.`)) return;
    setBusy(true); setErr(null);
    try {
      await api(`/voting/${vid}/cast`, {
        method: 'POST',
        body: JSON.stringify({
          apartmentId,
          choice,
          sessionFingerprint: `web:${navigator.userAgent.slice(0, 40)}:${vid}`,
        }),
      });
      setCast(choice);
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  const canVote = v.status === 'OPEN' && !!apartmentId;

  return (
    <>
      <Greeting firstName={v.title} subtitle={`Uzávierka ${new Date(v.closesAt).toLocaleString('sk-SK')}`} />

      <div style={{ padding: '1.25rem 1.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: '1.5rem' }}>
        <p style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '1.0625rem', lineHeight: 1.5 }}>{v.description}</p>
      </div>

      {cast && (
        <AttentionCard
          severity="ok"
          meta="Váš hlas"
          title={`Zaznamenané: ${cast === 'YES' ? 'ÁNO' : cast === 'NO' ? 'NIE' : 'Zdržal/a som sa'}`}
          body="Hlas môžete zmeniť kedykoľvek do uzávierky — zaznamenáva sa najnovší."
        />
      )}

      {canVote ? (
        <Section title="Ako hlasujete?">
          <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => vote('YES')}
              disabled={busy}
              style={btnYes}
            >
              ✓ ÁNO
            </button>
            <button
              onClick={() => vote('NO')}
              disabled={busy}
              style={btnNo}
            >
              ✕ NIE
            </button>
            <button
              onClick={() => vote('ABSTAIN')}
              disabled={busy}
              style={btnAbstain}
            >
              Zdržať sa
            </button>
          </div>
          <p className="inline-meta" style={{ marginTop: '0.75rem' }}>
            Váš hlas je právne záväzný. Listinný hlas má vždy prednosť pred elektronickým, ak by ste neskôr hlasoval/a aj papierovo.
          </p>
        </Section>
      ) : (
        <EmptyState
          icon="🗳️"
          title={v.status === 'OPEN' ? 'Nemôžete hlasovať' : 'Hlasovanie uzavreté'}
          body={v.status === 'OPEN' ? 'Musíte byť vlastník bytu v tejto budove.' : `Hlasovanie bolo uzavreté ${new Date(v.closesAt).toLocaleString('sk-SK')}.`}
        />
      )}

      {err && <p role="alert" style={{ color: 'var(--urgent)' }}>{err}</p>}
      <Link className="ui-btn ui-btn-ghost" to="/moj-dom/domov" style={{ marginTop: '1.5rem' }}>← Späť</Link>
    </>
  );
}

const btnBase: React.CSSProperties = {
  flex: '1 1 140px',
  minHeight: 60,
  fontSize: '1.125rem',
  fontWeight: 700,
  borderRadius: 10,
  border: '2px solid transparent',
  cursor: 'pointer',
};
const btnYes = { ...btnBase, background: 'var(--ok-600)', color: 'white' };
const btnNo = { ...btnBase, background: 'var(--urgent)', color: 'white' };
const btnAbstain = { ...btnBase, background: 'var(--surface-2)', color: 'var(--fg)', borderColor: 'var(--border-strong)' };

/* =========================================================
   NAHLÁSIŤ PORUCHU
========================================================= */

export function ReportIssuePage({ me }: { me: Me }) {
  const navigate = useNavigate();
  const ownerMembership = me.memberships.find((m) => m.role === 'OWNER' && m.apartment);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'>('NORMAL');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!ownerMembership) {
    return <EmptyState icon="🔒" title="Nie ste priradený k bytu" body="Len vlastník bytu môže nahlásiť poruchu." />;
  }

  const titleErr = title.length > 0 && title.trim().length < 4 ? 'Názov musí mať aspoň 4 znaky.' : null;
  const bodyErr = body.length > 0 && body.trim().length < 10 ? 'Popis musí mať aspoň 10 znakov, nech správca vie, čo sa stalo.' : null;
  const canSubmit = !!title && !!body && !titleErr && !bodyErr;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true); setErr(null);
    try {
      await api('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          buildingId: ownerMembership.building.id,
          apartmentId: ownerMembership.apartment?.id,
          title,
          description: body,
          priority,
        }),
      });
      setDone(true);
      setTimeout(() => navigate('/moj-dom/domov'), 1800);
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div style={{ maxWidth: 560, margin: '2rem auto', textAlign: 'center' }}>
        <div className="success-hero">
          <div className="success-icon">✓</div>
          <h3 style={{ margin: 0 }}>Porucha bola nahlásená</h3>
          <p style={{ color: 'var(--fg-muted)', marginTop: 8 }}>
            Správca dostane push notifikáciu a uvidí fotografickú históriu v svojom dashboarde.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Form
      title="Nahlásiť poruchu"
      description="Popíšte problém. Ak je kritická (výtok vody, nefunguje výťah, plyn), označte urgentnú prioritu — správca dostane push okamžite."
      onSubmit={submit}
      error={err}
      actions={
        <>
          <Btn busy={busy} disabled={!canSubmit} type="submit">
            {busy ? 'Posielam…' : 'Nahlásiť poruchu'}
          </Btn>
          <Link className="ui-btn ui-btn-ghost" to="/moj-dom/domov">Zrušiť</Link>
        </>
      }
    >
      <Field label="Krátky názov" required hint="Ako keby ste o tom hovorili susedovi v jednej vete" error={titleErr}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="napr. Nefunkčné svetlo v pivnici" />
      </Field>
      <Field label="Popis" required hint="Čo presne nefunguje, kde, od kedy." error={bodyErr}>
        <textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <Field label="Priorita" hint="Kritické = zasahuje bezpečnosť / viacerých vlastníkov naraz">
        <select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
          <option value="LOW">Nízka (môže počkať)</option>
          <option value="NORMAL">Bežná</option>
          <option value="HIGH">Vysoká (tento týždeň)</option>
          <option value="CRITICAL">KRITICKÁ (hneď)</option>
        </select>
      </Field>
    </Form>
  );
}

/* =========================================================
   FAKTÚRA detail + QR
========================================================= */

export function InvoiceDetailPage() {
  const { iid } = useParams<{ iid: string }>();
  const [qr, setQr] = useState<{ dataUrl: string; amount: string; iban: string; reference: string; currency: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<any>(`/finance/invoices/${iid}/qr`).then(setQr).catch((e) => setErr(e.message));
  }, [iid]);

  return (
    <>
      <Greeting firstName="Platba faktúry" subtitle="Naskenujte QR kód mobilnou bankou" />
      {err && <p role="alert" style={{ color: 'var(--urgent)' }}>{err}</p>}
      {!qr ? (
        <p className="inline-meta">Pripravujem QR kód…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1.5rem', alignItems: 'center', padding: '1.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
          <img src={qr.dataUrl} alt="SEPA QR kód" width={240} height={240} />
          <div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--fg-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Suma</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{Number(qr.amount).toFixed(2)} {qr.currency}</div>
            <div style={{ marginTop: 12, fontSize: '0.8125rem', color: 'var(--fg-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>IBAN</div>
            <div style={{ fontFamily: 'ui-monospace, monospace' }}>{qr.iban}</div>
            <div style={{ marginTop: 8, fontSize: '0.8125rem', color: 'var(--fg-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Variabilný symbol</div>
            <div style={{ fontFamily: 'ui-monospace, monospace' }}>{qr.reference}</div>
          </div>
        </div>
      )}
      <p className="inline-meta" style={{ marginTop: '1.5rem' }}>
        V mobilnej banke (Tatra banka, SLSP, VÚB, ČSOB, Fio…) vyberte „Naskenovať QR platbu" a namierte fotoaparátom sem.
        Všetky údaje sa predvyplnia automaticky.
      </p>
      <Link className="ui-btn ui-btn-ghost" to="/moj-dom/faktury" style={{ marginTop: '1rem' }}>← Späť na faktúry</Link>
    </>
  );
}

/* =========================================================
   SCHÔDZE (resident) + RSVP
========================================================= */

export function MeetingsResidentPage({ me }: { me: Me }) {
  const ownerMembership = me.memberships[0];
  const [items, setItems] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ownerMembership) return;
    api<any[]>(`/meetings/building/${ownerMembership.building.id}`).then(setItems).catch(() => {}).finally(() => setLoaded(true));
  }, [ownerMembership?.building.id]);

  async function rsvp(meetingId: string, choice: 'YES' | 'NO' | 'MAYBE') {
    try {
      await api(`/meetings/${meetingId}/rsvp`, { method: 'POST', body: JSON.stringify({ rsvp: choice }) });
      alert(choice === 'YES' ? 'Ďakujeme — vidíme sa.' : choice === 'NO' ? 'Poznamenané, nebudete na schôdzi.' : 'Označené ako „možno".');
    } catch (e) {
      alert('Nepodarilo sa uložiť: ' + (e as Error).message);
    }
  }

  return (
    <>
      <Greeting firstName="Schôdze" subtitle="Plánované schôdze vlastníkov" />
      {loaded && items.length === 0 && <EmptyState icon="📅" title="Žiadne schôdze" body="Predseda ešte neoznámil termín." />}
      {items.map((m) => {
        const future = new Date(m.scheduledAt) > new Date();
        return (
          <AttentionCard
            key={m.id}
            severity={future ? 'info' : 'ok'}
            meta={future ? 'Naplánovaná' : 'Uskutočnená'}
            icon="📅"
            title={m.title}
            body={
              <>
                {new Date(m.scheduledAt).toLocaleString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                {m.location && ` · ${m.location}`}
              </>
            }
            primaryAction={future ? { label: 'Prídem', onClick: () => rsvp(m.id, 'YES') } : undefined}
            secondaryAction={future ? { label: 'Neprídem', onClick: () => rsvp(m.id, 'NO') } : undefined}
          />
        );
      })}
    </>
  );
}

/* =========================================================
   BURZA (resident + chairman zdieľajú, pridáva vlastník aj admin)
========================================================= */

export function ClassifiedsResidentPage({ me }: { me: Me }) {
  const bId = me.memberships[0]?.building.id;
  const [items, setItems] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'FOR_SALE', title: '', body: '', priceEur: '', contactPhone: '', contactApartment: '' });

  async function load() {
    if (!bId) return;
    const r = await api<any[]>(`/classifieds/building/${bId}`).catch(() => []);
    setItems(r);
  }
  useEffect(() => { load(); }, [bId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api('/classifieds', { method: 'POST', body: JSON.stringify({ buildingId: bId, ...form, priceEur: form.priceEur || undefined }) });
    setShowForm(false);
    setForm({ ...form, title: '', body: '', priceEur: '' });
    await load();
  }

  return (
    <>
      <Greeting firstName="Burza susedov" subtitle="Predám, hľadám, balík suseda" />
      <div style={{ marginBottom: '1rem' }}>
        <button className="ui-btn ui-btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Zavrieť' : '+ Pridať inzerát'}
        </button>
      </div>
      {showForm && (
        <Form
          title=""
          onSubmit={submit}
          actions={<button className="ui-btn ui-btn-primary" type="submit">Zverejniť</button>}
        >
          <Row>
            <Field label="Druh">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="FOR_SALE">Predám</option>
                <option value="WANTED">Hľadám</option>
                <option value="GIVEAWAY">Zadarmo</option>
                <option value="LOST_AND_FOUND">Straty a nálezy</option>
                <option value="PACKAGE">Mám balík suseda</option>
              </select>
            </Field>
            <Field label="Cena (€)">
              <input type="number" min={0} value={form.priceEur} onChange={(e) => setForm({ ...form, priceEur: e.target.value })} />
            </Field>
          </Row>
          <Field label="Názov">
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Popis">
            <textarea required rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </Field>
          <Row>
            <Field label="Telefón">
              <input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            </Field>
            <Field label="Byt">
              <input value={form.contactApartment} onChange={(e) => setForm({ ...form, contactApartment: e.target.value })} placeholder="byt 07" />
            </Field>
          </Row>
        </Form>
      )}
      {items.length === 0 && <EmptyState icon="🏘️" title="Zatiaľ nič" body="Buďte prvý a pridajte inzerát." />}
      {items.map((c) => (
        <ListItem
          key={c.id}
          icon={typeIcon(c.type)}
          title={c.title}
          subtitle={`${c.body.slice(0, 100)}${c.body.length > 100 ? '…' : ''}`}
          status={c.priceEur ? <StatusPill>{Number(c.priceEur).toFixed(2)} €</StatusPill> : undefined}
          trailing={c.contactApartment ? <span className="inline-meta">{c.contactApartment}</span> : undefined}
        />
      ))}
    </>
  );
}

function typeIcon(t: string) {
  return { FOR_SALE: '💰', WANTED: '🔍', GIVEAWAY: '🎁', LOST_AND_FOUND: '❓', PACKAGE: '📦' }[t] ?? '🏘️';
}
