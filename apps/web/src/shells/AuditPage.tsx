/**
 * AuditPage — /b/:buildingId/audit
 *
 * Časová os všetkých eventov budovy + verification hash-chain.
 * Plnohodnotný dôkaz: kto čo spravil a kedy; záznamy sa nedajú spätne meniť
 * (SHA-256 hash reťaz vygenerovaná AuditService).
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { PageHeader } from '../components/PageHeader';
import { SkeletonList } from '../components/Skeleton';
import { Avatar } from '../components/Avatar';
import { StatusPill } from '../components/ui';

interface AuditItem {
  id: string;
  occurredAt: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actor: { name: string; email: string } | null;
  actorSystemName: string | null;
  payload: any;
  hash: string;
  prevHash: string | null;
}

const ACTION_LABEL: Record<string, string> = {
  USER_LOGIN: 'Prihlásenie',
  USER_REGISTERED: 'Registrácia účtu',
  ADMIN_REGISTERED: 'Registrácia správcu',
  BUILDING_CREATED: 'Budova vytvorená',
  APARTMENT_CREATED: 'Byt pridaný',
  APARTMENT_UPDATED: 'Byt upravený',
  APARTMENT_DELETED: 'Byt vymazaný',
  APARTMENTS_IMPORTED: 'Import bytov z Excelu',
  MEMBERSHIP_CREATED: 'Účastník pridaný',
  MEMBERSHIP_ROLE_CHANGED: 'Zmena roly',
  MEMBERSHIP_REMOVED: 'Účastník odobraný',
  ACTIVATION_CODE_ISSUED: 'Aktivačný kód vygenerovaný',
  ACTIVATION_CODE_REGENERATED: 'Aktivačný kód obnovený',
  VOTING_CREATED: 'Hlasovanie vytvorené',
  VOTING_OPENED: 'Hlasovanie otvorené',
  VOTING_CLOSED: 'Hlasovanie uzavreté',
  VOTING_AUTO_CLOSED: 'Hlasovanie automaticky uzavreté',
  VOTING_CAST: 'Hlas odovzdaný',
  VOTING_XADES_SIGNED: 'Zápisnica XAdES podpísaná',
  MEETING_CREATED: 'Schôdza naplánovaná',
  MEETING_MINUTES_UPLOADED: 'Zápisnica nahraná',
  TICKET_CREATED: 'Porucha nahlásená',
  TICKET_STATUS_CHANGED: 'Zmena stavu poruchy',
  INVOICE_CREATED: 'Faktúra vystavená',
  INVOICES_BULK_ISSUED: 'Mesačná dávka faktúr',
  INVOICE_PAID: 'Faktúra zaplatená',
  PAYMENT_REMINDER_SENT: 'Upomienka poslaná',
  BANK_IMPORT_PROCESSED: 'Import výpisu z banky',
  BANK_FEED_IMPORTED: 'Import výpisu z banky',
  DOCUMENT_UPLOADED: 'Dokument nahraný',
  DOCUMENT_DOWNLOADED: 'Dokument stiahnutý',
  ANNOUNCEMENT_PUBLISHED: 'Oznam uverejnený',
  REVISION_SCHEDULED: 'Revízia naplánovaná',
  REVISION_COMPLETED: 'Revízia splnená',
  CLASSIFIED_CREATED: 'Inzerát v burze',
  LEAD_SUBMITTED: 'Lead z landing page',
  TOTP_RECOVERY_CODES_GENERATED: 'Vygenerované 2FA záložné kódy',
  TOTP_RECOVERY_CODE_USED: 'Použitý 2FA záložný kód',
  SESSION_REVOKED: 'Session zrušená',
  GDPR_EXPORT: 'GDPR export údajov',
  GDPR_DELETE: 'GDPR zmazanie účtu',
  PASSWORD_RESET_REQUESTED: 'Žiadosť o obnovu hesla',
  PASSWORD_RESET_COMPLETED: 'Heslo obnovené',
  USER_TOTP_ENABLED: '2FA zapnuté',
};

const ACTION_ICON: Record<string, string> = {
  USER_LOGIN: '🔓',
  BUILDING_CREATED: '🏢',
  APARTMENT_CREATED: '🏢',
  APARTMENTS_IMPORTED: '📥',
  MEMBERSHIP_CREATED: '👤',
  MEMBERSHIP_ROLE_CHANGED: '🔄',
  MEMBERSHIP_REMOVED: '🚪',
  VOTING_CREATED: '🗳️',
  VOTING_CLOSED: '✅',
  VOTING_XADES_SIGNED: '✍️',
  MEETING_CREATED: '📅',
  TICKET_CREATED: '🔧',
  INVOICE_CREATED: '🧾',
  INVOICES_BULK_ISSUED: '📑',
  INVOICE_PAID: '💶',
  PAYMENT_REMINDER_SENT: '📨',
  ANNOUNCEMENT_PUBLISHED: '📢',
  REVISION_SCHEDULED: '🛠️',
  REVISION_COMPLETED: '✅',
};

export function AuditPage() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const [items, setItems] = useState<AuditItem[] | null>(null);
  const [chain, setChain] = useState<{ valid: boolean; brokenAt?: string } | null>(null);

  useEffect(() => {
    if (!buildingId) return;
    api<AuditItem[]>(`/audit/building/${buildingId}`).then(setItems).catch(() => setItems([]));
    api<{ valid: boolean; brokenAt?: string }>(`/audit/verify`).then(setChain).catch(() => setChain(null));
  }, [buildingId]);

  const grouped = groupByDay(items ?? []);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Budova', to: `/b/${buildingId}` }, { label: 'Auditná stopa' }]}
        title="Auditná stopa budovy"
        subtitle="Nemenný záznam každej akcie. Každý event je SHA-256 hash spojený s predošlým — zmena sa okamžite prejaví v overení reťaze."
        action={
          chain ? (
            chain.valid ? <StatusPill tone="ok" dot>Reťaz overená</StatusPill>
            : <StatusPill tone="urgent" dot>Reťaz narušená pri {chain.brokenAt?.slice(0, 8)}</StatusPill>
          ) : null
        }
      />

      {!items && <SkeletonList n={6} />}
      {items && items.length === 0 && (
        <p className="inline-meta">Žiadne udalosti pre túto budovu.</p>
      )}

      <div className="audit-timeline">
        {Object.entries(grouped).map(([day, evs]) => (
          <div key={day} className="audit-day">
            <div className="audit-day-label">{day}</div>
            {evs.map((e) => {
              const label = ACTION_LABEL[e.action] ?? e.action;
              const icon = ACTION_ICON[e.action] ?? '•';
              return (
                <div key={e.id} className="audit-event">
                  <div className="audit-dot" aria-hidden="true">{icon}</div>
                  <div className="audit-body">
                    <div className="audit-head">
                      <strong>{label}</strong>
                      <span className="inline-meta">
                        {new Date(e.occurredAt).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="audit-meta">
                      {e.actor ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Avatar name={e.actor.name} email={e.actor.email} size={20} />
                          {e.actor.name}
                        </span>
                      ) : (
                        <span className="inline-meta">systém</span>
                      )}
                      <span className="inline-meta">· {e.resourceType}</span>
                      {e.payload && Object.keys(e.payload).length > 0 && (
                        <details style={{ marginTop: 4 }}>
                          <summary className="inline-meta" style={{ cursor: 'pointer' }}>detail</summary>
                          <pre className="audit-payload">{JSON.stringify(e.payload, null, 2)}</pre>
                        </details>
                      )}
                      <code className="inline-meta" style={{ fontSize: 10, display: 'block', marginTop: 4 }}>
                        hash {e.hash.slice(0, 16)}…
                      </code>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

function groupByDay(items: AuditItem[]) {
  const g: Record<string, AuditItem[]> = {};
  for (const e of items) {
    const d = new Date(e.occurredAt).toLocaleDateString('sk-SK', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    (g[d] = g[d] ?? []).push(e);
  }
  return g;
}
