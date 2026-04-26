/**
 * Floory — Canonical UI components
 *
 * Každá karta, tlačidlo a status v aplikácii má prejsť cez tento súbor.
 * Cieľ: konzistentný vizuál naprieč rolami (predseda / vlastník / správca)
 * a možnosť globálne zmeniť motion / farby / radius bez hľadania po stovkách miest.
 */
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Severity = 'urgent' | 'pending' | 'ok' | 'info';

/* ------------------------- AttentionCard ------------------------- */
/**
 * Veľká karta na dashboard "Čo ti čaká na rozhodnutie?".
 * Používa sa v ChairmanShell AttentionRow a v ResidentShell dashboarde.
 */
export function AttentionCard({
  severity = 'info',
  icon,
  title,
  meta,
  body,
  primaryAction,
  secondaryAction,
  onClick,
  footer,
}: {
  severity?: Severity;
  icon?: ReactNode;
  title: string;
  meta?: string;
  body?: ReactNode;
  primaryAction?: { label: string; to?: string; onClick?: () => void };
  secondaryAction?: { label: string; to?: string; onClick?: () => void };
  onClick?: () => void;
  footer?: ReactNode;
}) {
  const Wrapper: any = onClick ? 'button' : 'article';
  return (
    <Wrapper
      className={`ac ac-${severity}`}
      {...(onClick ? { onClick, type: 'button' } : {})}
    >
      <div className="ac-head">
        {icon && <div className="ac-icon">{icon}</div>}
        <div className="ac-title-block">
          {meta && <div className="ac-meta">{meta}</div>}
          <h3 className="ac-title">{title}</h3>
        </div>
      </div>
      {body && <div className="ac-body">{body}</div>}
      {(primaryAction || secondaryAction) && (
        <div className="ac-actions">
          {primaryAction && <ActionButton primary action={primaryAction} />}
          {secondaryAction && <ActionButton action={secondaryAction} />}
        </div>
      )}
      {footer && <div className="ac-footer">{footer}</div>}
    </Wrapper>
  );
}

function ActionButton({
  action,
  primary,
}: {
  action: { label: string; to?: string; onClick?: () => void };
  primary?: boolean;
}) {
  const cls = primary ? 'ui-btn ui-btn-primary' : 'ui-btn ui-btn-ghost';
  if (action.to) {
    return (
      <Link to={action.to} className={cls}>
        {action.label}
      </Link>
    );
  }
  return (
    <button className={cls} onClick={action.onClick} type="button">
      {action.label}
    </button>
  );
}

/* ------------------------------ KPITile ------------------------------ */
/**
 * Veľké číslo + popis + delta šípka. Používa sa v health strip (chairman)
 * a portfolio prehľade (manager).
 */
export function KPITile({
  label,
  value,
  delta,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  delta?: { direction: 'up' | 'down' | 'flat'; text: string };
  hint?: string;
  tone?: 'neutral' | 'ok' | 'pending' | 'urgent';
}) {
  return (
    <div className={`kpi kpi-${tone}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {delta && (
        <div className={`kpi-delta kpi-delta-${delta.direction}`}>
          <span aria-hidden="true">
            {delta.direction === 'up' ? '↑' : delta.direction === 'down' ? '↓' : '→'}
          </span>
          {delta.text}
        </div>
      )}
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

/* ----------------------------- StatusPill ---------------------------- */
export function StatusPill({
  tone = 'neutral',
  children,
  dot = false,
}: {
  tone?: 'neutral' | 'ok' | 'pending' | 'urgent' | 'info';
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span className={`pill pill-${tone}`}>
      {dot && <span className="pill-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

/* ----------------------------- ListItem ------------------------------ */
/**
 * Jednotný riadok pre zoznamy (faktúry, tikety, schôdze).
 * Zachováva čítateľnosť a hit-target aj v seniorskom režime.
 */
export function ListItem({
  icon,
  title,
  subtitle,
  status,
  trailing,
  to,
  onClick,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  trailing?: ReactNode;
  to?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      {icon && <div className="li-icon">{icon}</div>}
      <div className="li-main">
        <div className="li-title">{title}</div>
        {subtitle && <div className="li-sub">{subtitle}</div>}
      </div>
      {status && <div className="li-status">{status}</div>}
      {trailing && <div className="li-trailing">{trailing}</div>}
    </>
  );
  if (to) {
    return (
      <Link to={to} className="li li-interactive">
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className="li li-interactive" onClick={onClick}>
        {inner}
      </button>
    );
  }
  return <div className="li">{inner}</div>;
}

/* ----------------------------- ActionRow ----------------------------- */
/**
 * Vždy viditeľné rýchle akcie na dashboarde (Chairman).
 * Max 3 CTA, primárne tlačidlo najviac jedno.
 */
export function ActionRow({
  actions,
}: {
  actions: Array<{ label: string; to?: string; onClick?: () => void; icon?: ReactNode; primary?: boolean }>;
}) {
  return (
    <div className="action-row">
      {actions.map((a, i) => {
        const cls = `ui-btn ${a.primary ? 'ui-btn-primary' : 'ui-btn-ghost'}`;
        const content = (
          <>
            {a.icon && <span className="ui-btn-icon" aria-hidden="true">{a.icon}</span>}
            <span>{a.label}</span>
          </>
        );
        if (a.to) {
          return (
            <Link key={i} to={a.to} className={cls}>
              {content}
            </Link>
          );
        }
        return (
          <button key={i} type="button" className={cls} onClick={a.onClick}>
            {content}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------- EmptyState ---------------------------- */
export function EmptyState({
  icon,
  title,
  body,
  action,
  tone = 'neutral',
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: { label: string; to?: string; onClick?: () => void };
  tone?: 'neutral' | 'success';
}) {
  return (
    <div className={`empty-state empty-state-${tone}`}>
      {icon && <div className="empty-state-icon">{icon}</div>}
      <h3 className="empty-state-title">{title}</h3>
      {body && <p className="empty-state-body">{body}</p>}
      {action && (
        <div className="empty-state-action">
          <ActionButton primary action={action} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Section ------------------------------ */
/**
 * Konzistentná sekcia s nadpisom + voliteľnou akciou vpravo.
 */
export function Section({
  title,
  action,
  extra,
  children,
}: {
  title: string;
  action?: { label: string; to?: string; onClick?: () => void };
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="dp-section">
      <header className="dp-section-head">
        <h2 className="dp-section-title">{title}</h2>
        {extra}
        {action && <ActionButton action={action} />}
      </header>
      {children}
    </section>
  );
}

/* ------------------------------ Greeting ----------------------------- */
export function Greeting({
  firstName,
  subtitle,
}: {
  firstName: string;
  subtitle?: string;
}) {
  const hour = new Date().getHours();
  const g = hour < 11 ? 'Dobré ráno' : hour < 18 ? 'Dobrý deň' : 'Dobrý večer';
  return (
    <div className="greeting">
      <h1 className="greeting-h">
        {g}, {firstName}.
      </h1>
      {subtitle && <p className="greeting-sub">{subtitle}</p>}
    </div>
  );
}
