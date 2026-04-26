/**
 * Floory mobile design tokens — zladené s webom.
 * Podporuje senior režim (väčšie písmo + hit target).
 */

export const colors = {
  bg: '#fafaf9',
  surface: '#ffffff',
  surface2: '#f5f5f4',
  border: '#e7e5e4',
  borderStrong: '#d6d3d1',
  fg: '#1c1917',
  fgMuted: '#57534e',
  fgSubtle: '#78716c',
  brand: '#0f766e',
  brandHover: '#0b5f58',
  brandSoft: '#ccfbf1',
  success: '#166534',
  successSoft: '#dcfce7',
  warning: '#b45309',
  warningSoft: '#fef3c7',
  danger: '#991b1b',
  dangerSoft: '#fee2e2',
  info: '#1e40af',
  infoSoft: '#dbeafe',
} as const;

export const radius = { sm: 10, md: 14, lg: 18, full: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export function typography(senior: boolean) {
  const scale = senior ? 1.2 : 1;
  return {
    h1: { fontSize: 26 * scale, fontWeight: '700' as const, color: colors.fg, marginBottom: 8 },
    h2: { fontSize: 19 * scale, fontWeight: '600' as const, color: colors.fg, marginTop: 16, marginBottom: 8 },
    h3: { fontSize: 17 * scale, fontWeight: '600' as const, color: colors.fg },
    body: { fontSize: 16 * scale, color: colors.fg, lineHeight: 24 * scale },
    muted: { fontSize: 14 * scale, color: colors.fgMuted },
    subtle: { fontSize: 13 * scale, color: colors.fgSubtle },
    label: { fontSize: 15 * scale, color: colors.fg, fontWeight: '500' as const, marginBottom: 6 },
  };
}

export const hitTarget = (senior: boolean) => (senior ? 56 : 48);
