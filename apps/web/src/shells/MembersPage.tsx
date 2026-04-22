/**
 * MembersPage — /b/:buildingId/ucastnici
 *
 * Správa účastníkov budovy:
 *   - Zoskupenie po rolách (Predsedovia, Správcovia, Údržbári, Vlastníci)
 *   - Pridať účastníka (email-invite alebo aktivačný kód)
 *   - Zmeniť rolu (handover predsedu)
 *   - Odobrať z budovy (s bezpečnosťou: nedá sa posledný predseda)
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { PageHeader } from '../components/PageHeader';
import { Avatar } from '../components/Avatar';
import { Btn } from '../components/Button';
import { SkeletonList } from '../components/Skeleton';
import { EmptyState, Section, StatusPill } from '../components/ui';
import { Field, Form, Row } from '../components/forms';
import { PeopleIllustration } from '../components/Illustrations';

interface Member {
  id: string;
  role: 'OWNER' | 'CHAIRMAN' | 'MANAGER' | 'MAINTENANCE' | 'ADMIN';
  apartment: { id: string; unitNumber: string } | null;
  user: { id: string; email: string; firstName: string; lastName: string; totpEnabled: boolean; lastLoginAt: string | null } | null;
  verifiedAt: string | null;
  pendingActivationCode: string | null;
  createdAt: string;
  isYou: boolean;
}

const ROLES: Member['role'][] = ['CHAIRMAN', 'MANAGER', 'MAINTENANCE', 'OWNER', 'ADMIN'];
const ROLE_LABEL: Record<Member['role'], string> = {
  CHAIRMAN: 'Predsedovia',
  MANAGER: 'Správcovia',
  MAINTENANCE: 'Údržbári',
  OWNER: 'Vlastníci',
  ADMIN: 'Administrátori',
};
const ROLE_TONE: Record<Member['role'], 'info' | 'ok' | 'pending' | 'neutral' | 'urgent'> = {
  CHAIRMAN: 'info',
  MANAGER: 'info',
  MAINTENANCE: 'pending',
  OWNER: 'ok',
  ADMIN: 'urgent',
};

export function MembersPage() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const [items, setItems] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    if (!buildingId) return;
    try {
      const r = await api<Member[]>(`/buildings/${buildingId}/members`);
      setItems(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => { load(); }, [buildingId]);

  async function changeRole(m: Member, newRole: Member['role']) {
    if (newRole === m.role) return;
    if (!confirm(`Zmeniť rolu ${m.user?.firstName ?? '—'} z ${ROLE_LABEL[m.role].slice(0, -1).toLowerCase()} na ${ROLE_LABEL[newRole].slice(0, -1).toLowerCase()}?`)) return;
    try {
      await api(`/buildings/${buildingId}/members/${m.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      await load();
    } catch (e) {
      alert('Chyba: ' + (e as Error).message);
    }
  }

  async function removeMember(m: Member) {
    const who = m.user ? `${m.user.firstName} ${m.user.lastName}` : 'nezaregistrovaný člen';
    if (!confirm(`Odobrať ${who} (${ROLE_LABEL[m.role].slice(0, -1)}) z budovy?`)) return;
    try {
      await api(`/buildings/${buildingId}/members/${m.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      alert('Chyba: ' + (e as Error).message);
    }
  }

  const grouped = ROLES.map((r) => ({ role: r, members: items.filter((m) => m.role === r) })).filter((g) => g.members.length > 0);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Budova', to: `/b/${buildingId}` }, { label: 'Účastníci' }]}
        title="Správa účastníkov budovy"
        subtitle="Predsedovia, správcovia, údržbári a vlastníci. Pridajte nových, zmeňte role, odovzdajte predsedníctvo."
        action={<Btn onClick={() => setAdding(true)}>+ Pridať účastníka</Btn>}
      />

      {err && <div role="alert" className="dp-form-error">{err}</div>}
      {!loaded && <SkeletonList n={5} />}
      {loaded && items.length === 0 && (
        <EmptyState
          icon={<PeopleIllustration size={96} />}
          title="Zatiaľ žiadni účastníci"
          body="Pridajte prvého údržbára, správcu alebo druhého predsedu."
          action={{ label: '+ Pridať účastníka', onClick: () => setAdding(true) }}
        />
      )}

      {grouped.map(({ role, members }) => (
        <Section key={role} title={`${ROLE_LABEL[role]} (${members.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {members.map((m) => (
              <div key={m.id} className="member-row">
                <Avatar
                  name={m.user ? `${m.user.firstName} ${m.user.lastName}` : undefined}
                  email={m.user?.email ?? m.pendingActivationCode ?? '?'}
                  size={40}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {m.user ? (
                    <>
                      <div style={{ fontWeight: 600 }}>
                        {m.user.firstName} {m.user.lastName}
                        {m.isYou && <StatusPill tone="info" dot>Vy</StatusPill>}
                        {m.user.totpEnabled && <span title="2FA zapnuté" style={{ marginLeft: 8 }}>🔐</span>}
                      </div>
                      <div className="inline-meta">
                        {m.user.email}
                        {m.apartment && <> · byt {m.apartment.unitNumber}</>}
                        {m.user.lastLoginAt && <> · posledné prihlásenie {new Date(m.user.lastLoginAt).toLocaleDateString('sk-SK')}</>}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontWeight: 600, color: 'var(--pending)' }}>Čaká na registráciu</div>
                      <div className="inline-meta">
                        {m.apartment && <>byt {m.apartment.unitNumber} · </>}kód: <code>{m.pendingActivationCode}</code>
                      </div>
                    </>
                  )}
                </div>
                <div className="member-actions">
                  {m.user && !m.isYou && (
                    <select
                      value={m.role}
                      onChange={(e) => changeRole(m, e.target.value as Member['role'])}
                      aria-label="Zmeniť rolu"
                      style={{ minHeight: 32, padding: '4px 10px', fontSize: 12, margin: 0 }}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABEL[r].replace(/ovia$|ári$|íci$|i$/, '')}</option>
                      ))}
                    </select>
                  )}
                  <Btn variant="ghost" onClick={() => removeMember(m)} style={{ minHeight: 32, padding: '0 10px', fontSize: 12, color: 'var(--urgent)' }}>
                    Odobrať
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        </Section>
      ))}

      {adding && buildingId && (
        <AddMemberModal
          buildingId={buildingId}
          onClose={() => setAdding(false)}
          onSaved={async () => { setAdding(false); await load(); }}
        />
      )}
    </>
  );
}

function AddMemberModal({
  buildingId,
  onClose,
  onSaved,
}: {
  buildingId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<{ role: Member['role']; email: string; inviteName: string }>({
    role: 'MAINTENANCE',
    email: '',
    inviteName: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ activationCode: string | null; linkedUser: any } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await api<any>(`/buildings/${buildingId}/members`, {
        method: 'POST',
        body: JSON.stringify({
          role: form.role,
          email: form.email || undefined,
          inviteName: form.inviteName || undefined,
        }),
      });
      setResult(r);
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
          <h2>Pridať účastníka</h2>
          <Btn variant="ghost" onClick={onClose} style={{ minHeight: 32, padding: '0 10px' }}>✕</Btn>
        </div>
        {result ? (
          <div style={{ padding: '1rem 0' }}>
            {result.linkedUser ? (
              <>
                <StatusPill tone="ok">Pridaný existujúci účet</StatusPill>
                <p style={{ marginTop: 12 }}>
                  <strong>{result.linkedUser.firstName} {result.linkedUser.lastName}</strong> ({result.linkedUser.email})
                  bol/a priradená do budovy. Dostane email s notifikáciou.
                </p>
              </>
            ) : (
              <>
                <StatusPill tone="pending">Čaká na registráciu</StatusPill>
                <p style={{ marginTop: 12 }}>Aktivačný kód:</p>
                <div className="code-display">
                  <code>{result.activationCode}</code>
                  <Btn variant="ghost" onClick={() => navigator.clipboard?.writeText(result.activationCode ?? '')}>Kopírovať</Btn>
                </div>
                <div style={{ marginTop: 16, padding: '0.875rem 1rem', background: 'var(--brand-soft)', border: '1px solid var(--brand)', borderRadius: 10 }}>
                  <strong style={{ color: 'var(--brand)' }}>Odkaz na aktiváciu (pošlite SMS / emailom):</strong>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                    <code style={{ flex: 1, padding: '6px 8px', background: 'var(--surface)', borderRadius: 6, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {`${location.origin}/aktivacia/${result.activationCode}`}
                    </code>
                    <Btn
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard?.writeText(`${location.origin}/aktivacia/${result.activationCode}`);
                        alert('Odkaz skopírovaný.');
                      }}
                      style={{ minHeight: 32, padding: '0 10px', fontSize: 12 }}
                    >
                      Kopírovať
                    </Btn>
                  </div>
                </div>
                {form.email && <p className="inline-meta" style={{ marginTop: 8 }}>Pozvánka bola automaticky odoslaná na {form.email}.</p>}
              </>
            )}
            <div className="form-actions" style={{ marginTop: 16 }}>
              <Btn onClick={onSaved}>Hotovo</Btn>
            </div>
          </div>
        ) : (
          <Form title="" onSubmit={submit} error={err} actions={
            <>
              <Btn busy={busy} type="submit">{busy ? 'Posielam…' : 'Vytvoriť účastníka'}</Btn>
              <Btn variant="ghost" onClick={onClose}>Zrušiť</Btn>
            </>
          }>
            <Field label="Rola" required hint="Vlastníka pridajte cez Evidenciu bytov — tam priamo generujete kód pre konkrétny byt">
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Member['role'] })}>
                <option value="MAINTENANCE">Údržbár</option>
                <option value="CHAIRMAN">Predseda (druhý)</option>
                <option value="MANAGER">Správca</option>
              </select>
            </Field>
            <Field label="Meno (pre oslovenie v e-maile)" hint="Voliteľné">
              <input value={form.inviteName} onChange={(e) => setForm({ ...form, inviteName: e.target.value })} placeholder="Marek Novák" />
            </Field>
            <Field label="Email" hint="Ak má už účet v DomovPlus, priradí sa priamo. Ak nemá, pošleme pozvánku s kódom.">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="marek@priklad.sk" />
            </Field>
          </Form>
        )}
      </div>
    </div>
  );
}
