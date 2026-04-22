/**
 * DomovPlus icon set — Lucide-style inline SVG.
 *
 * Bez externej knižnice. Každá ikona je minimalistická
 * (24×24 viewBox, strokeWidth 2, stroke-linecap round) — konzistentná línia.
 *
 * Usage:
 *   <Icon name="home" size={18} />
 *   <Icon name="bell" size={20} className="my-class" />
 */
import { SVGProps } from 'react';

export type IconName =
  | 'home' | 'building' | 'apartment' | 'user' | 'users'
  | 'bell' | 'bell-off' | 'check' | 'x' | 'plus' | 'minus' | 'chevron-right' | 'chevron-down'
  | 'vote' | 'announcement' | 'wrench' | 'calendar' | 'money' | 'inspection' | 'bazaar' | 'settings'
  | 'moon' | 'sun' | 'theme' | 'textsize' | 'menu' | 'search' | 'globe' | 'logout'
  | 'trash' | 'edit' | 'key' | 'qr' | 'download' | 'upload' | 'file' | 'copy' | 'more'
  | 'arrow-left' | 'arrow-right' | 'external' | 'shield' | 'lock' | 'send'
  | 'mail' | 'phone' | 'clock' | 'info' | 'alert';

const PATHS: Record<IconName, string> = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-4h4v4"/>',
  apartment: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M9 21V11h6v10M3 11h18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><circle cx="17" cy="9" r="3"/><path d="M14 15.5a5 5 0 0 1 8 4.5"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  'bell-off': '<path d="M8.6 8.6A6 6 0 0 1 18 8c0 7 3 9 3 9h-8M3 3l18 18M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  vote: '<path d="M5 7h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/><path d="M8 7V3m8 4V3m-7 9 2 2 4-4"/>',
  announcement: '<path d="M3 11v2a2 2 0 0 0 2 2h1l3 4V7L6 11H5a2 2 0 0 0-2 0z"/><path d="M14 7a6 6 0 0 1 0 10M18 4a10 10 0 0 1 0 16"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.3 5.3L3 18l3 3 6.4-6.4a4 4 0 0 0 5.3-5.3l-2.3 2.3-2-2z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  inspection: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13l2 2 4-4"/>',
  bazaar: '<path d="M3 9h18l-1.5 9a2 2 0 0 1-2 1.8H6.5a2 2 0 0 1-2-1.8L3 9z"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15-.9-.5a1 1 0 0 1-.5-.9v-3.2a1 1 0 0 1 .5-.9l.9-.5-2-3.4-.9.5a1 1 0 0 1-1 0l-2.8-1.6a1 1 0 0 1-.5-.9v-1h-4v1a1 1 0 0 1-.5.9L5 6.1a1 1 0 0 1-1 0l-.9-.5-2 3.4.9.5a1 1 0 0 1 .5.9v3.2a1 1 0 0 1-.5.9l-.9.5 2 3.4.9-.5a1 1 0 0 1 1 0l2.8 1.6a1 1 0 0 1 .5.9v1h4v-1a1 1 0 0 1 .5-.9l2.8-1.6a1 1 0 0 1 1 0l.9.5 2-3.4z"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  theme: '<path d="M12 3v18M12 3a9 9 0 0 1 0 18"/>',
  textsize: '<path d="M4 7V5h16v2M9 5v14M5 19h8M15 13h6M18 10v10"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m21 2-9.6 9.6M15.5 7.5 18 10l2-2-2.5-2.5"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM21 14h-3M14 21v-3M18 18h3v3M21 17v.01"/>',
  download: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M8 12l4 4 4-4M12 16V4"/>',
  upload: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M16 8l-4-4-4 4M12 4v12"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  more: '<circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/>',
  'arrow-left': '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  'arrow-right': '<path d="M5 12h14M12 5l7 7-7 7"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/>',
  mail: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="m2 7 10 6 10-6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 20 20 0 0 1-8.6-3 19.7 19.7 0 0 1-6-6 20 20 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.8.3 1.6.6 2.4a2 2 0 0 1-.5 2.1L8 9.4a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.4.6a2 2 0 0 1 1.7 2z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  alert: '<path d="M10.3 2.8 2 17a1 1 0 0 0 .9 1.5h18.2a1 1 0 0 0 .9-1.5L13.7 2.8a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, strokeWidth = 2, ...rest }: IconProps) {
  const path = PATHS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
      dangerouslySetInnerHTML={{ __html: path }}
    />
  );
}
