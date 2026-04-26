/**
 * BillingSettingsPage — edit fakturačných údajov budovy.
 *
 * Tieto údaje sa použijú ako default pri každej vystavenej faktúre.
 * Upraviteľné kedykoľvek; po uložení nastavujú PATCH /buildings/:id/billing.
 */
import { useEffect, useState } from 'react';
import { api } from '../api';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icons';
import { Btn } from '../components/Button';
import { Field, Form, Row } from '../components/forms';
import { SkeletonList } from '../components/Skeleton';
import { IcoLookupHint } from '../components/IcoLookup';
import type { RegistryResult } from '../hooks/useIcoLookup';
import { CompanyNameSearch } from '../components/CompanyNameSearch';

interface Building {
  id: string;
  name: string;
  ico: string | null;
  billingName: string | null;
  billingIco: string | null;
  billingDic: string | null;
  billingVatId: string | null;
  billingAddress: string | null;
  billingIban: string | null;
  billingBic: string | null;
  billingBankName: string | null;
  billingRegistry: string | null;
  invoiceNumberPrefix: string | null;
  invoiceFooterNote: string | null;
}

export function BillingSettingsPage({ buildingId }: { buildingId: string }) {
  const [b, setB] = useState<Building | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [icoApplied, setIcoApplied] = useState(false);
  // Edit mode — default false ak existujú údaje (view mode), true ak sú prázdne (force fill)
  const [editMode, setEditMode] = useState(false);

  function applyRegistry(r: RegistryResult) {
    if (!b) return;
    setB({
      ...b,
      billingName: b.billingName || r.name || null,
      billingDic: b.billingDic || r.dic || null,
      billingVatId: b.billingVatId || r.vatId || null,
      billingAddress: b.billingAddress || r.address || null,
      billingRegistry: b.billingRegistry || r.registry || null,
    });
    setIcoApplied(true);
  }

  useEffect(() => {
    api<Building>(`/buildings/${buildingId}`).then((data) => {
      setB(data);
      // Ak ešte nemá vyplnené core polia (názov + IČO), prepneme do edit mode automaticky
      if (!data.billingName || !data.billingIco) setEditMode(true);
    }).catch((e) => setErr((e as Error).message));
  }, [buildingId]);

  function set(k: keyof Building, v: string) {
    setB((prev) => prev ? { ...prev, [k]: v } : prev);
    setSaved(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!b) return;
    setBusy(true);
    setErr(null);
    try {
      const updated = await api<Building>(`/buildings/${buildingId}/billing`, {
        method: 'PATCH',
        body: JSON.stringify({
          billingName: b.billingName,
          billingIco: b.billingIco,
          billingDic: b.billingDic,
          billingVatId: b.billingVatId,
          billingAddress: b.billingAddress,
          billingIban: b.billingIban,
          billingBic: b.billingBic,
          billingBankName: b.billingBankName,
          billingRegistry: b.billingRegistry,
          invoiceNumberPrefix: b.invoiceNumberPrefix,
          invoiceFooterNote: b.invoiceFooterNote,
        }),
      });
      setB(updated);
      setSaved(true);
      setEditMode(false);
      setIcoApplied(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!b) {
    return (
      <>
        <PageHeader
          breadcrumb={[{ label: 'Budova', to: `/b/${buildingId}` }, { label: 'Fakturačné údaje' }]}
          title="Fakturačné údaje"
        />
        <SkeletonList n={4} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Budova', to: `/b/${buildingId}` }, { label: 'Fakturačné údaje' }]}
        title="Fakturačné údaje budovy"
        subtitle="Tieto údaje sa automaticky vyplnia na každú vystavenú faktúru."
        action={
          !editMode && b.billingName ? (
            <Btn variant="ghost" iconLeft={<Icon name="edit" size={16} />} onClick={() => setEditMode(true)}>
              Upraviť
            </Btn>
          ) : undefined
        }
      />

      {saved && (
        <div className="dp-alert-ok" style={{ marginBottom: '1rem' }}>
          ✓ Údaje boli úspešne uložené.
        </div>
      )}

      {/* VIEW MODE — kompaktný read-only prehľad */}
      {!editMode && (
        <div className="billing-view">
          <div className="billing-view-grid">
            <div className="billing-view-row">
              <dt>Názov</dt><dd><strong>{b.billingName ?? '—'}</strong></dd>
            </div>
            <div className="billing-view-row">
              <dt>IČO</dt><dd>{b.billingIco ?? '—'}</dd>
            </div>
            <div className="billing-view-row">
              <dt>DIČ</dt><dd>{b.billingDic ?? '—'}</dd>
            </div>
            <div className="billing-view-row">
              <dt>IČ DPH</dt><dd>{b.billingVatId ?? '—'}</dd>
            </div>
            <div className="billing-view-row billing-view-row-wide">
              <dt>Adresa</dt><dd>{b.billingAddress ?? '—'}</dd>
            </div>
            <div className="billing-view-row">
              <dt>IBAN</dt><dd className="mono">{b.billingIban ?? '—'}</dd>
            </div>
            <div className="billing-view-row">
              <dt>BIC</dt><dd className="mono">{b.billingBic ?? '—'}</dd>
            </div>
            <div className="billing-view-row">
              <dt>Banka</dt><dd>{b.billingBankName ?? '—'}</dd>
            </div>
            <div className="billing-view-row billing-view-row-wide">
              <dt>Zápis v registri</dt><dd>{b.billingRegistry ?? '—'}</dd>
            </div>
            {b.invoiceFooterNote && (
              <div className="billing-view-row billing-view-row-wide">
                <dt>Pätička FA</dt><dd className="muted">{b.invoiceFooterNote}</dd>
              </div>
            )}
          </div>
          <p className="inline-meta" style={{ marginTop: '1rem' }}>
            Pre úpravu kliknite <strong>Upraviť</strong> hore vpravo. Pri zmene IČO sa údaje automaticky doplnia z RPO / ARES.
          </p>
        </div>
      )}

      {/* EDIT MODE — formulár */}
      {editMode && (

      <Form
        title=""
        onSubmit={submit}
        error={err}
        actions={
          <>
            <Btn type="submit" busy={busy}>
              {busy ? 'Ukladám…' : 'Uložiť zmeny'}
            </Btn>
            {b.billingName && (
              <Btn variant="ghost" onClick={() => { setEditMode(false); setSaved(false); }}>
                Zrušiť úpravu
              </Btn>
            )}
          </>
        }
      >
        <Field
          label="Názov SVB / BD / správcu"
          required
          hint="Toto je vaša fakturujúca entita — nemusí byť rovnaké ako názov budovy. Pri písaní sa zobrazia návrhy z ORSR.sk"
        >
          <input
            required
            value={b.billingName ?? ''}
            onChange={(e) => set('billingName', e.target.value)}
            placeholder={`napr. SVB ${b.name} / Správa, s. r. o.`}
            autoComplete="off"
          />
          <CompanyNameSearch
            query={b.billingName ?? ''}
            country="SK"
            onPick={(r) => {
              setB((prev) => prev ? {
                ...prev,
                billingName: r.name ?? prev.billingName,
                billingIco: r.ico ?? prev.billingIco,
                billingDic: r.dic ?? prev.billingDic,
                billingVatId: r.vatId ?? prev.billingVatId,
                billingAddress: r.address ?? prev.billingAddress,
                billingRegistry: r.registry ?? prev.billingRegistry,
              } : prev);
              if (r.ico) setIcoApplied(true);
            }}
          />
        </Field>

        <Row>
          <Field label="IČO" required hint="Po zadaní IČO sa údaje automaticky doplnia z RPO (SR) alebo ARES (ČR)">
            <input
              required
              value={b.billingIco ?? ''}
              onChange={(e) => { set('billingIco', e.target.value); setIcoApplied(false); }}
              placeholder="12345678"
              inputMode="numeric"
              maxLength={8}
            />
            <IcoLookupHint
              ico={b.billingIco ?? ''}
              country="SK"
              onApply={applyRegistry}
              applied={icoApplied}
              enabled={editMode}
            />
          </Field>
          <Field label="DIČ">
            <input
              value={b.billingDic ?? ''}
              onChange={(e) => set('billingDic', e.target.value)}
              placeholder="2023456789"
            />
          </Field>
          <Field label="IČ DPH" hint="Iba ak je SVB/BD platcom DPH">
            <input
              value={b.billingVatId ?? ''}
              onChange={(e) => set('billingVatId', e.target.value)}
              placeholder="SK2023456789"
            />
          </Field>
        </Row>

        <Field label="Fakturačná adresa" required hint="Použije sa v hlavičke každej faktúry">
          <input
            required
            value={b.billingAddress ?? ''}
            onChange={(e) => set('billingAddress', e.target.value)}
            placeholder="Hviezdoslavova 12, 811 02 Bratislava"
          />
        </Field>

        <Row>
          <Field label="IBAN" required hint="Používa sa pri SEPA QR kóde na faktúrach">
            <input
              required
              value={b.billingIban ?? ''}
              onChange={(e) => set('billingIban', e.target.value)}
              placeholder="SK00 0000 0000 0000 0000 0000"
              style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '0.02em' }}
            />
          </Field>
          <Field label="BIC / SWIFT">
            <input
              value={b.billingBic ?? ''}
              onChange={(e) => set('billingBic', e.target.value)}
              placeholder="TATRSKBX"
              style={{ fontFamily: 'ui-monospace, monospace' }}
            />
          </Field>
        </Row>

        <Field label="Banka" hint="Voliteľne — názov banky pre prehľadnosť">
          <input
            value={b.billingBankName ?? ''}
            onChange={(e) => set('billingBankName', e.target.value)}
            placeholder="Tatra banka, a.s."
          />
        </Field>

        <Field label="Zápis v registri" hint="Voliteľne — registrácia OPS / OR">
          <input
            value={b.billingRegistry ?? ''}
            onChange={(e) => set('billingRegistry', e.target.value)}
            placeholder="Okresný úrad Bratislava III, č. OPS-2010/123"
          />
        </Field>

        <Row>
          <Field label="Prefix čísla faktúry" hint="Generuje sa: PREFIX + poradové číslo">
            <input
              value={b.invoiceNumberPrefix ?? ''}
              onChange={(e) => set('invoiceNumberPrefix', e.target.value)}
              placeholder="2026-FA-"
            />
          </Field>
          <Field label="" hint=" "><div /></Field>
        </Row>

        <Field label="Pätička faktúry" hint="Voliteľne — text na konci každej PDF faktúry">
          <textarea
            rows={3}
            value={b.invoiceFooterNote ?? ''}
            onChange={(e) => set('invoiceFooterNote', e.target.value)}
            placeholder="napr. „SVB nie je platcom DPH. Ďakujeme za úhradu."
          />
        </Field>
      </Form>
      )}
    </>
  );
}
