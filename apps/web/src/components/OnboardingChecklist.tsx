/**
 * OnboardingChecklist — interaktívny sprievodca pre predsedu/správcu,
 * aby vedel čo ďalej po prvom prihlásení.
 *
 * Kritériá sú odvodené z admin-stats a zobrazené ako zoznam 4 krokov:
 *  1. Pridajte byty (apartmentsCount > 0)
 *  2. Distribuujte aktivačné kódy (vidno PDF gombík)
 *  3. Zaregistrujte vlastníkov (registrationRate ≥ 50 %)
 *  4. Uverejnite prvý oznam (totalAnnouncements > 0)
 *
 * Zobrazuje sa iba pokiaľ nie sú všetky splnené.
 */
import { Link } from 'react-router-dom';

interface Stats {
  apartmentsCount: number;
  registeredOwners: number;
  registrationRate: number;
  pendingActivationCodes: number;
  totalAnnouncements: number;
  totalClosedVotings: number;
}

export function OnboardingChecklist({
  buildingId,
  stats,
}: {
  buildingId: string;
  stats: Stats;
}) {
  const steps = [
    {
      done: stats.apartmentsCount > 0,
      title: 'Pridajte byty do budovy',
      body:
        stats.apartmentsCount > 0
          ? `Hotovo — v evidencii máte ${stats.apartmentsCount} bytov.`
          : 'Nahrajte Excel so zoznamom bytov alebo pridajte byty ručne.',
      action: {
        label: stats.apartmentsCount > 0 ? 'Upraviť byty' : 'Pridať byty',
        to: stats.apartmentsCount > 0 ? `/b/${buildingId}/byty` : `/b/${buildingId}/nastavenia`,
      },
    },
    {
      done: stats.apartmentsCount > 0 && stats.pendingActivationCodes === 0 && stats.registeredOwners > 0,
      skip: stats.apartmentsCount === 0,
      title: 'Rozdajte aktivačné kódy vlastníkom',
      body:
        stats.pendingActivationCodes > 0
          ? `${stats.pendingActivationCodes} ${stats.pendingActivationCodes === 1 ? 'kód čaká' : 'kódov čaká'} na doručenie. Stiahnite PDF a vytlačte ich do schránok.`
          : 'Všetky kódy sú rozdistribuované.',
      action: {
        label: 'Stiahnuť PDF kódov',
        to: `/b/${buildingId}/nastavenia`,
      },
    },
    {
      done: stats.registrationRate >= 0.5,
      skip: stats.apartmentsCount === 0,
      title: 'Zaregistrujte aspoň 50 % vlastníkov',
      body:
        stats.registrationRate >= 0.5
          ? `Máte ${Math.round(stats.registrationRate * 100)} % registrovaných — super.`
          : `Aktuálne ${Math.round(stats.registrationRate * 100)} % — povzbuďte susedov, aby si stiahli aplikáciu.`,
      action: {
        label: 'Pozrieť stav registrácií',
        to: `/b/${buildingId}/byty`,
      },
    },
    {
      done: stats.totalAnnouncements > 0,
      title: 'Uverejnite prvý oznam',
      body:
        stats.totalAnnouncements > 0
          ? 'Digitálna nástenka už žije.'
          : 'Napríklad: „Vitajte v našej novej appke. Odteraz nájdete všetko na jednom mieste."',
      action: { label: 'Napísať oznam', to: `/b/${buildingId}/oznamy/nova` },
    },
  ];

  const visible = steps.filter((s) => !s.skip);
  const completed = visible.filter((s) => s.done).length;

  if (completed === visible.length) return null;

  return (
    <section className="dp-section" aria-labelledby="ob-h">
      <div className="oc">
        <div className="oc-head">
          <h2 id="ob-h" className="oc-title">Sprievodca rozbehom</h2>
          <span className="oc-progress">{completed}/{visible.length} splnených</span>
        </div>
        <div className="oc-bar" aria-hidden="true">
          <div className="oc-bar-fill" style={{ width: `${(completed / visible.length) * 100}%` }} />
        </div>
        <ol className="oc-list">
          {visible.map((s, i) => (
            <li key={i} className={`oc-item ${s.done ? 'done' : ''}`}>
              <div className={`oc-num ${s.done ? 'done' : ''}`}>
                {s.done ? '✓' : i + 1}
              </div>
              <div className="oc-body">
                <div className="oc-it-title">{s.title}</div>
                <div className="oc-it-desc">{s.body}</div>
              </div>
              {!s.done && (
                <Link to={s.action.to} className="ui-btn ui-btn-primary oc-action">
                  {s.action.label} →
                </Link>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
