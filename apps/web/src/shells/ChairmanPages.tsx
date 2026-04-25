/**
 * Chairman sub-pages — create forms + detail obrazovky.
 *
 * Každá obrazovka je samostatná route v ChairmanShell.
 * Cieľ: „to čo landing sľubuje, to v appke funguje".
 *
 *   /b/:id/hlasovania/nove        NewVotingPage
 *   /b/:id/hlasovania/:vid        VotingDetailPage (close + listinný hlas)
 *   /b/:id/oznamy/nova            NewAnnouncementPage
 *   /b/:id/schodze/nova           NewMeetingPage
 *   /b/:id/schodze/:mid           MeetingDetailPage (upload minutes)
 *   /b/:id/revizie/nova           NewRevisionPage
 *   /b/:id/poruchy/:tid           TicketDetailPage
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, apiUpload } from '../api';
import { AttentionCard, EmptyState, Greeting, ListItem, Section, StatusPill } from '../components/ui';
import { Field, Form, Row } from '../components/forms';
import { PageHeader } from '../components/PageHeader';
import { Btn } from '../components/Button';
import { SkeletonList } from '../components/Skeleton';
import { Icon } from '../components/Icons';

/* =========================================================
   HLASOVANIA
========================================================= */

/**
 * Voting type → odporúčané kvórum (predvyplnené).
 * Predseda môže pretiahnuť slider podľa potreby.
 *
 * Slovenský kontext (§14 zákona č. 182/1993):
 *  - SIMPLE_MAJORITY (bežné rozhodnutia): nadpolovičná = 0.5001 (50 % + jeden hlas)
 *  - QUALIFIED_MAJORITY (zmluvy, opravy, fond): dvojtretinová = 0.6667
 *  - UNANIMOUS (zmena vlastníckych pomerov): 100 % = 1.0
 */
const TYPE_PRESETS = {
  SIMPLE_MAJORITY: { quorum: '0.5001', label: 'Nadpolovičná', sub: '§14 ods. 1 — bežné rozhodnutia' },
  QUALIFIED_MAJORITY: { quorum: '0.6667', label: 'Kvalifikovaná (2/3)', sub: '§14 ods. 3 — zmluvy, opravy, fond' },
  UNANIMOUS: { quorum: '1.0000', label: 'Jednohlasne (100 %)', sub: '§14 ods. 4 — zmena podielov' },
} as const;

