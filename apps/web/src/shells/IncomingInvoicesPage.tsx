/**
 * Prijaté faktúry — od dodávateľov pre SVB.
 *
 * Tri stránky:
 *   IncomingInvoicesPage — list + dashboard KPI + filter
 *   NewIncomingInvoicePage — upload fotky/PDF s OCR pre-fill alebo ručné zadanie + QR phone-pair
 *   IncomingInvoiceDetailPage — view + edit + prílohy + mark-paid
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, apiUpload } from '../api';
import { PageHeader } from '../components/PageHeader';
import { Btn } from '../components/Button';
import { Field, Form, Row } from '../components/forms';
import { EmptyState, ListItem, Section, StatusPill } from '../components/ui';
import { SkeletonList } from '../components/Skeleton';
import { Icon } from '../components/Icons';

interface Supplier {
  id: string;
  name: string;
  ico: string | null;
  iban: string | null;
  category: string | null;
}

interface IncomingInvoice {
  id: string;
  buildingId: string;
  supplier: Supplier | null;
  invoiceNumber: string | null;
  variableSymbol: string | null;
  issueDate: string | null;
  dueDate: string | null;
  amount: string;
  currency: string;
  iban: string | null;
  description: string | null;
  category: string | null;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';
  paidAt: string | null;
  attachments: Attachment[];
}
interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

interface DashboardStats {
  pendingCount: number;
  overdueCount: number;
  paidThisMonthCount: number;
  totalUnpaidAmount: string;
}

const STATUS_LABEL: Record<IncomingInvoice['status'], { label: string; tone: 'urgent' | 'pending' | 'ok' | 'neutral' }> = {
  DRAFT:     { label: 'Koncept', tone: 'neutral' },
  PENDING:   { label: 'Na úhradu', tone: 'pending' },
  APPROVED:  { label: 'Schválené', tone: 'pending' },
  PAID:      { label: 'Uhradené', tone: 'ok' },
  CANCELLED: { label: 'Zrušené', tone: 'neutral' },
};

/* =============================================================
   LIST PAGE — prehľad + dashboard
============================================================= */
export function IncomingInvoicesPage({ buildingId }: { buildingId: string }) {
  const [items, setItems] = useState<IncomingInvoice[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'OVERDUE' | 'PAID'>('PENDING');

  async function load() {
    try {
      const [list, dash] = await Promise.all([
        api<IncomingInvoice[]>(`/incoming-invoices/building/${buildingId}`),
        api<DashboardStats>(`/incoming-invoices/building/${buildingId}/dashboard`),
      ]);
      setItems(list);
      setStats(dash);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { load(); }, [buildingId]);

  const now = Date.now();
  const filtered = items.filter((it) => {
    if (filter === 'ALL') return true;
    if (filter === 'PENDING') return ['PENDING', 'APPROVED'].includes(it.status);
    if (filter === 'OVERDUE') {
      return ['PENDING', 'APPROVED'].includes(it.status) && it.dueDate && new Date(it.dueDate).getTime() < now;
    }
    if (filter === 'PAID') return it.status === 'PAID';
    return true;
  });

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Budova', to: `/b/${buildingId}` }, { label: 'Prijaté faktúry' }]}
        title="Prijaté faktúry"
        subtitle="Faktúry od dodávateľov — energie, údržba, výťah, plyn. Foto + OCR alebo ručné zadanie."
        action={
          <Link to={`/b/${buildingId}/prijate-faktury/nova`} className="ui-btn ui-btn-primary">
            <Icon name="plus" size={16} /> Pridať faktúru
          </Link>
        }
      />

      {/* Dashboard KPI */}
      {stats && (
        <div className="ii-stats">
          <div className="ii-stat">
            <div className="ii-stat-label">NA ÚHRADU</div>
            <div className="ii-stat-val">{stats.pendingCount}</div>
            <div className="ii-stat-meta">{Number(stats.totalUnpaidAmount).toFixed(2)} €</div>
          </div>
          <div className={`ii-stat ${stats.overdueCount > 0 ? 'ii-stat-urgent' : ''}`}>
            <div className="ii-stat-label">PO SPLATNOSTI</div>
            <div className="ii-stat-val">{stats.overdueCount}</div>
            <div className="ii-stat-meta">prešvihnutých</div>
          </div>
          <div className="ii-stat ii-stat-ok">
            <div className="ii-stat-label">UHRADENÉ TENTO MESIAC</div>
            <div className="ii-stat-val">{stats.paidThisMonthCount}</div>
            <div className="ii-stat-meta">faktúr</div>
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div className="pay-filter">
        {(['PENDING', 'OVERDUE', 'PAID', 'ALL'] as const).map((f) => (
          <button
            key={f}
            className={`pay-chip ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'PENDING' ? 'Na úhradu'
              : f === 'OVERDUE' ? 'Po splatnosti'
              : f === 'PAID' ? 'Uhradené'
              : 'Všetky'}
            {' '}({f === 'ALL' ? items.length : filtered.filter((it) => filterMatches(it, f, now)).length})
          </button>
        ))}
      </div>

      {!loaded && <SkeletonList n={3} />}

      {loaded && filtered.length === 0 && (
        <EmptyState
          icon={<Icon name="download" size={40} />}
          title={filter === 'PENDING' ? 'Žiadne nezaplatené faktúry' : 'Žiadne faktúry'}
          body={filter === 'PENDING' ? 'Skvelé — všetko je vyplatené.' : 'Pridajte prvú prijatú faktúru — odfoťte ju mobilom alebo nahrajte PDF.'}
          action={{ label: 'Pridať faktúru', to: `/b/${buildingId}/prijate-faktury/nova` }}
        />
      )}

      {filtered.length > 0 && (
        <Section title={`${filtered.length} ${filtered.length === 1 ? 'faktúra' : 'faktúr'}`}>
          {filtered.map((it) => {
            const overdue = ['PENDING', 'APPROVED'].includes(it.status) && it.dueDate && new Date(it.dueDate).getTime() < now;
            const status = STATUS_LABEL[it.status];
            return (
              <ListItem
                key={it.id}
                icon={overdue ? '⚠️' : it.attachments.length > 0 ? '📄' : '📋'}
                title={`${it.supplier?.name ?? 'Bez dodávateľa'} · ${Number(it.amount).toFixed(2)} ${it.currency}`}
                subtitle={
                  <>
                    {it.invoiceNumber && <>FA č. {it.invoiceNumber} · </>}
                    {it.dueDate && (
                      <span style={{ color: overdue ? 'var(--urgent)' : 'inherit' }}>
                        Splatnosť {new Date(it.dueDate).toLocaleDateString('sk-SK')}
                      </span>
                    )}
                    {it.category && <> · {it.category}</>}
                  </>
                }
                status={<StatusPill tone={overdue ? 'urgent' : status.tone}>{overdue ? 'Po splatnosti' : status.label}</StatusPill>}
                to={`/b/${buildingId}/prijate-faktury/${it.id}`}
              />
            );
          })}
        </Section>
      )}
    </>
  );
}

function filterMatches(it: IncomingInvoice, f: 'PENDING' | 'OVERDUE' | 'PAID', now: number): boolean {
  if (f === 'PENDING') return ['PENDING', 'APPROVED'].includes(it.status);
  if (f === 'OVERDUE') return ['PENDING', 'APPROVED'].includes(it.status) && it.dueDate != null && new Date(it.dueDate).getTime() < now;
  if (f === 'PAID') return it.status === 'PAID';
  return true;
}

/* =============================================================
   NEW PAGE — upload + OCR + manual form + phone-pair
============================================================= */
export function NewIncomingInvoicePage({ buildingId }: { buildingId: string }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'choose' | 'photo' | 'manual' | 'phone'>('choose');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // OCR výsledok + supplier flow
  const [ocrPreview, setOcrPreview] = useState<{
    extraction: any;
    existingSupplier: Supplier | null;
    registryData: any;
    drift: Array<{ field: string; db: string; registry: string }> | null;
    file: File;
  } | null>(null);
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  // Manuálny formulár (pre-fill z OCR alebo prázdny)
  const [form, setForm] = useState({
    supplierId: '',
    invoiceNumber: '',
    variableSymbol: '',
    issueDate: '',
    dueDate: '',
    amount: '',
    iban: '',
    description: '',
    category: '',
  });
  const [pendingAttachment, setPendingAttachment] = useState<File | null>(null);

  useEffect(() => {
    api<Supplier[]>(`/suppliers/building/${buildingId}`).then(setSuppliers).catch(() => {});
  }, [buildingId]);

  async function ocrUpload(file: File) {
    setBusy(true); setErr(null);
    try {
      // apiUpload má auto-refresh na 401 + extra fields
      const data = await apiUpload<any>('/incoming-invoices/ocr-preview', file, 'file', { buildingId });
      setOcrPreview({ ...data, file });
      setPendingAttachment(file);

      // Pre-fill form z OCR + register dát
      const ex = data.extraction;
      const reg = data.registryData;
      setForm((f) => ({
        ...f,
        supplierId: data.existingSupplier?.id ?? f.supplierId,
        invoiceNumber: ex.invoiceNumber ?? f.invoiceNumber,
        variableSymbol: ex.variableSymbol ?? f.variableSymbol,
        issueDate: ex.issueDate ? ex.issueDate.slice(0, 10) : f.issueDate,
        dueDate: ex.dueDate ? ex.dueDate.slice(0, 10) : f.dueDate,
        amount: ex.amount ?? f.amount,
        iban: ex.iban ?? data.existingSupplier?.iban ?? reg?.iban ?? f.iban,
        description: ex.description ?? f.description,
      }));
      setMode('manual');
    } catch (e) {
      setErr('OCR zlyhalo: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Vytvorí dodávateľa z údajov v RPO/ORSR a priradí ho k formuláru.
   * Volá sa keď IČO nebolo v lokálnej DB ale registry ho našiel.
   */
  async function createSupplierFromRegistry() {
    if (!ocrPreview?.registryData?.found) return;
    setCreatingSupplier(true);
    try {
      const r = ocrPreview.registryData;
      const newSupplier = await api<Supplier>('/suppliers', {
        method: 'POST',
        body: JSON.stringify({
          buildingId,
          name: r.name,
          ico: r.ico,
          dic: r.dic,
          vatId: r.vatId,
          iban: ocrPreview.extraction.iban,
          address: r.address,
        }),
      });
      // Refresh list + select v formulári
      const updatedList = await api<Supplier[]>(`/suppliers/building/${buildingId}`);
      setSuppliers(updatedList);
      setForm((f) => ({ ...f, supplierId: newSupplier.id }));
      // Update ocrPreview existingSupplier
      setOcrPreview({ ...ocrPreview, existingSupplier: newSupplier, registryData: null });
    } catch (e) {
      setErr('Nepodarilo sa vytvoriť dodávateľa: ' + (e as Error).message);
    } finally {
      setCreatingSupplier(false);
    }
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const created = await api<IncomingInvoice>('/incoming-invoices', {
        method: 'POST',
        body: JSON.stringify({
          buildingId,
          supplierId: form.supplierId || undefined,
          invoiceNumber: form.invoiceNumber || undefined,
          variableSymbol: form.variableSymbol || undefined,
          issueDate: form.issueDate || undefined,
          dueDate: form.dueDate || undefined,
          amount: form.amount,
          iban: form.iban || undefined,
          description: form.description || undefined,
          category: form.category || undefined,
        }),
      });

      // Ak máme prílohu (z OCR alebo manuálne nahranú), pošleme ju
      if (pendingAttachment) {
        await apiUpload(`/incoming-invoices/${created.id}/attachments`, pendingAttachment);
      }

      navigate(`/b/${buildingId}/prijate-faktury/${created.id}`);
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
          { label: 'Prijaté faktúry', to: `/b/${buildingId}/prijate-faktury` },
          { label: 'Nová' },
        ]}
        title="Pridať prijatú faktúru"
        subtitle="Nahrajte fotku alebo PDF — systém vytiahne údaje. Alebo zadajte ručne."
      />

      {mode === 'choose' && (
        <div className="ii-method-grid">
          <button className="ii-method" onClick={() => setMode('photo')}>
            <span className="ii-method-ic">📷</span>
            <strong>Foto / PDF z PC</strong>
            <span>Nahrať súbor → OCR vytiahne sumu, IBAN, IČO, VS, dátumy</span>
          </button>
          <button className="ii-method" onClick={() => setMode('phone')}>
            <span className="ii-method-ic">📱</span>
            <strong>Odfotiť mobilom</strong>
            <span>Naskenujete QR kód mobilom → odfotíte → automaticky uploadne</span>
          </button>
          <button className="ii-method" onClick={() => setMode('manual')}>
            <span className="ii-method-ic">✏️</span>
            <strong>Zadať ručne</strong>
            <span>Pre faktúry, ktoré máte len v texte alebo emaile</span>
          </button>
        </div>
      )}

      {mode === 'photo' && (
        <PhotoUpload
          onUpload={ocrUpload}
          busy={busy}
          err={err}
          onCancel={() => { setMode('choose'); setErr(null); }}
        />
      )}

      {mode === 'phone' && (
        <PhonePairWidget
          buildingId={buildingId}
          onPhotoReceived={async ({ sessionId, keyIndex }) => {
            // Okamžite prepneme na manual aby user nesedel na "Pokračujem na formulár..." stuck obrazovke.
            // OCR sa spustí v pozadí — formulár sa pre-vyplní keď OCR dokončí.
            setMode('manual');
            try {
              const fileData = await api<{ base64: string; key: string; sizeBytes: number }>(
                `/phone-pairing/${sessionId}/file/${keyIndex}`,
              );
              const blob = await (await fetch(`data:image/jpeg;base64,${fileData.base64}`)).blob();
              const file = new File([blob], `phone-${Date.now()}.jpg`, { type: 'image/jpeg' });
              // Spustí OCR + pre-fill (vlastná chyba sa zobrazí ako error banner v ocrUpload)
              await ocrUpload(file);
            } catch (e) {
              setErr('OCR z mobilnej fotky zlyhal: ' + (e as Error).message + '. Vyplňte ručne.');
            }
          }}
          onCancel={() => setMode('choose')}
        />
      )}

      {mode === 'manual' && (
        <div className={pendingAttachment ? 'ii-form-with-preview' : ''}>
          <div className="ii-form-col">
          {busy && !ocrPreview && (
            <div className="ocr-running">
              <span className="ico-hint-spinner" />
              <span><strong>Spracovávam fotku…</strong> OCR vytiahne sumu, IBAN, IČO, VS a dátumy. Trvá 5–15 sekúnd.</span>
            </div>
          )}
          {ocrPreview && (
            <>
              {/* OCR Confidence Warning — keď je nízka, upozorni usera */}
              {ocrPreview.extraction.confidence < 0.5 && (
                <div className="ii-ocr-warning ii-ocr-warning-low">
                  <span className="ii-ocr-warning-icon">⚠️</span>
                  <div>
                    <strong>Nízka kvalita rozpoznávania ({(ocrPreview.extraction.confidence * 100).toFixed(0)}%)</strong>
                    <p>Fotka je nejasná alebo faktúra je v zlom formáte. <strong>Prosím skontroluj nižšie údaje a oprav ich ručne.</strong></p>
                  </div>
                </div>
              )}
              {ocrPreview.extraction.confidence >= 0.5 && ocrPreview.extraction.confidence < 0.75 && (
                <div className="ii-ocr-warning ii-ocr-warning-medium">
                  <span className="ii-ocr-warning-icon">ℹ️</span>
                  <div>
                    <strong>Stredná kvalita rozpoznávania ({(ocrPreview.extraction.confidence * 100).toFixed(0)}%)</strong>
                    <p>Prosím skontroluj kritické polia (suma, IBAN, VS).</p>
                  </div>
                </div>
              )}

              <div className="ii-ocr-summary">
                <div className="ii-ocr-head">
                  <strong>Rozpoznané údaje z faktúry</strong>
                  <span className="ii-ocr-conf">presnosť {(ocrPreview.extraction.confidence * 100).toFixed(0)} %</span>
                </div>
                <div className="ii-ocr-fields">
                  {ocrPreview.extraction.amount && <span className="ii-ocr-pill">Suma {ocrPreview.extraction.amount} €</span>}
                  {ocrPreview.extraction.iban && <span className="ii-ocr-pill">IBAN {ocrPreview.extraction.iban}</span>}
                  {ocrPreview.extraction.ico && <span className="ii-ocr-pill">IČO {ocrPreview.extraction.ico}</span>}
                  {ocrPreview.extraction.variableSymbol && <span className="ii-ocr-pill">VS {ocrPreview.extraction.variableSymbol}</span>}
                  {ocrPreview.extraction.dueDate && <span className="ii-ocr-pill">Splatnosť {ocrPreview.extraction.dueDate.slice(0, 10)}</span>}
                  {ocrPreview.extraction.invoiceNumber && <span className="ii-ocr-pill">FA č. {ocrPreview.extraction.invoiceNumber}</span>}
                </div>
                {ocrPreview.extraction.description && (
                  <div className="ii-ocr-desc">
                    <strong>Predmet:</strong> {ocrPreview.extraction.description}
                  </div>
                )}
              </div>

              {/* Supplier flow — 3 stavy */}
              {ocrPreview.existingSupplier && !ocrPreview.drift && (
                <div className="ii-supplier-card ii-supplier-ok">
                  <div className="ii-supplier-head">
                    <span className="ii-supplier-icon">✓</span>
                    <div>
                      <strong>Dodávateľ rozpoznaný v databáze</strong>
                      <div className="ii-supplier-name">{ocrPreview.existingSupplier.name}{ocrPreview.existingSupplier.ico ? ` · IČO ${ocrPreview.existingSupplier.ico}` : ''}</div>
                    </div>
                  </div>
                  <div className="ii-supplier-actions">Údaje sedia s registrom — nie je potrebné nič upravovať.</div>
                </div>
              )}

              {ocrPreview.existingSupplier && ocrPreview.drift && ocrPreview.drift.length > 0 && (
                <div className="ii-supplier-card ii-supplier-warn">
                  <div className="ii-supplier-head">
                    <span className="ii-supplier-icon">⚠️</span>
                    <div>
                      <strong>Údaje dodávateľa sa zmenili v RPO</strong>
                      <div className="ii-supplier-name">{ocrPreview.existingSupplier.name}</div>
                    </div>
                  </div>
                  <div className="ii-supplier-drift">
                    {ocrPreview.drift.map((d, i) => (
                      <div key={i} className="ii-drift-row">
                        <span className="ii-drift-field">{d.field}:</span>
                        <span className="ii-drift-old">vaša DB: {d.db}</span>
                        <span className="ii-drift-arrow">→</span>
                        <span className="ii-drift-new">RPO: {d.registry}</span>
                      </div>
                    ))}
                  </div>
                  <p className="ii-supplier-note">
                    Pre teraz použijem údaje z DB. Upravte dodávateľa manuálne v <strong>Dodávatelia → Upraviť</strong> ak chcete sync.
                  </p>
                </div>
              )}

              {!ocrPreview.existingSupplier && ocrPreview.registryData?.found && (
                <div className="ii-supplier-card ii-supplier-info">
                  <div className="ii-supplier-head">
                    <span className="ii-supplier-icon">🆕</span>
                    <div>
                      <strong>Nový dodávateľ — chcete ho pridať do databázy?</strong>
                      <div className="ii-supplier-name">{ocrPreview.registryData.name}{ocrPreview.registryData.ico ? ` · IČO ${ocrPreview.registryData.ico}` : ''}</div>
                    </div>
                  </div>
                  <div className="ii-supplier-fields">
                    {ocrPreview.registryData.dic && <span className="ii-ocr-pill">DIČ {ocrPreview.registryData.dic}</span>}
                    {ocrPreview.registryData.vatId && <span className="ii-ocr-pill">IČ DPH {ocrPreview.registryData.vatId}</span>}
                    {ocrPreview.registryData.address && <span className="ii-ocr-pill">{ocrPreview.registryData.address}</span>}
                  </div>
                  <div className="ii-supplier-actions">
                    <Btn busy={creatingSupplier} onClick={createSupplierFromRegistry}>
                      ➕ Pridať dodávateľa s týmito údajmi
                    </Btn>
                    <Btn variant="ghost" onClick={() => setOcrPreview({ ...ocrPreview, registryData: null })}>
                      Preskočiť — uložím faktúru bez dodávateľa
                    </Btn>
                  </div>
                </div>
              )}

              {!ocrPreview.existingSupplier && !ocrPreview.registryData?.found && ocrPreview.extraction.ico && (
                <div className="ii-supplier-card ii-supplier-warn">
                  <span className="ii-supplier-icon">⚠️</span>
                  <div>
                    <strong>IČO {ocrPreview.extraction.ico} sa nenašlo</strong>
                    <div className="ii-supplier-note">Ani v DB, ani v RPO/ORSR. Skontrolujte IČO alebo doplňte dodávateľa ručne v <strong>Dodávatelia</strong>.</div>
                  </div>
                </div>
              )}

              <p className="ii-ocr-note">Skontrolujte alebo opravte hodnoty v formulári nižšie pred uložením.</p>
            </>
          )}

          <Form
            title=""
            onSubmit={submitForm}
            error={err}
            actions={
              <>
                <Btn type="submit" busy={busy} disabled={!form.amount}>
                  {busy ? 'Ukladám…' : 'Uložiť faktúru'}
                </Btn>
                <Btn variant="ghost" onClick={() => setMode('choose')}>← Späť</Btn>
              </>
            }
          >
            <Row>
              <Field label="Dodávateľ">
                <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                  <option value="">— bez dodávateľa —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{s.ico ? ` · IČO ${s.ico}` : ''}</option>
                  ))}
                </select>
              </Field>
              <Field label="Kategória">
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">— vyberte —</option>
                  <option>Energie</option>
                  <option>Plyn</option>
                  <option>Voda</option>
                  <option>Teplo</option>
                  <option>Elektrina</option>
                  <option>Výťah</option>
                  <option>Komín</option>
                  <option>Údržba</option>
                  <option>Materiál</option>
                  <option>Účtovníctvo</option>
                  <option>Právne služby</option>
                  <option>Poistenie</option>
                  <option>Iné</option>
                </select>
              </Field>
            </Row>

            <Row>
              <Field label="Číslo faktúry">
                <input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} placeholder="FA2026/0042" />
              </Field>
              <Field label="Variabilný symbol">
                <input value={form.variableSymbol} onChange={(e) => setForm({ ...form, variableSymbol: e.target.value })} placeholder="20260042" />
              </Field>
            </Row>

            <Row>
              <Field label="Suma" required>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="124,50"
                />
              </Field>
              <Field label="IBAN dodávateľa">
                <input
                  value={form.iban}
                  onChange={(e) => setForm({ ...form, iban: e.target.value })}
                  placeholder="SK00 0000 0000 0000 0000 0000"
                  style={{ fontFamily: 'ui-monospace, monospace' }}
                />
              </Field>
            </Row>

            <Row>
              <Field label="Dátum vystavenia">
                <input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
              </Field>
              <Field label="Splatnosť" required>
                <input required type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </Field>
            </Row>

            <Field label="Popis / poznámka">
              <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="napr. Fakturácia za apríl 2026 — elektrina spoločných priestorov" />
            </Field>

            {!pendingAttachment && (
              <Field label="Príloha (voliteľne)" hint="PDF alebo fotka faktúry">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setPendingAttachment(e.target.files?.[0] ?? null)}
                />
              </Field>
            )}
            {pendingAttachment && (
              <div className="ii-attachment-pill">
                <Icon name="file" size={16} />
                <span>{pendingAttachment.name} ({(pendingAttachment.size / 1024).toFixed(0)} kB)</span>
                <Btn variant="ghost" onClick={() => setPendingAttachment(null)} style={{ minHeight: 28, padding: '0 8px' }}>✕</Btn>
              </div>
            )}
          </Form>
          </div>
          {pendingAttachment && <PdfPreview file={pendingAttachment} />}
        </div>
      )}
    </>
  );
}

/* =============================================================
   PdfPreview — náhľad PDF / image v pravej kolóne pri pre-fille
============================================================= */
function PdfPreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  if (!url) return null;
  const isImage = file.type.startsWith('image/');
  return (
    <aside className="ii-preview-col">
      <div className="ii-preview-head">
        <Icon name="file" size={16} />
        <span>{file.name}</span>
        <span className="ii-preview-size">{(file.size / 1024).toFixed(0)} kB</span>
      </div>
      <div className="ii-preview-frame">
        {isImage ? (
          <img src={url} alt="Náhľad faktúry" />
        ) : (
          <iframe src={url} title="PDF náhľad" />
        )}
      </div>
      <a href={url} target="_blank" rel="noreferrer" className="ii-preview-open">
        Otvoriť v novom okne →
      </a>
    </aside>
  );
}

/* =============================================================
   PhotoUpload — drag/drop + file input
============================================================= */
function PhotoUpload({ onUpload, busy, err, onCancel }: {
  onUpload: (file: File) => void;
  busy: boolean;
  err: string | null;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="ii-photo-zone">
      <div className="ii-photo-card">
        <div className="ii-photo-icon">📷</div>
        <h3>Nahrajte fotku alebo PDF faktúry</h3>
        <p>Systém spustí OCR a predvyplní všetky polia. Skontrolujete a uložíte.</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <Btn busy={busy} onClick={() => inputRef.current?.click()}>
            {busy ? 'Spracovávam…' : 'Vybrať súbor'}
          </Btn>
          <Btn variant="ghost" onClick={onCancel}>← Späť</Btn>
        </div>
        {err && <p className="dp-form-error" style={{ marginTop: 12 }}>{err}</p>}
      </div>
    </div>
  );
}

/* =============================================================
   PhonePairWidget — QR kód, polling, photo received
============================================================= */
function PhonePairWidget({ buildingId, onPhotoReceived, onCancel }: {
  buildingId: string;
  onPhotoReceived: (info: { sessionId: string; keyIndex: number; storageKey: string }) => void;
  onCancel: () => void;
}) {
  const [session, setSession] = useState<{ id: string; pairUrl: string; ttlSeconds: number } | null>(null);
  const [qrSvg, setQrSvg] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const [keysReceived, setKeysReceived] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const s = await api<any>('/phone-pairing', {
          method: 'POST',
          body: JSON.stringify({ purpose: 'INCOMING_INVOICE_PHOTO', buildingId }),
        });
        setSession(s);
        // Generuj QR cez qrcode lib (CommonJS export → musí cez .default)
        const mod: any = await import('qrcode');
        const QRCode = mod.default ?? mod;
        const svg: string = await QRCode.toString(s.pairUrl, { type: 'svg', margin: 1, width: 280, errorCorrectionLevel: 'M' });
        setQrSvg(svg);
      } catch (e) {
        setErr('Nepodarilo sa vygenerovať QR kód: ' + (e as Error).message);
      }
    })();
  }, [buildingId]);

  // Polling stavu sesssion každé 2 sekundy
  useEffect(() => {
    if (!session) return;
    const iv = setInterval(async () => {
      try {
        const status = await api<{ uploadedKeys: string[]; consumedAt: string | null }>(
          `/phone-pairing/${session.id}/status`,
        );
        if (status.uploadedKeys.length > keysReceived.length) {
          const newKeys = status.uploadedKeys;
          setKeysReceived(newKeys);
          if (newKeys.length > 0 && session) {
            const lastIdx = newKeys.length - 1;
            onPhotoReceived({
              sessionId: session.id,
              keyIndex: lastIdx,
              storageKey: newKeys[lastIdx],
            });
          }
        }
      } catch { /* ignore polling errors */ }
    }, 2000);
    return () => clearInterval(iv);
  }, [session, keysReceived.length, onPhotoReceived]);

  return (
    <div className="ii-pair">
      <div className="ii-pair-card">
        <h3>Naskenujte QR kód mobilom</h3>
        <p className="inline-meta">Otvorí sa stránka, kde môžete odfotiť faktúru. Foto sa automaticky pošle sem.</p>

        {err && <div className="dp-form-error">{err}</div>}

        {qrSvg && <div className="ii-pair-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />}

        {session && (
          <>
            <p className="ii-pair-url">
              Alebo otvorte odkaz na mobile: <br />
              <code>{session.pairUrl}</code>
            </p>
            {/localhost|127\.0\.0\.1/.test(session.pairUrl) && (
              <div className="ii-pair-warn">
                ⚠️ <strong>Lokálny dev:</strong> mobil nedosiahne <code>localhost</code>.
                Pre testovanie QR otvorte produkciu:{' '}
                <a href="http://domov.204.168.212.58.nip.io" target="_blank" rel="noreferrer">
                  domov.204.168.212.58.nip.io →
                </a>
              </div>
            )}
          </>
        )}

        {keysReceived.length > 0 ? (
          <div className="ii-pair-success">
            <span className="ii-pair-success-icon">✓</span>
            <div>
              <strong>Foto prijatá!</strong>
              <p>Spracovávam OCR a prepínám na formulár…</p>
            </div>
          </div>
        ) : (
          <div className="ii-pair-waiting">
            <span className="ii-pair-spinner" />
            <div>
              <strong>Čakám na foto z mobilu…</strong>
              <p>Naskenuj QR kód v mobilnej aplikácii a odfot faktúru.</p>
            </div>
          </div>
        )}

        <Btn variant="ghost" onClick={onCancel}>← Zrušiť</Btn>
      </div>
    </div>
  );
}

/* =============================================================
   DETAIL PAGE
============================================================= */
export function IncomingInvoiceDetailPage() {
  const { buildingId, iid } = useParams<{ buildingId: string; iid: string }>();
  const navigate = useNavigate();
  const [inv, setInv] = useState<IncomingInvoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [paidNote, setPaidNote] = useState('');

  async function load() {
    if (!iid) return;
    try {
      const r = await api<IncomingInvoice>(`/incoming-invoices/${iid}`);
      setInv(r);
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  useEffect(() => { load(); }, [iid]);

  async function markPaid() {
    if (!iid) return;
    setBusy(true); setErr(null);
    try {
      await api(`/incoming-invoices/${iid}/mark-paid`, {
        method: 'POST',
        body: JSON.stringify({ paidNote }),
      });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  async function viewAttachment(attId: string) {
    try {
      const r = await api<{ url: string }>(`/incoming-invoices/attachments/${attId}/url`);
      window.open(r.url, '_blank');
    } catch (e) {
      alert('Nepodarilo sa otvoriť: ' + (e as Error).message);
    }
  }

  async function deleteInvoice() {
    if (!iid || !confirm('Naozaj vymazať túto faktúru a všetky jej prílohy?')) return;
    try {
      await api(`/incoming-invoices/${iid}`, { method: 'DELETE' });
      navigate(`/b/${buildingId}/prijate-faktury`);
    } catch (e) {
      alert('Vymazanie zlyhalo: ' + (e as Error).message);
    }
  }

  if (!inv) {
    return (
      <>
        <PageHeader
          breadcrumb={[{ label: 'Budova', to: `/b/${buildingId}` }, { label: 'Prijaté faktúry', to: `/b/${buildingId}/prijate-faktury` }, { label: 'Detail' }]}
          title="Načítavam…"
        />
        {err ? <div className="dp-form-error">{err}</div> : <SkeletonList n={2} />}
      </>
    );
  }

  const status = STATUS_LABEL[inv.status];
  const overdue = ['PENDING', 'APPROVED'].includes(inv.status) && inv.dueDate && new Date(inv.dueDate).getTime() < Date.now();

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Budova', to: `/b/${buildingId}` },
          { label: 'Prijaté faktúry', to: `/b/${buildingId}/prijate-faktury` },
          { label: inv.invoiceNumber ?? 'Faktúra' },
        ]}
        title={inv.supplier?.name ?? 'Bez dodávateľa'}
        subtitle={`${Number(inv.amount).toFixed(2)} ${inv.currency}${inv.invoiceNumber ? ` · FA č. ${inv.invoiceNumber}` : ''}`}
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <StatusPill tone={overdue ? 'urgent' : status.tone}>{overdue ? 'Po splatnosti' : status.label}</StatusPill>
            {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
              <Btn busy={busy} onClick={markPaid}>Označiť ako uhradené</Btn>
            )}
          </div>
        }
      />

      <Section title="Detaily faktúry">
        <dl className="ii-detail">
          <Detail label="Dodávateľ">{inv.supplier ? `${inv.supplier.name}${inv.supplier.ico ? ` · IČO ${inv.supplier.ico}` : ''}` : '—'}</Detail>
          <Detail label="Suma">{Number(inv.amount).toFixed(2)} {inv.currency}</Detail>
          {inv.invoiceNumber && <Detail label="Číslo faktúry">{inv.invoiceNumber}</Detail>}
          {inv.variableSymbol && <Detail label="VS">{inv.variableSymbol}</Detail>}
          {inv.iban && <Detail label="IBAN dodávateľa"><code>{inv.iban}</code></Detail>}
          {inv.issueDate && <Detail label="Vystavená">{new Date(inv.issueDate).toLocaleDateString('sk-SK')}</Detail>}
          {inv.dueDate && <Detail label="Splatnosť" tone={overdue ? 'urgent' : 'normal'}>{new Date(inv.dueDate).toLocaleDateString('sk-SK')}</Detail>}
          {inv.category && <Detail label="Kategória">{inv.category}</Detail>}
          {inv.description && <Detail label="Popis">{inv.description}</Detail>}
          {inv.paidAt && <Detail label="Uhradené">{new Date(inv.paidAt).toLocaleDateString('sk-SK')}</Detail>}
        </dl>
      </Section>

      {inv.attachments.length > 0 && (
        <Section title={`Prílohy (${inv.attachments.length})`}>
          {inv.attachments.map((a) => (
            <ListItem
              key={a.id}
              icon={a.mimeType.startsWith('image/') ? '🖼️' : '📄'}
              title={a.filename}
              subtitle={`${(a.sizeBytes / 1024).toFixed(0)} kB · ${a.mimeType} · ${new Date(a.uploadedAt).toLocaleString('sk-SK')}`}
              onClick={() => viewAttachment(a.id)}
            />
          ))}
        </Section>
      )}

      {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
        <Section title="Označiť ako uhradené">
          <p className="inline-meta">
            Po označení sa faktúra presunie do archívu zaplatených. Môžete pridať poznámku (napr. dátum úhrady, číslo bankového výpisu).
          </p>
          <Field label="Poznámka k úhrade" hint="Voliteľne">
            <input value={paidNote} onChange={(e) => setPaidNote(e.target.value)} placeholder="napr. Tatra banka výpis 04/2026, 25.4.2026" />
          </Field>
          <Btn busy={busy} onClick={markPaid}>Označiť ako uhradené</Btn>
        </Section>
      )}

      <Section title="Akcie">
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="ghost" onClick={() => navigate(`/b/${buildingId}/prijate-faktury`)}>← Späť na zoznam</Btn>
          <span style={{ flex: 1 }} />
          <Btn variant="danger" onClick={deleteInvoice}>Vymazať faktúru</Btn>
        </div>
      </Section>
    </>
  );
}

function Detail({ label, children, tone }: { label: string; children: React.ReactNode; tone?: 'urgent' | 'normal' }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={tone === 'urgent' ? 'ii-detail-urgent' : ''}>{children}</dd>
    </>
  );
}
