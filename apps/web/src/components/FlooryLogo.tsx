/**
 * Floory logo — React komponenty pre brand identity.
 *
 * Tokens: floory-tokens.css definuje --floory-500 (primárna značková farba)
 * + --ink-900 pre wordmark. Override cez `color` / `wordmarkColor` props.
 *
 *   <FlooryLogo size={28} />                          — full lockup
 *   <FlooryLogo size={32} color="white" wordmarkColor="white" />  — na tmavom
 *   <FloorySymbol size={20} />                        — len symbol (favicon-like)
 *   <FlooryWordmark size={24} />                      — len text
 *
 * Brand pravidlá (z handoff/README.md):
 *   - Symbol = 4 horizontálne pásy s opacity 0.32 / 0.55 / 0.78 / 1.0
 *     (metafora poschodí — bytovka „naplnená" aktivitou)
 *   - Aspect ratio symbolu: 1:1 vždy — nikdy nedeformovať
 *   - Minimálna veľkosť: 16 px
 */
import type { CSSProperties, HTMLAttributes, SVGProps } from 'react';

interface SymbolProps extends Omit<SVGProps<SVGSVGElement>, 'color'> {
  size?: number;
  color?: string;
}

export function FloorySymbol({ size = 48, color, style, ...rest }: SymbolProps) {
  const c = color || 'var(--floory-500, #6B5BB8)';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      aria-hidden="true"
      {...rest}
    >
      <rect x="8" y="10" width="32" height="5" rx="1.5" fill={c} opacity="0.32" />
      <rect x="8" y="18" width="32" height="5" rx="1.5" fill={c} opacity="0.55" />
      <rect x="8" y="26" width="32" height="5" rx="1.5" fill={c} opacity="0.78" />
      <rect x="8" y="34" width="32" height="5" rx="1.5" fill={c} />
    </svg>
  );
}

interface WordmarkProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'> {
  size?: number;
  color?: string;
}

export function FlooryWordmark({ size = 32, color, style, ...rest }: WordmarkProps) {
  const c = color || 'var(--ink-900, #1A1726)';
  return (
    <span
      style={{
        fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
        fontWeight: 600,
        letterSpacing: '-0.03em',
        fontSize: size,
        lineHeight: 1,
        color: c,
        ...style,
      }}
      {...rest}
    >
      Floory
    </span>
  );
}

interface LogoProps extends Omit<HTMLAttributes<HTMLDivElement>, 'color'> {
  size?: number;
  color?: string;
  wordmarkColor?: string;
  /** Iba symbol bez wordmarku (kompaktnejšie pre topbar). */
  symbolOnly?: boolean;
}

export function FlooryLogo({
  size = 32,
  color,
  wordmarkColor,
  symbolOnly,
  style,
  ...rest
}: LogoProps) {
  const flexStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: size * 0.32,
    ...style,
  };
  return (
    <div style={flexStyle} {...rest}>
      <FloorySymbol size={size * 1.05} color={color} />
      {!symbolOnly && <FlooryWordmark size={size * 0.95} color={wordmarkColor} />}
    </div>
  );
}
