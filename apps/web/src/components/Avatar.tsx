/**
 * Avatar — kruhové koliesko s iniciálmi a deterministickou farbou
 * odvodenou z hashu emailu/mena. Bez externej knižnice.
 */

const PALETTE = [
  '#0f766e', '#0369a1', '#7c3aed', '#db2777',
  '#ea580c', '#b45309', '#065f46', '#1e40af',
  '#6d28d9', '#9d174d', '#854d0e', '#047857',
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function Avatar({
  name,
  email,
  size = 32,
}: {
  name?: string;
  email?: string;
  size?: number;
}) {
  const source = (email || name || '??').trim();
  const initials = (name ?? email ?? '?')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';
  const color = PALETTE[hash(source.toLowerCase()) % PALETTE.length];
  return (
    <span
      aria-hidden="true"
      className="avatar"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: Math.round(size * 0.4),
      }}
    >
      {initials}
    </span>
  );
}
