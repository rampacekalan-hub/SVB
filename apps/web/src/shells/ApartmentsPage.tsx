/**
 * Evidencia bytov — /b/:buildingId/byty
 *
 * Plnohodnotná správa bytov pre predsedu / správcu:
 *   - Tabuľka so všetkými bytmi (číslo, poschodie, plocha, podiel, % budovy, registrovaný vlastník)
 *   - Pridanie bytu cez formulár
 *   - Úprava bytu (inline modal)
 *   - Regenerovanie aktivačného kódu
 *   - Vymazanie (iba ak byt nemá históriu)
 *   - Export do PDF zoznamu kódov
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { EmptyState, KPITile, Section, StatusPill } from '../components/ui';
import { Field, Form, Row } from '../components/forms';
import { PageHeader } from '../components/PageHeader';
import { SkeletonList, SkeletonKPIs } from '../components/Skeleton';
import { Btn } from '../components/Button';
import { BuildingIllustration } from '../components/Illustrations';

interface Apartment {
  id: string;
  unitNumber: string;
  floor: number | null;
  area: string;
  ownershipShare: string;
  sharePercent: number;
  registeredOwners: Array<{
    membershipId: string;
    user: { id: string; email: string; firstName: string; lastName: string; lastLoginAt: string | null; totpEnabled: boolean } | null;
    verifiedAt: string | null;
  }>;
  pendingActivation: { membershipId: string; code: string } | null;
  createdAt: string;
}

export function ApartmentsPage() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const [items, setItems] = useState<Apartment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<Apartment | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    if (!buildingId) return;
    try {
      const r = await api<Apartment[]>(`/apartments/by-building/${buildingId}`);
      setItems(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { load(); }, [buildingId]);

  const totalShare = items.reduce((s, a) => s + Number(a.ownershipShare), 0);
  const totalArea = items.reduce((s, a) => s + Number(a.area), 0);
  const registered = items.filter((a) => a.registeredOwners.length > 0).length;
  const pending = items.filter((a) => a.pendingActivation).length;

  async function regenerateCode(apt: Apartment) {
    if (!confirm(`Vygenerovať nový aktivačný kód pre byt ${apt.unitNumber}?\nStarý kód prestane platiť.`)) return;
    try {
      const r = await api<{ activationCode: string }>(`/apartments/${apt.id}/regenerate-code`, { method: 'POST' });
      alert(`Nový kód pre byt ${apt.unitNumber}: ${r.activationCode}\n\nOdovzdajte ho vlastníkovi.`);
      await load();
    } catch (e) {
      alert('Chyba: ' + (e as Error).message);
    }
  }

  async function removeApartment(apt: Apartment) {
    if (!confirm(`Naozaj vymazať byt ${apt.unitNumber}? Vymaže sa len ak nemá žiadne faktúry, hlasy ani tikety.`)) return;
    try {
      await api(`/apartments/${apt.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      alert('Chyba: ' + (e as Error).message);
    }
  }

  async function removeOwner(apt: Apartment, membershipId: string) {
    if (!confirm(`Odobrať vlastníka z bytu ${apt.unitNumber}? Vlastník stratí prístup do appky, ale jeho účet ostane (môže mať iné byty).`)) return;
    try {
      await api(`/apartments/memberships/${membershipId}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      alert('Chyba: ' + (e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Budova', to: `/b/${buildingId}` }, { label: 'Byty' }]}
        title="Evidencia bytov"
        subtitle="Zoznam bytov, ich vlastníkov a stav registrácie do appky."
        action={<Btn iconLeft={<span aria-hidden="true">+</span>} onClick={() => setAdding(true)}>Pridať byt</Btn>}
      />

      <Section title="Súhrn budovy">
        {!loaded ? <SkeletonKPIs n={5} /> : (
          <div className="dp-grid-sm">
            <KPITile label="Byty" value={items.length} />
            <KPITile label="Plocha spolu" value={`${totalArea.toFixed(1)} m²`} />
            <KPITile label="Podiel spolu" value={totalShare.toFixed(0)} hint="jednotiek" />
            <KPITile
              label="Registrovaní vlastníci"
              value={`${registered}/${items.length}`}
              tone={registered === items.length ? 'ok' : pending > 0 ? 'pending' : 'urgent'}
            />
            <KPITile
              label="Čakajúce kódy"
              value={pending}
              tone={pending === 0 ? 'ok' : 'pending'}
              hint="nevyužité aktivačné kódy"
            />
          </div>
        )}
      </Section>

      <Section
        title="Zoznam bytov"
        action={{ label: '+ Pridať byt', onClick: () => setAdding(true) }}
      >
        {err && <p role="alert" style={{ color: 'var(--urgent)' }}>{err}</p>}
        {!loaded && <SkeletonList n={5} />}
        {loaded && items.length === 0 && (
          <EmptyState
            icon={<BuildingIllustration size={96} />}
            title="Zatiaľ žiadne byty"
            body="Pridajte prvý byt alebo nahrajte celý zoznam z Excelu v Nastaveniach."
            action={{ label: '+ Pridať byt', onClick: () => setAdding(true) }}
          />
        )}
        {items.length > 0 && (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
            <table className="apt-table">
              <thead>
                <tr>
                  <th>Byt</th>
                  <th>Posch.</th>
                  <th>Plocha</th>
                  <th>Podiel</th>
                  <th>% budovy</th>
                  <th>Vlastník</th>
                  <th>Stav</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.unitNumber}</strong></td>
                    <td>{a.floor ?? '—'}</td>
                    <td>{Number(a.area).toFixed(1)} m²</td>
                    <td>{Number(a.ownershipShare).toFixed(2)}</td>
                    <td>{a.sharePercent.toFixed(2)} %</td>
                    <td>
                      {a.registeredOwners.length === 0 ? (
                        <span className="inline-meta">— nepriradený —</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {a.registeredOwners.map((o) => (
                            <div key={o.membershipId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9375rem' }}>
                              <strong>{o.user?.firstName} {o.user?.lastName}</strong>
                              <span className="inline-meta">{o.user?.email}</span>
                              {o.user?.totpEnabled && <span title="Má zapnuté 2FA">🔐</span>}
                              <button className="ui-btn ui-btn-ghost" style={{ minHeight: 24, padding: '0 6px', fontSize: 11 }} onClick={() => removeOwner(a, o.membershipId)}>
                                Odobrať
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      {a.registeredOwners.length > 0 ? (
                        <StatusPill tone="ok">Aktivovaný</StatusPill>
                      ) : a.pendingActivation ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <StatusPill tone="pending">Čaká na registráciu</StatusPill>
                          <code style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace' }}>{a.pendingActivation.code}</code>
                        </div>
                      ) : (
                        <StatusPill tone="urgent">Bez vlastníka</StatusPill>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="ui-btn ui-btn-ghost" style={{ minHeight: 28, padding: '0 10px', fontSize: 12 }} onClick={() => setEditing(a)}>
                        Upraviť
                      </button>{' '}
                      <button className="ui-btn ui-btn-ghost" style={{ minHeight: 28, padding: '0 10px', fontSize: 12 }} onClick={() => regenerateCode(a)}>
                        Nový kód
                      </button>{' '}
                      <button className="ui-btn ui-btn-ghost" style={{ minHeight: 28, padding: '0 10px', fontSize: 12, color: 'var(--urgent)' }} onClick={() => removeApartment(a)}>
                        Vymazať
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {adding && buildingId && (
        <AddApartmentModal
          buildingId={buildingId}
          existingApartments={items}
          onClose={() => setAdding(false)}
          onSaved={async () => { setAdding(false); await load(); }}
        />
      )}
      {editing && (
        <EditApartmentModal
          apartment={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      )}
    </>
  );
}

function AddApartmentModal({
  buildingId,
  existingApartments,
  onClose,
  onSaved,
}: {
  buildingId: string;
  existingApartments: Apartment[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // 3-step wizard: Základné údaje → Podiel → Hotovo s kódom
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState({ unitNumber: '', floor: '', area: '', ownershipShare: '' });
  const [shareMode, setShareMode] = useState<'auto' | 'manual'>('auto');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ activationCode: string; unitNumber: string } | null>(null);

  // Auto-výpočet podielu z plochy: pomer plochy nového bytu ku priemeru
  // existujúcich bytov vynásobený ich priemerným podielom.
  const existingTotalShare = existingApartments.reduce((s, a) => s + Number(a.ownershipShare), 0);
  const existingTotalArea = existingApartments.reduce((s, a) => s + Number(a.area), 0);
  const shareFromArea = (() => {
    if (!form.area || existingTotalArea === 0) return '';
    const ratio = Number(form.area) / existingTotalArea;
    // Škálujeme pôvodný súčet tak, že pridáme proporciálny podiel:
    //   novýShare = existingTotalShare * areaRatio / (1 - areaRatio)
    //   ale to rozbije existujúce podiely. Realisticky: odporúčame použiť
    //   pomer m² × (súčet existujúcich podielov / súčet plôch), aby per-m²
    //   sadzba ostala rovnaká.
    const perSqm = existingTotalShare / existingTotalArea;
    return (Number(form.area) * perSqm).toFixed(6);
  })();

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const finalShare = shareMode === 'auto' && shareFromArea ? shareFromArea : form.ownershipShare;
      const r = await api<{ activationCode: string }>('/apartments', {
        method: 'POST',
        body: JSON.stringify({
          buildingId,
          unitNumber: form.unitNumber,
          floor: form.floor ? Number(form.floor) : undefined,
          area: form.area,
          ownershipShare: finalShare,
        }),
      });
      setResult({ activationCode: r.activationCode, unitNumber: form.unitNumber });
      setStep(3);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    if (!result) return;
    navigator.clipboard?.writeText(result.activationCode);
    alert('Kód skopírovaný do schránky.');
  }

  return (
    <ModalShell title={step === 3 ? 'Byt vytvorený' : `Pridať byt — krok ${step}/2`} onClose={onClose}>
      {/* Stepper */}
      {step < 3 && (
        <div className="add-stepper">
          <div className={`add-dot ${step >= 1 ? 'active' : ''}`}>1</div>
          <div className="add-line" />
          <div className={`add-dot ${step >= 2 ? 'active' : ''}`}>2</div>
          <div className="add-line" />
          <div className="add-dot">✓</div>
        </div>
      )}

      {step === 1 && (() => {
        const unitTaken = existingApartments.some(
          (a) => a.unitNumber.toLowerCase() === form.unitNumber.toLowerCase().trim(),
        );
        const unitErr = form.unitNumber && unitTaken ? `Byt ${form.unitNumber} už v budove existuje.` : null;
        const areaNum = Number(form.area);
        const areaErr = form.area && (isNaN(areaNum) || areaNum <= 0) ? 'Plocha musí byť kladné číslo.' : null;
        const canNext = !!form.unitNumber && !!form.area && !unitErr && !areaErr;
        return (
          <>
            <p style={{ margin: '0 0 1rem', color: 'var(--fg-muted)' }}>
              Zadajte základné údaje bytu. Pri úplných údajoch v Excelu použite radšej{' '}
              <strong>Nastavenia → Import bytov</strong>.
            </p>
            <Row>
              <Field
                label="Číslo bytu"
                required
                hint="Ako ho poznajú susedia (napr. 01, 2B, 17)"
                error={unitErr}
              >
                <input value={form.unitNumber} onChange={(e) => setForm({ ...form, unitNumber: e.target.value })} placeholder="01" autoFocus />
              </Field>
              <Field label="Poschodie" hint="Voliteľné">
                <input type="number" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} placeholder="1" />
              </Field>
            </Row>
            <Row>
              <Field
                label="Úžitková plocha (m²)"
                required
                hint="Z kolaudačného rozhodnutia alebo z katastra"
                error={areaErr}
              >
                <input type="number" step="0.01" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="65.5" />
              </Field>
            </Row>
            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <Btn disabled={!canNext} onClick={() => setStep(2)}>
                Pokračovať na podiel →
              </Btn>
              <Btn variant="ghost" onClick={onClose}>Zrušiť</Btn>
            </div>
          </>
        );
      })()}

      {step === 2 && (
        <>
          <div className="info-box">
            <strong>Čo je spoluvlastnícky podiel?</strong>
            <p style={{ margin: '4px 0 0' }}>
              Je to váha bytu pri hlasovaní a rozpočítavaní spoločných nákladov.
              Zákon 182/1993 Z.z. ho definuje ako pomer úžitkovej plochy bytu
              k súčtu plôch všetkých bytov. Výsledok sa zvyčajne uvádza v bodoch
              alebo %.
            </p>
          </div>
          <div className="share-mode" role="radiogroup" aria-label="Spôsob zadania podielu">
            <label className={shareMode === 'auto' ? 'active' : ''}>
              <input type="radio" checked={shareMode === 'auto'} onChange={() => setShareMode('auto')} />
              <div>
                <strong>Vypočítať z plochy (odporúčané)</strong>
                <div className="inline-meta">
                  {form.area && shareFromArea
                    ? `${form.area} m² × ${(existingTotalShare / (existingTotalArea || 1)).toFixed(2)} = podiel ${shareFromArea}`
                    : 'Proporcionálne z existujúcich bytov.'}
                </div>
              </div>
            </label>
            <label className={shareMode === 'manual' ? 'active' : ''}>
              <input type="radio" checked={shareMode === 'manual'} onChange={() => setShareMode('manual')} />
              <div>
                <strong>Zadám ručne</strong>
                <div className="inline-meta">Mám to v zmluve / v katastri.</div>
              </div>
            </label>
          </div>
          {shareMode === 'manual' && (
            <Field label="Spoluvlastnícky podiel" hint="napr. 1666.666667 alebo 6540/36000">
              <input required value={form.ownershipShare} onChange={(e) => setForm({ ...form, ownershipShare: e.target.value })} placeholder="1666.666667" />
            </Field>
          )}
          {existingApartments.length === 0 && shareMode === 'auto' && (
            <p style={{ color: 'var(--pending)', fontSize: 13, marginTop: 8 }}>
              Toto je prvý byt — auto-výpočet neviem urobiť. Zadajte podiel ručne alebo použite
              Excel import, ktorý ich nahrá všetky naraz.
            </p>
          )}
          {err && <div role="alert" className="dp-form-error">{err}</div>}
          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <Btn
              busy={busy}
              disabled={(shareMode === 'manual' && !form.ownershipShare) || (shareMode === 'auto' && !shareFromArea)}
              onClick={submit}
            >
              {busy ? 'Vytváram byt…' : 'Vytvoriť byt + kód'}
            </Btn>
            <Btn variant="ghost" onClick={() => setStep(1)}>← Späť</Btn>
          </div>
        </>
      )}

      {step === 3 && result && (() => {
        const activateUrl = `${location.origin}/aktivacia/${result.activationCode}`;
        return (
        <>
          <div className="success-hero">
            <div className="success-icon">✓</div>
            <h3 style={{ margin: 0 }}>Byt {result.unitNumber} pridaný</h3>
            <p className="inline-meta">Aktivačný kód pre vlastníka:</p>
            <div className="code-display">
              <code>{result.activationCode}</code>
              <button type="button" className="ui-btn ui-btn-ghost" onClick={copyCode} style={{ minHeight: 32, padding: '0 10px' }}>Kopírovať</button>
            </div>
            <div style={{ marginTop: 16, padding: '0.875rem 1rem', background: 'var(--brand-soft)', border: '1px solid var(--brand)', borderRadius: 10, textAlign: 'left' }}>
              <strong style={{ color: 'var(--brand)' }}>Odovzdajte vlastníkovi:</strong>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>
                  <div className="inline-meta">Priamy odkaz (kópia do SMS / emailu):</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                    <code style={{ flex: 1, padding: '6px 8px', background: 'var(--surface)', borderRadius: 6, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {activateUrl}
                    </code>
                    <button
                      type="button"
                      className="ui-btn ui-btn-ghost"
                      onClick={() => { navigator.clipboard?.writeText(activateUrl); alert('Odkaz skopírovaný.'); }}
                      style={{ minHeight: 32, padding: '0 10px', fontSize: 12 }}
                    >
                      Kopírovať odkaz
                    </button>
                  </div>
                </div>
                <div className="inline-meta">
                  Alebo vlastník zadá kód ručne na <code>{location.origin}/aktivacia</code>
                </div>
              </div>
            </div>
            <p style={{ color: 'var(--fg-muted)', fontSize: 13, textAlign: 'center', marginTop: 12 }}>
              Nepoužité kódy sú vždy dostupné v <strong>Nastavenia → PDF aktivačných kódov</strong>.
            </p>
          </div>
          <div className="form-actions" style={{ marginTop: '1rem' }}>
            <button className="ui-btn ui-btn-primary" type="button" onClick={onSaved}>Hotovo</button>
            <button
              type="button"
              className="ui-btn ui-btn-ghost"
              onClick={() => {
                setResult(null);
                setForm({ unitNumber: '', floor: '', area: '', ownershipShare: '' });
                setStep(1);
              }}
            >
              + Pridať ďalší
            </button>
          </div>
        </>
        );
      })()}
    </ModalShell>
  );
}