export function NewVotingPage() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<keyof typeof TYPE_PRESETS>('SIMPLE_MAJORITY');
  const [opensAt, setOpensAt] = useState(todayPlus(0));
  const [closesAt, setClosesAt] = useState(todayPlus(7));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const v = await api<any>('/voting', {
        method: 'POST',
        body: JSON.stringify({
          buildingId,
          title: title.trim(),
          description: description.trim(),
          type,
          opensAt: new Date(opensAt).toISOString(),
          closesAt: new Date(closesAt).toISOString(),
          quorumRequired: TYPE_PRESETS[type].quorum,
        }),
      });
      await api(`/voting/${v.id}/open`, { method: 'POST' }).catch(() => {});
      navigate(`/b/${buildingId}/hlasovania/${v.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Budova', to: `/b/${buildingId}` },
          { label: 'Hlasovania', to: `/b/${buildingId}/hlasovania` },
          { label: 'Nové' },
        ]}
        title="Nové hlasovanie"
        subtitle="Hlasovanie sa po vytvorení automaticky otvorí. Vlastníci dostanú oznam."
      />
      <Form
        title=""
        onSubmit={submit}
        error={err}
        actions={
          <>
            <Btn type="submit" busy={busy}>
              {busy ? 'Ukladám…' : 'Vytvoriť a otvoriť hlasovanie'}
            </Btn>
            <Btn variant="ghost" onClick={() => navigate(`/b/${buildingId}/hlasovania`)}>
              Zrušiť
            </Btn>
          </>
        }
      >
        <Field label="Názov hlasovania" required>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="napr. Rekonštrukcia strechy 2026" />
        </Field>
        <Field label="Popis návrhu" required hint="Uveďte presne, o čom sa hlasuje. Vlastníci to uvidia pri hlasovaní.">
          <textarea required rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Typ väčšiny" required hint={TYPE_PRESETS[type].sub}>
          <select value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="SIMPLE_MAJORITY">Nadpolovičná väčšina (50 % + 1) — bežné rozhodnutia</option>
            <option value="QUALIFIED_MAJORITY">Kvalifikovaná väčšina (2/3) — zmluvy, opravy</option>
            <option value="UNANIMOUS">Jednohlasne (100 %) — zmena vlastníckych pomerov</option>
          </select>
        </Field>
        <div className="dp-quorum-info">
          <div>Potrebné kvórum (z celkových podielov):</div>
          <strong>{(parseFloat(TYPE_PRESETS[type].quorum) * 100).toFixed(2).replace('.00', '')} %</strong>
        </div>
        <Row>
          <Field label="Otvárame" required>
            <input type="datetime-local" required value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
          </Field>
          <Field label="Uzávierka" required hint="Odporúčame minimálne 7 dní, aby aj vlastníci na dovolenke stihli hlasovať.">
            <input type="datetime-local" required value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          </Field>
        </Row>
      </Form>
    </>
  );
}

export function VotingDetailPage() {
  const { buildingId, vid } = useParams<{ buildingId: string; vid: string }>();
  const [v, setV] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [paperApt, setPaperApt] = useState('');
  const [paperChoice, setPaperChoice] = useState<'YES' | 'NO' | 'ABSTAIN'>('YES');
  const [paperRef, setPaperRef] = useState('');
  const [proxyFrom, setProxyFrom] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  async function load() {
    try {
      const voting = await api<any>(`/voting/${vid}`);
      setV(voting);
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  useEffect(() => { load(); }, [vid]);

  async function closeVoting() {
    if (!confirm('Uzavrieť hlasovanie? Vygeneruje sa PDF zápisnica s XAdES-BES podpisom. Túto akciu nemožno vrátiť.')) return;
    setBusy(true); setErr(null);
    try {
      await api(`/voting/${vid}/close`, { method: 'POST' });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  async function downloadMinutes() {
    setPdfBusy(true);
    try {
      const r = await api<{ url: string | null; error?: string }>(`/voting/${vid}/minutes-url`);
      if (r.error || !r.url) {
        alert(r.error ?? 'PDF zápisnica nie je dostupná.');
      } else {
        window.open(r.url, '_blank');
      }
    } catch (e) {
      alert('Stiahnutie zlyhalo: ' + (e as Error).message);
    } finally {
      setPdfBusy(false);
    }
  }

  async function addPaper(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api(`/voting/${vid}/paper`, {
        method: 'POST',
        body: JSON.stringify({
          apartmentId: paperApt,
          choice: paperChoice,
          paperBallotReference: paperRef || `paper-${Date.now()}`,
          proxyFromApartmentId: proxyFrom || undefined,
        }),
      });
      setPaperApt(''); setPaperRef(''); setProxyFrom('');
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  if (!v) {
    return (
      <>
        <PageHeader
          breadcrumb={[{ label: 'Budova', to: `/b/${buildingId}` }, { label: 'Hlasovania', to: `/b/${buildingId}/hlasovania` }, { label: 'Detail' }]}
          title="Načítavam…"
        />
        <SkeletonList n={3} />
      </>
    );
  }

  const apartments: any[] = v.building?.apartments ?? [];
  const records: any[] = v.records ?? [];
  const notVoted: any[] = v.notVotedApartments ?? [];
  const tally = v.result ?? v.liveTally;
  const typeLabel = TYPE_PRESETS[v.type as keyof typeof TYPE_PRESETS]?.label ?? v.type;
  const statusBadge = v.status === 'OPEN'
    ? <StatusPill tone="info" dot>Prebieha</StatusPill>
    : v.status === 'CLOSED'
      ? (v.result?.accepted ? <StatusPill tone="ok">Prijaté</StatusPill> : <StatusPill tone="urgent">Zamietnuté</StatusPill>)
      : <StatusPill>{v.status}</StatusPill>;

  // Dáta pre progress bary
  const totalShares = tally ? Number(tally.totalShares ?? 0) : 0;
  const buildingShares = apartments.reduce((s, a) => s + Number(a.ownershipShare ?? 0), 0);
  const yes = tally ? Number(tally.yesShares ?? 0) : 0;
  const no = tally ? Number(tally.noShares ?? 0) : 0;
  const abstain = tally ? Number(tally.abstainShares ?? 0) : 0;
  const pct = (n: number) => buildingShares > 0 ? (n / buildingShares) * 100 : 0;
  const quorumPct = parseFloat(v.quorumRequired) * 100;
  const participationPct = pct(totalShares);

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Budova', to: `/b/${buildingId}` },
          { label: 'Hlasovania', to: `/b/${buildingId}/hlasovania` },
          { label: v.title },
        ]}
        title={v.title}
        subtitle={`${typeLabel} · uzávierka ${new Date(v.closesAt).toLocaleString('sk-SK')}`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            {statusBadge}
            {v.status === 'OPEN' && (
              <Btn busy={busy} onClick={closeVoting}>
                Uzavrieť hlasovanie
              </Btn>
            )}
            {v.status === 'CLOSED' && v.result?.pdfStorageKey && (
              <Btn busy={pdfBusy} onClick={downloadMinutes} iconLeft={<Icon name="download" size={16} />}>
                Stiahnuť PDF zápisnicu
              </Btn>
            )}
          </div>
        }
      />

      {/* Návrh */}
      <Section title="Návrh">
        <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.55 }}>{v.description}</p>
      </Section>

      {/* Live tally — progress bary */}
      {tally && (
        <Section
          title={v.status === 'OPEN' ? 'Priebežné výsledky (live)' : 'Konečné výsledky'}
          extra={v.result?.accepted != null ? (
            v.result.accepted
              ? <StatusPill tone="ok">Návrh prijatý ✓</StatusPill>
              : <StatusPill tone="urgent">Návrh zamietnutý ✕</StatusPill>
          ) : undefined}
        >
          <div className="vote-bars">
            <VoteBar label="✓ Áno" shares={yes} totalBuildingShares={buildingShares} tone="yes" />
            <VoteBar label="✕ Nie" shares={no} totalBuildingShares={buildingShares} tone="no" />
            <VoteBar label="Zdržal sa" shares={abstain} totalBuildingShares={buildingShares} tone="abstain" />
          </div>

          <div className="vote-quorum">
            <div className="vote-quorum-label">
              <span>
                <strong>Účasť (kvórum):</strong> {participationPct.toFixed(1)} % z potrebných {quorumPct.toFixed(1)} %
              </span>
              <StatusPill tone={participationPct >= quorumPct ? 'ok' : 'pending'}>
                {participationPct >= quorumPct ? 'Kvórum dosiahnuté' : 'Kvórum nedosiahnuté'}
              </StatusPill>
            </div>
            <div className="vote-quorum-track">
              <div className="vote-quorum-fill" style={{ width: `${Math.min(participationPct, 100)}%` }} />
              <div className="vote-quorum-marker" style={{ left: `${quorumPct}%` }} title={`Hranica kvóra ${quorumPct.toFixed(1)}%`} />
            </div>
          </div>

          <div className="vote-stats-row">
            <div className="vote-stat"><div className="vote-stat-num">{records.length}</div><div className="vote-stat-lbl">hlasov spolu</div></div>
            <div className="vote-stat"><div className="vote-stat-num">{apartments.length - notVoted.length}</div><div className="vote-stat-lbl">z {apartments.length} bytov</div></div>
            <div className="vote-stat"><div className="vote-stat-num">{records.filter((r) => r.channel === 'PAPER').length}</div><div className="vote-stat-lbl">listinných</div></div>
            <div className="vote-stat"><div className="vote-stat-num">{records.filter((r) => r.channel === 'ELECTRONIC').length}</div><div className="vote-stat-lbl">elektronických</div></div>
          </div>
        </Section>
      )}

      {/* Listinný hlas — len ak je hlasovanie otvorené */}
      {v.status === 'OPEN' && (
        <Section title="Zapísať listinný hlas">
          <p className="inline-meta" style={{ marginBottom: 12 }}>
            Listinný hlas má <strong>prednosť pred elektronickým</strong> — ak vlastník hlasoval oboma spôsobmi, počíta sa papier.
            Vyplňte ak vám vlastník odovzdal vyplnený hlasovací lístok.
          </p>
          <Form
            title=""
            onSubmit={addPaper}
            error={err}
            actions={
              <Btn type="submit" busy={busy} disabled={!paperApt}>
                Zapísať listinný hlas
              </Btn>
            }
          >
            <Row>
              <Field label="Byt" required>
                <select required value={paperApt} onChange={(e) => setPaperApt(e.target.value)}>
                  <option value="">— vyberte byt —</option>
                  {apartments.map((a: any) => (
                    <option key={a.id} value={a.id}>Byt {a.unitNumber}</option>
                  ))}
                </select>
              </Field>
              <Field label="Voľba" required>
                <select value={paperChoice} onChange={(e) => setPaperChoice(e.target.value as any)}>
                  <option value="YES">✓ Áno</option>
                  <option value="NO">✕ Nie</option>
                  <option value="ABSTAIN">Zdržať sa</option>
                </select>
              </Field>
            </Row>
            <Row>
              <Field label="Referencia hárku" hint="napr. 2026-03-S-045">
                <input value={paperRef} onChange={(e) => setPaperRef(e.target.value)} placeholder={`paper-${new Date().toISOString().slice(0, 10)}`} />
              </Field>
              <Field label="Splnomocnenie od bytu (voliteľné)" hint="Hlasujúci je splnomocnený zastúpiť iný byt">
                <select value={proxyFrom} onChange={(e) => setProxyFrom(e.target.value)}>
                  <option value="">— bez splnomocnenia —</option>
                  {apartments.map((a: any) => (
                    <option key={a.id} value={a.id}>Byt {a.unitNumber}</option>
                  ))}
                </select>
              </Field>
            </Row>
          </Form>
        </Section>
      )}

      {/* Zoznam hlasov s číslami bytov */}
      <Section title={`Zaznamenané hlasy (${records.length})`}>
        {records.length === 0 && (
          <EmptyState
            icon={<Icon name="vote" size={40} />}
            title="Zatiaľ žiadne hlasy"
            body="Vlastníci budú môcť hlasovať z mobilu hneď, ako sa prihlásia."
          />
        )}
        {records.map((r: any) => (
          <ListItem
            key={r.id}
            icon={r.channel === 'PAPER' ? '📄' : '📱'}
            title={`Byt ${r.apartment?.unitNumber ?? r.apartmentId.slice(0, 8)}${r.proxyFromApartmentId ? ' (so splnomocnením)' : ''}`}
            subtitle={`${r.channel === 'PAPER' ? 'Listinný hlas' : 'Elektronický hlas'} · ${new Date(r.castAt).toLocaleString('sk-SK')}${r.paperBallotReference ? ` · ref. ${r.paperBallotReference}` : ''}`}
            status={
              <StatusPill tone={r.choice === 'YES' ? 'ok' : r.choice === 'NO' ? 'urgent' : 'neutral'}>
                {r.choice === 'YES' ? '✓ Áno' : r.choice === 'NO' ? '✕ Nie' : 'Zdržal sa'}
              </StatusPill>
            }
          />
        ))}
      </Section>

      {/* Kto ešte nehlasoval — len pre OPEN */}
      {v.status === 'OPEN' && notVoted.length > 0 && (
        <Section title={`Ešte nehlasovali (${notVoted.length})`}>
          <p className="inline-meta" style={{ marginBottom: 8 }}>
            Tieto byty zatiaľ nezaznamenali hlas. Môžete im poslať pripomienku.
          </p>
          <div className="vote-pending-grid">
            {notVoted.map((a: any) => (
              <span key={a.id} className="vote-pending-pill">Byt {a.unitNumber}</span>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

/**
 * Progress bar pre jeden typ hlasu.
 * Šírka výplne = % z celkových podielov budovy.
 */
function VoteBar({
  label, shares, totalBuildingShares, tone,
}: { label: string; shares: number; totalBuildingShares: number; tone: 'yes' | 'no' | 'abstain' }) {
  const pct = totalBuildingShares > 0 ? (shares / totalBuildingShares) * 100 : 0;
  return (
    <div className="vote-bar">
      <div className="vote-bar-label">
        <span>{label}</span>
        <span className="vote-bar-num">
          {shares.toFixed(2)} podielov · <strong>{pct.toFixed(1)} %</strong>
        </span>
      </div>
      <div className="vote-bar-track">
        <div className={`vote-bar-fill vote-bar-${tone}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

/* =========================================================
   OZNAMY
========================================================= */

export function NewAnnouncementPage() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<'INFO' | 'WARNING' | 'URGENT'>('INFO');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api('/announcements', {
        method: 'POST',
        body: JSON.stringify({ buildingId, title, body, severity }),
      });
      navigate(`/b/${buildingId}/oznamy`);
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <Form
      title="Nový oznam na nástenke"
      description="Každý vlastník dostane notifikáciu a bude musieť potvrdiť prečítanie."
      onSubmit={submit}
      error={err}
      actions={
        <>
          <button className="ui-btn ui-btn-primary" type="submit" disabled={busy}>
            {busy ? 'Publikujem…' : 'Publikovať oznam'}
          </button>
          <Link className="ui-btn ui-btn-ghost" to={`/b/${buildingId}/oznamy`}>Zrušiť</Link>
        </>
      }
    >
      <Field label="Titulok">
        <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="napr. Odstávka vody v stredu" />
      </Field>
      <Field label="Text oznamu">
        <textarea required rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Popis, dátum, kontakt…" />
      </Field>
      <Field label="Závažnosť">
        <select value={severity} onChange={(e) => setSeverity(e.target.value as any)}>
          <option value="INFO">Informácia</option>
          <option value="WARNING">Upozornenie</option>
          <option value="URGENT">Urgentné</option>
        </select>
      </Field>
    </Form>
  );
}

