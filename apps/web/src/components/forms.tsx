/**
 * Form building blocks — centralizované, s podporou inline validácie.
 *
 * `<Field label error={...} hint>` — červený border + chybová hláška pod input-om.
 * `<Form>` vrchný wrapper; starý `error` prop stále funguje (globálny banner pod formom).
 */
import { ReactNode } from 'react';

export function Form({
  title,
  description,
  onSubmit,
  children,
  actions,
  error,
}: {
  title: string;
  description?: string;
  onSubmit: (e: React.FormEvent) => void;
  children: ReactNode;
  actions: ReactNode;
  error?: string | null;
}) {
  return (
    <div style={{ maxWidth: 640 }}>
      {title && (
        <h1 style={{ margin: '0 0 0.25rem', fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', fontWeight: 700, letterSpacing: '-0.02em' }}>
          {title}
        </h1>
      )}
      {description && <p style={{ color: 'var(--fg-muted)', marginTop: 0, marginBottom: '1.5rem' }}>{description}</p>}
      <form
        onSubmit={onSubmit}
        className="dp-form"
      >
        {children}
        {error && (
          <div role="alert" className="dp-form-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M10.3 2.8 2 17a1 1 0 0 0 .9 1.5h18.2a1 1 0 0 0 .9-1.5L13.7 2.8a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        <div className="form-actions">
          {actions}
        </div>
      </form>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`dp-field ${error ? 'dp-field-error' : ''}`}>
      <span className="dp-field-label">
        {label}
        {required && <span className="dp-field-req" aria-hidden="true">*</span>}
      </span>
      {children}
      {error ? (
        <span className="dp-field-msg dp-field-msg-err" role="alert">{error}</span>
      ) : hint ? (
        <span className="dp-field-msg dp-field-msg-hint">{hint}</span>
      ) : null}
    </label>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="dp-form-row">{children}</div>;
}
