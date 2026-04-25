/**
 * DocumentsPage — /b/:buildingId/dokumenty
 *
 * Archív dokumentov budovy: zmluvy, zápisnice, revízne správy, vyúčtovania.
 * Pre chairman: upload + kategorizácia. Pre všetkých členov: zoznam + download.
 *
 * Backend:
 *   POST   /documents (multipart)          — upload (admin)
 *   GET    /documents/building/:id         — list (všetci členovia)
 *   GET    /documents/:id/download-url     — presigned URL
 */
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, apiUpload } from '../api';
import { PageHeader } from '../components/PageHeader';
import { Btn } from '../components/Button';
import { Field, Form } from '../components/forms';
import { SkeletonList } from '../components/Skeleton';
import { EmptyState, ListItem, Section, StatusPill } from '../components/ui';
import { Icon } from '../components/Icons';

type Category = 'CONTRACT' | 'INVOICE' | 'ANNUAL_REPORT' | 'TECHNICAL_REVIEW' | 'MEETING_MINUTES' | 'OTHER';

const CATEGORY_LABEL: Record<Category, string> = {
  CONTRACT: 'Zmluvy',
  INVOICE: 'Faktúry',
  ANNUAL_REPORT: 'Ročné vyúčtovania',
  TECHNICAL_REVIEW: 'Revízne správy',
  MEETING_MINUTES: 'Zápisnice',
  OTHER: 'Ostatné',
};

interface Document {
  id: string;
  category: Category;
  title: string;
  description: string | null;
  sizeBytes: number;
  mimeType: string;
  sha256: string;
  createdAt: string;
}

export function DocumentsPage() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const [items, setItems] = useState<Document[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | Category>('ALL');
  const [uploading, setUploading] = useState(false);

  async function load() {
    if (!buildingId) return;
    try {
      const r = await api<Document[]>(`/documents/building/${buildingId}`);
      setItems(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { load(); }, [buildingId]);

  async function download(doc: Document) {
    try {
      const { url } = await api<{ url: string }>(`/documents/${doc.id}/download-url`);
      window.open(url, '_blank');
    } catch (e) {
      alert('Sťahovanie zlyhalo: ' + (e as Error).message);
    }
  }

  const filtered = filter === 'ALL' ? items : items.filter((d) => d.category === filter);
  const byCat = items.reduce<Record<string, number>>((a, d) => ({ ...a, [d.category]: (a[d.category] ?? 0) + 1 }), {});

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Budova', to: `/b/${buildingId}` }, { label: 'Dokumenty' }]}
        title="Archív dokumentov"
        subtitle="Zmluvy, zápisnice, revízne správy, ročné vyúčtovania. Všetko s hash integritou."
        action={<Btn onClick={() => setUploading(true)} iconLeft={<Icon name="upload" size={16} />}>Nahrať dokument</Btn>}
      />

      {/* Category filter chips */}
      <div className="pay-filter" style={{ marginBottom: '1rem' }}>
        <button className={`pay-chip ${filter === 'ALL' ? 'active' : ''}`} onClick={() => setFilter('ALL')}>
          Všetky ({items.length})
        </button>
        {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => {
          const n = byCat[c] ?? 0;
          if (n === 0) return null;
          return (
            <button key={c} className={`pay-chip ${filter === c ? 'active' : ''}`} onClick={() => setFilter(c)}>
              {CATEGORY_LABEL[c]} ({n})
            </button>
          );
        })}
      </div>

      {err && <div role="alert" className="dp-form-error">{err}</div>}
      {!loaded && <SkeletonList n={4} />}

      {loaded && filtered.length === 0 && (
        <EmptyState
          icon={<Icon name="file" size={40} />}
          title={filter === 'ALL' ? 'Zatiaľ žiadne dokumenty' : `Žiadne dokumenty v kategórii ${CATEGORY_LABEL[filter as Category]}`}
          body="Nahrajte prvý dokument — zmluvu so správcovskou firmou, stanovy, zápisnicu z poslednej schôdze."
          action={{ label: 'Nahrať dokument', onClick: () => setUploading(true) }}
        />
      )}

      {filtered.length > 0 && (
        <Section title={filter === 'ALL' ? `${filtered.length} dokumentov` : CATEGORY_LABEL[filter as Category]}>
          {filtered.map((d) => (
            <ListItem
              key={d.id}
              icon={<Icon name="file" size={20} />}
              title={d.title}
              subtitle={
                <>
                  {d.description && <>{d.description} · </>}
                  {formatBytes(d.sizeBytes)} · {d.mimeType} · {new Date(d.createdAt).toLocaleDateString('sk-SK')}
                </>
              }
              status={<StatusPill>{CATEGORY_LABEL[d.category]}</StatusPill>}
              onClick={() => download(d)}
            />
          ))}
        </Section>
      )}

      {uploading && buildingId && (
        <UploadModal
          buildingId={buildingId}
          onClose={() => setUploading(false)}
          onSaved={async () => { setUploading(false); await load(); }}
        />
      )}
    </>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function UploadModal({
  buildingId,
  onClose,
  onSaved,
}: {
  buildingId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState<Category>('MEETING_MINUTES');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setErr('Vyberte súbor.'); return; }
    setBusy(true); setErr(null);
    try {
      // Backend endpoint je multipart s file + meta fields — použijeme vlastný FormData.
      const token = localStorage.getItem('domovplus.accessToken');
      const form = new FormData();
      form.append('file', file);
      form.append('buildingId', buildingId);
      form.append('category', category);
      form.append('title', title || file.name);
      if (description) form.append('description', description);
      const res = await fetch('/api/documents', {
        method: 'POST',
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body);
      }
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" onClick={onClose} className="modal-overlay">
      <div onClick={(e) => e.stopPropagation()} className="modal-panel">
        <div className="modal-head">
          <h2>Nahrať dokument</h2>
          <Btn variant="ghost" onClick={onClose} style={{ minHeight: 32, padding: '0 10px' }}>✕</Btn>
        </div>
        <Form
          title=""
          onSubmit={submit}
          error={err}
          actions={
            <>
              <Btn busy={busy} type="submit" disabled={!file}>
                {busy ? 'Nahrávam…' : 'Nahrať'}
              </Btn>
              <Btn variant="ghost" onClick={onClose}>Zrušiť</Btn>
            </>
          }
        >
          <Field label="Kategória" required>
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </Field>
          <Field label="Názov" required hint={'Napr. „Zmluva so SVB Správcom, január 2026"'}>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder={file?.name ?? ''} />
          </Field>
          <Field label="Popis" hint="Voliteľné — kontext pre ostatných členov">
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Súbor" required hint="PDF, obrázok, dokument — max 15 MB">
            <input
              ref={fileInput}
              type="file"
              required
              accept="application/pdf,image/*,.doc,.docx,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
        </Form>
      </div>
    </div>
  );
}