function EditApartmentModal({
  apartment,
  onClose,
  onSaved,
}: {
  apartment: Apartment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    unitNumber: apartment.unitNumber,
    floor: apartment.floor?.toString() ?? '',
    area: apartment.area,
    ownershipShare: apartment.ownershipShare,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api(`/apartments/${apartment.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          unitNumber: form.unitNumber,
          floor: form.floor ? Number(form.floor) : undefined,
          area: form.area,
          ownershipShare: form.ownershipShare,
        }),
      });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Upraviť byt ${apartment.unitNumber}`} onClose={onClose}>
      <Form
        title=""
        onSubmit={submit}
        error={err}
        actions={
          <>
            <button className="ui-btn ui-btn-primary" type="submit" disabled={busy}>
              {busy ? 'Ukladám…' : 'Uložiť zmeny'}
            </button>
            <button type="button" className="ui-btn ui-btn-ghost" onClick={onClose}>Zrušiť</button>
          </>
        }
      >
        <Row>
          <Field label="Číslo bytu"><input required value={form.unitNumber} onChange={(e) => setForm({ ...form, unitNumber: e.target.value })} /></Field>
          <Field label="Poschodie"><input type="number" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} /></Field>
        </Row>
        <Row>
          <Field label="Plocha (m²)"><input type="number" step="0.01" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></Field>
          <Field label="Spoluvlastnícky podiel"><input value={form.ownershipShare} onChange={(e) => setForm({ ...form, ownershipShare: e.target.value })} /></Field>
        </Row>
      </Form>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(10,10,11,0.55)',
        display: 'grid', placeItems: 'center', zIndex: 50, padding: '1.5rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)', borderRadius: 16, padding: '1.5rem',
          maxWidth: 560, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="ui-btn ui-btn-ghost" onClick={onClose} style={{ minHeight: 32, padding: '0 10px' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
