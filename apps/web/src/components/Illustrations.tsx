/**
 * Hand-drawn style SVG ilustrácie pre empty states.
 * Monochromatické, používajú currentColor — ladia so seniormode + dark mode.
 */

const baseProps = {
  viewBox: '0 0 120 120',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function BuildingIllustration({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...baseProps}>
      <rect x="30" y="34" width="60" height="60" rx="2" />
      <path d="M30 48h60M30 62h60M30 76h60" opacity="0.5" />
      <rect x="40" y="40" width="8" height="6" fill="currentColor" opacity="0.25" />
      <rect x="56" y="40" width="8" height="6" fill="currentColor" opacity="0.25" />
      <rect x="72" y="40" width="8" height="6" fill="currentColor" opacity="0.25" />
      <rect x="40" y="54" width="8" height="6" fill="currentColor" opacity="0.25" />
      <rect x="56" y="54" width="8" height="6" fill="currentColor" opacity="0.25" />
      <rect x="72" y="54" width="8" height="6" fill="currentColor" opacity="0.25" />
      <rect x="40" y="68" width="8" height="6" fill="currentColor" opacity="0.25" />
      <rect x="56" y="68" width="8" height="6" fill="currentColor" opacity="0.25" />
      <rect x="72" y="68" width="8" height="6" fill="currentColor" opacity="0.25" />
      <rect x="55" y="82" width="10" height="12" opacity="0.5" />
      <path d="M22 94h76" />
      <path d="M34 34 60 18l26 16" opacity="0.7" />
    </svg>
  );
}

export function VoteIllustration({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...baseProps}>
      <rect x="26" y="36" width="56" height="64" rx="4" />
      <path d="M34 50h34M34 58h24M34 66h30" opacity="0.45" />
      <path d="M42 78l6 6 14-14" strokeWidth="2.5" />
      <path d="M68 26 88 40l-6 10" />
      <path d="M82 50l6-4" />
      <circle cx="94" cy="22" r="2" opacity="0.5" />
      <circle cx="88" cy="16" r="1.5" opacity="0.4" />
    </svg>
  );
}

export function InvoiceIllustration({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...baseProps}>
      <path d="M30 14h45l15 15v65a4 4 0 0 1-4 4H30a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z" />
      <path d="M75 14v15h15" opacity="0.5" />
      <path d="M36 44h30M36 54h40M36 64h40M36 74h24" opacity="0.45" />
      <rect x="68" y="72" width="14" height="14" rx="1" />
      <path d="M70 75h2M72 75v2M74 77v-2M76 75h2M78 77v-2M80 75v2M70 79h2M72 79v2M74 81v-2M76 81v-2M78 79h2M80 79v2" opacity="0.7" />
    </svg>
  );
}

export function BellIllustration({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...baseProps}>
      <path d="M40 54c0-11 9-20 20-20s20 9 20 20c0 16 7 22 7 22H33s7-6 7-22z" />
      <path d="M54 86a6 6 0 0 0 12 0" />
      <circle cx="86" cy="30" r="6" fill="currentColor" opacity="0.15" />
      <path d="M86 24v6l4 2" opacity="0.5" />
    </svg>
  );
}

export function WrenchIllustration({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...baseProps}>
      <path d="M72 40a12 12 0 0 1-16 16l-28 28-8-8 28-28a12 12 0 0 1 16-16l-6 6 4 4 6-6 4 4z" />
      <circle cx="30" cy="86" r="2" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

export function PeopleIllustration({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...baseProps}>
      <circle cx="40" cy="42" r="10" />
      <path d="M22 82a18 18 0 0 1 36 0" />
      <circle cx="74" cy="46" r="8" opacity="0.6" />
      <path d="M60 82a14 14 0 0 1 28 0" opacity="0.6" />
    </svg>
  );
}

export function SuccessIllustration({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...baseProps}>
      <circle cx="60" cy="60" r="30" />
      <path d="M46 60l10 10 20-20" strokeWidth="3" />
      <circle cx="24" cy="30" r="2" opacity="0.4" />
      <circle cx="94" cy="34" r="1.5" opacity="0.35" />
      <circle cx="100" cy="80" r="2" opacity="0.4" />
      <circle cx="18" cy="88" r="1.5" opacity="0.35" />
    </svg>
  );
}