/* =========================================================
   SCHÔDZE
========================================================= */

export function NewMeetingPage() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('1) Otvorenie\n2) \n3) \n4) Rôzne');
  const [location, setLocation] = useState('');
  const [scheduledAt, setScheduledAt] = useState(todayPlus(14));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const m = await api<any>('/meetings', {
        method: 'POST',
        body: JSON.stringify({
          buildingId,
          title,
          agenda,
          location: location || undefined,
          scheduledAt: new Date(scheduledAt).toISOString(),
        }),
      });
      navigate(`/b/${buildingId}/schodze/${m.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <Form
      title="Nová schôdza vlastníkov"
      description="Vlastníci dostanú notifikáciu a môžu RSVP. Pred schôdzou pošlete pripomienku."
      onSubmit={submit}
      error={err}
      actions={
        <>
          <button className="ui-btn ui-btn-primary" type="submit" disabled={busy}>
            {busy ? 'Vytváram…' : 'Vytvoriť schôdzu'}
          </button>
          <Link className="ui-btn ui-btn-ghost" to={`/b/${buildingId}/schodze`}>Zrušiť</Link>
        </>
      }
    >
      <Field label="Názov">
        <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="napr. Výročné zhromaždenie vlastníkov 2026" />
      </Field>
      <Row>
        <Field label="Termín">
          <input type="datetime-local" required value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        </Field>
        <Field label="Miesto" hint="napr. Spoločenská miestnosť, prízemie">
          <input value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
      </Row>
      <Field label="Program schôdze" hint="Každý bod na samostatný riadok, očíslovaný.">
        <textarea required rows={8} value={agenda} onChange={(e) => setAgenda(e.target.value)} />
      </Field>
    </Form>
  );
}

export function MeetingDetailPage() {
  const { buildingId, mid } = useParams<{ buildingId: string; mid: string }>();
  const [m, setM] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [minutesText, setMinutesText] = useState('');

  async function load() {
    try { setM(await api<any>(`/meetings/${mid}`)); } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { load(); }, [mid]);

  async function uploadMinutes(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      await apiUpload(`/meetings/${mid}/minutes`, file);
      await load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function markCompleted() {
    setBusy(true);
    try {
      await api(`/meetings/${mid}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'COMPLETED', minutes: minutesText || undefined }) });
      await load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  if (!m) return <p className="inline-meta">Načítavam…</p>;

  const rsvp = { YES: 0, NO: 0, MAYBE: 0 } as Record<string, number>;
  (m.attendance ?? []).forEach((a: any) => { if (a.rsvp) rsvp[a.rsvp] = (rsvp[a.rsvp] ?? 0) + 1; });

  return (
    <>
      <Greeting firstName={m.title} subtitle={new Date(m.scheduledAt).toLocaleString('sk-SK', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} />
      <AttentionCard
        severity="info"
        meta="Stav schôdze"
        title={m.status === 'COMPLETED' ? 'Uskutočnená' : m.status === 'CANCELLED' ? 'Zrušená' : 'Naplánovaná'}
        body={m.location ? `Miesto: ${m.location}` : undefined}
        footer={`RSVP: ${rsvp.YES} prídu · ${rsvp.NO} nie · ${rsvp.MAYBE} možno`}
      />

      <Section title="Program">
        <div style={{ whiteSpace: 'pre-wrap', padding: '1rem 1.25rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
          {m.agenda}
        </div>
      </Section>

      {m.status !== 'COMPLETED' && (
        <Section title="Po skončení schôdze">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Field label="Zápisnica (voľný text)">
              <textarea rows={4} value={minutesText} onChange={(e) => setMinutesText(e.target.value)} placeholder="Krátky sumár, hlavné rozhodnutia…" />
            </Field>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <label className="ui-btn ui-btn-ghost">
                📄 Nahrať PDF zápisnicu
                <input type="file" accept=".pdf" onChange={uploadMinutes} style={{ display: 'none' }} />
              </label>
              <button className="ui-btn ui-btn-primary" onClick={markCompleted} disabled={busy}>
                Označiť ako uskutočnenú
              </button>
            </div>
            {err && <p role="alert" style={{ color: 'var(--urgent)' }}>{err}</p>}
          </div>
        </Section>
      )}

      {m.minutesPdfKey && (
        <Section title="Zápisnica">
          <button className="ui-btn ui-btn-ghost" onClick={async () => {
            const { url } = await api<{ url: string }>(`/meetings/${mid}/minutes/download`);
            window.open(url, '_blank');
          }}>📥 Stiahnuť PDF</button>
        </Section>
      )}

      <Link className="ui-btn ui-btn-ghost" to={`/b/${buildingId}/schodze`}>← Späť na zoznam</Link>
    </>
  );
}

/* =========================================================
   REVÍZIE
========================================================= */

export function NewRevisionPage() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    type: 'ELEVATOR' as const,
    title: '',
    dueDate: todayPlus(180).slice(0, 10),
    intervalMonths: '12',
    contractorName: '',
    contractorPhone: '',
    contractorEmail: '',
    notes: '',
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api('/revisions', {
        method: 'POST',
        body: JSON.stringify({
          buildingId,
          type: form.type,
          title: form.title,
          dueDate: new Date(form.dueDate).toISOString(),
          intervalMonths: form.intervalMonths ? Number(form.intervalMonths) : undefined,
          contractorName: form.contractorName || undefined,
          contractorPhone: form.contractorPhone || undefined,
          contractorEmail: form.contractorEmail || undefined,
          notes: form.notes || undefined,
        }),
      });
      navigate(`/b/${buildingId}/revizie`);
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <Form
      title="Nová revízia"
      description="Zákonne povinná kontrola. 30 dní pred termínom dostanete pripomienku."
      onSubmit={submit}
      error={err}
      actions={
        <>
          <button className="ui-btn ui-btn-primary" type="submit" disabled={busy}>
            {busy ? 'Ukladám…' : 'Naplánovať revíziu'}
          </button>
          <Link className="ui-btn ui-btn-ghost" to={`/b/${buildingId}/revizie`}>Zrušiť</Link>
        </>
      }
    >
      <Row>
        <Field label="Typ">
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
            <option value="BOILER">Kotol</option>
            <option value="ELEVATOR">Výťah</option>
            <option value="CHIMNEY">Kominárske</option>
            <option value="ELECTRICAL">Elektroinštalácia</option>
            <option value="FIRE_SAFETY">Požiarna</option>
            <option value="GAS">Plynovod</option>
            <option value="LIGHTNING_ROD">Bleskozvod</option>
            <option value="PLAYGROUND">Detské ihrisko</option>
            <option value="OTHER">Iné</option>
          </select>
        </Field>
        <Field label="Interval (mesiace)" hint="Automatické naplánovanie ďalšej.">
          <input type="number" min={1} value={form.intervalMonths} onChange={(e) => setForm({ ...form, intervalMonths: e.target.value })} />
        </Field>
      </Row>
      <Field label="Názov">
        <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="napr. Úradná skúška výťahu" />
      </Field>
      <Field label="Termín">
        <input type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
      </Field>
      <Row>
        <Field label="Dodávateľ (firma)">
          <input value={form.contractorName} onChange={(e) => setForm({ ...form, contractorName: e.target.value })} placeholder="napr. Schindler SK" />
        </Field>
        <Field label="Telefón dodávateľa">
          <input value={form.contractorPhone} onChange={(e) => setForm({ ...form, contractorPhone: e.target.value })} placeholder="+421 …" />
        </Field>
      </Row>
      <Field label="Email dodávateľa">
        <input type="email" value={form.contractorEmail} onChange={(e) => setForm({ ...form, contractorEmail: e.target.value })} />
      </Field>
      <Field label="Poznámky">
        <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </Form>
  );
}

