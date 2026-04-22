/**
 * Btn — unified button s loading spinnerom a icon slotmi.
 *
 *   <Btn busy>Ukladám</Btn>
 *   <Btn variant="ghost" iconLeft={<Icon name="plus" />}>Pridať</Btn>
 *   <Btn variant="danger" onClick={...}>Vymazať</Btn>
 *
 * Staré <button className="ui-btn ui-btn-primary"> ostávajú funkčné —
 * tento komponent pridáva disabled-during-busy + inline spinner.
 */
import { ButtonHTMLAttributes, ReactNode } from 'react';

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="spinner">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Variant = 'primary' | 'ghost' | 'danger';

export interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  busy?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
}

export function Btn({
  variant = 'primary',
  busy,
  iconLeft,
  iconRight,
  block,
  disabled,
  children,
  className = '',
  ...rest
}: BtnProps) {
  const cls =
    variant === 'primary' ? 'ui-btn ui-btn-primary'
    : variant === 'danger' ? 'ui-btn ui-btn-primary ui-btn-danger'
    : 'ui-btn ui-btn-ghost';
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      className={`${cls} ${block ? 'ui-btn-block' : ''} ${className}`.trim()}
      aria-busy={busy || undefined}
    >
      {busy ? <Spinner size={16} /> : iconLeft}
      <span>{children}</span>
      {!busy && iconRight}
    </button>
  );
}