/* =========================================================
   TICKET DETAIL
========================================================= */

export function TicketDetailPage() {
  const { buildingId, tid } = useParams<{ buildingId: string; tid: string }>();
  const [t, setT] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');

  async function load() {
    try { setT(await api<any>(`/tickets/${tid}`)); } catch (e) { setErr((e as Error).message); }
  }
  useEffect(() => { load(); }, [tid]);

  async function setStatus(status: string) {
    setBusy(true);
    try {
      await api(`/tickets/${tid}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await api(`/tickets/${tid}/comments`, { method: 'POST', body: JSON.stringify({ body: comment }) });
      setComment('');
      await load();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  if (!t) return <p className="inline-meta">Načítavam…</p>;

  return (
    <>
      <Greeting firstName={t.title} subtitle={`Byt ${t.apartment?.unitNumber ?? '—'} · priorita ${t.priority}`} />
      <AttentionCard
        severity={t.status === 'RESOLVED' || t.status === 'CLOSED' ? 'ok' : t.priority === 'CRITICAL' ? 'urgent' : 'pending'}
        meta="Stav poruchy"
        title={statusLabel(t.status)}
        body={t.description}
        footer={`Nahlásené ${new Date(t.createdAt).toLocaleString('sk-SK')}`}
      />
      <Section title="Zmena stavu">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'].map((s) => (
            <button
              key={s}
              className={`ui-btn ${t.status === s ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
              onClick={() => setStatus(s)}
              disabled={busy || t.status === s}
            >
              {statusLabel(s)}
            </button>
          ))}
        </div>
      </Section>

      <Section title={`Komentáre (${t.comments?.length ?? 0})`}>
        {(t.comments ?? []).map((c: any) => (
          <div key={c.id} className="card" style={{ padding: '0.875rem 1rem', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, background: 'var(--surface)' }}>
            <div style={{ color: 'var(--fg-subtle)', fontSize: 12 }}>{new Date(c.createdAt).toLocaleString('sk-SK')}</div>
            <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{c.body}</div>
          </div>
        ))}
        <form onSubmit={sendComment} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Napíšte komentár / update stavu opravy"
            style={{ flex: 1 }}
          />
          <button className="ui-btn ui-btn-primary" type="submit" disabled={busy || !comment.trim()}>Odoslať</button>
        </form>
      </Section>

      {err && <p role="alert" style={{ color: 'var(--urgent)' }}>{err}</p>}
      <Link className="ui-btn ui-btn-ghost" to={`/b/${buildingId}/poruchy`}>← Späť</Link>
    </>
  );
}

function statusLabel(s: string) {
  return ({ OPEN: 'Otvorený', IN_PROGRESS: 'V riešení', WAITING: 'Čaká', RESOLVED: 'Vyriešený', CLOSED: 'Uzavretý' } as any)[s] ?? s;
}

function todayPlus(days: number) {
  const d = new Date(Date.now() + days * 86400000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}
