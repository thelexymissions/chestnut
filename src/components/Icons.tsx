import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number; filled?: boolean };

const base = ({ size = 24, filled: _f, ...rest }: P) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...rest,
});

export const IconBookmark = (p: P) => (
  <svg {...base(p)} fill={p.filled ? 'currentColor' : 'none'}><path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.6L5 21V4.5a1 1 0 0 1 1-1z" /></svg>
);
export const IconNote = (p: P) => (
  <svg {...base(p)}><path d="M20.5 11.5a8 8 0 0 1-11.7 7.1L3.5 20l1.4-4.9A8 8 0 1 1 20.5 11.5z" /><path d="M8.5 10h7M8.5 13.5h4.5" /></svg>
);
export const IconShare = (p: P) => (
  <svg {...base(p)}><path d="M21 3 10.5 13.5" /><path d="M21 3l-6.5 18-4-8.5L2 9z" /></svg>
);
export const IconSpeaker = (p: P) => (
  <svg {...base(p)}><path d="M4 9.5h3l5-4v13l-5-4H4z" /><path d="M16 9a4 4 0 0 1 0 6M18.7 6.5a7.5 7.5 0 0 1 0 11" /></svg>
);
export const IconStop = (p: P) => (
  <svg {...base(p)}><rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" /></svg>
);
export const IconMore = (p: P) => (
  <svg {...base(p)}><circle cx="5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="19" cy="12" r="1.3" fill="currentColor" /></svg>
);
export const IconHome = (p: P) => (
  <svg {...base(p)}><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" /></svg>
);
export const IconVerses = (p: P) => (
  <svg {...base(p)}><rect x="6" y="3.5" width="12" height="17" rx="2.5" /><path d="M3 7v10M21 7v10" /></svg>
);
export const IconBook = (p: P) => (
  <svg {...base(p)}><path d="M12 6.5C10 5 7.5 4.5 4 4.5V18c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2V4.5c-3.500 0-6 .5-8 2z" /><path d="M12 6.5V20" /></svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
);
export const IconSettings = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.800 2.800l-.1-.1a1.6 1.6 0 0 0-2.700 1.100V20.500a2 2 0 1 1-4 0v-.1a1.600 1.600 0 0 0-2.700-1.100l-.1.1a2 2 0 1 1-2.800-2.800l.1-.1a1.600 1.600 0 0 0-1.100-2.700H3.500a2 2 0 1 1 0-4h.1a1.600 1.600 0 0 0 1.100-2.700l-.1-.1A2 2 0 1 1 7.400 4.200l.1.1a1.600 1.600 0 0 0 2.700-1.100V3.500a2 2 0 1 1 4 0v.1a1.600 1.600 0 0 0 2.700 1.100l.1-.1a2 2 0 1 1 2.800 2.800l-.1.1a1.600 1.600 0 0 0 1.100 2.700h.1a2 2 0 1 1 0 4h-.1a1.600 1.600 0 0 0-1.400.300z" /></svg>
);
export const IconBack = (p: P) => (
  <svg {...base(p)}><path d="M15 5l-7 7 7 7" /></svg>
);
export const IconForward = (p: P) => (
  <svg {...base(p)}><path d="M9 5l7 7-7 7" /></svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconCopy = (p: P) => (
  <svg {...base(p)}><rect x="8.500" y="8.500" width="11.500" height="11.500" rx="2" /><path d="M15.500 5.500V5a1.500 1.500 0 0 0-1.500-1.500H5A1.500 1.500 0 0 0 3.500 5v9A1.500 1.500 0 0 0 5 15.500h.5" /></svg>
);
export const IconImage = (p: P) => (
  <svg {...base(p)}><rect x="3.500" y="4.500" width="17" height="15" rx="2.500" /><circle cx="9" cy="10" r="1.600" /><path d="m4.500 17.500 5-4.500 3.500 3 2.500-2 4 3.500" /></svg>
);
export const IconPalette = (p: P) => (
  <svg {...base(p)}><path d="M12 3.500a8.500 8.500 0 1 0 0 17c1.400 0 2-.900 2-1.800 0-1.700-1.400-1.700-1.400-3.200 0-1 .8-1.800 1.800-1.800h2.300a3.800 3.800 0 0 0 3.800-3.800c0-3.500-3.800-6.400-8.500-6.400z" /><circle cx="7.800" cy="11.500" r="1" fill="currentColor" /><circle cx="10.500" cy="7.800" r="1" fill="currentColor" /><circle cx="15" cy="8" r="1" fill="currentColor" /></svg>
);
export const IconGrid = (p: P) => (
  <svg {...base(p)}><rect x="4" y="4" width="6.500" height="6.500" rx="1.500" /><rect x="13.500" y="4" width="6.500" height="6.500" rx="1.500" /><rect x="4" y="13.500" width="6.500" height="6.500" rx="1.500" /><rect x="13.500" y="13.500" width="6.500" height="6.500" rx="1.500" /></svg>
);
export const IconTrash = (p: P) => (
  <svg {...base(p)}><path d="M4.500 7h15M9.500 7V4.800a.8.800 0 0 1 .8-.8h3.400a.8.800 0 0 1 .8.800V7M6.500 7l.8 12a1.500 1.500 0 0 0 1.500 1.400h6.400a1.500 1.500 0 0 0 1.500-1.400l.800-12" /></svg>
);
export const IconEdit = (p: P) => (
  <svg {...base(p)}><path d="M4 20h4L19.500 8.500a2.100 2.100 0 0 0-3-3L5 17z" /><path d="m14.500 7.500 3 3" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)}><path d="m5 12.500 4.500 4.500L19 7.500" /></svg>
);
export const IconFlame = (p: P) => (
  <svg {...base(p)}><path d="M12 21c3.600 0 6-2.500 6-6 0-3-2-5-3-7.500-.5 1.500-1.500 2.500-2.500 3C12.500 8 11.500 5 9.500 3c.3 3-3.500 5.500-3.500 9.500 0 4.500 2.500 8.500 6 8.500z" /></svg>
);
export const IconDownload = (p: P) => (
  <svg {...base(p)}><path d="M12 4v11M7.500 11l4.500 4.500L16.500 11M5 19.500h14" /></svg>
);
export const IconPlay = (p: P) => (
  <svg {...base(p)}><path d="M7.500 5v14l11-7z" fill="currentColor" /></svg>
);
export const IconMemory = (p: P) => (
  <svg {...base(p)}><rect x="7.500" y="3.500" width="13" height="13" rx="2.500" /><path d="M16.500 16.500V18A2.500 2.500 0 0 1 14 20.500H6A2.500 2.500 0 0 1 3.500 18v-8A2.500 2.500 0 0 1 6 7.500h1.500" /><path d="m11 10 2.200 2.200L17 8.300" /></svg>
);
export const IconReturn = (p: P) => (
  <svg {...base(p)}><path d="M9 7 4.500 11.500 9 16" /><path d="M4.500 11.500H15a4.500 4.500 0 0 1 0 9h-2" /></svg>
);
export const IconEye = (p: P) => (
  <svg {...base(p)}><path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z" /><circle cx="12" cy="12" r="2.800" /></svg>
);
export const IconWhatsApp = (p: P) => (
  <svg width={p.size ?? 24} height={p.size ?? 24} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2.500a9.500 9.500 0 0 0-8.100 14.400L2.500 21.500l4.700-1.300A9.500 9.500 0 1 0 12 2.500zm0 1.700a7.800 7.800 0 1 1-4 14.500l-.3-.2-2.700.8.800-2.700-.2-.3A7.800 7.800 0 0 1 12 4.200zM8.700 7.300c-.2 0-.5 0-.700.3-.3.300-1 1-1 2.300s1 2.700 1.100 2.900c.2.200 2 3.100 4.900 4.200 2.400 1 2.900.8 3.400.7.500 0 1.700-.700 1.900-1.300.2-.700.2-1.200.2-1.300-.100-.200-.300-.200-.600-.400l-1.900-.900c-.300-.100-.500-.200-.700.100l-.900 1.100c-.200.200-.300.200-.600.100-.300-.200-1.200-.500-2.200-1.400-.800-.700-1.400-1.600-1.500-1.900-.200-.300 0-.400.100-.600l.400-.500c.200-.200.200-.300.300-.500.100-.200 0-.400 0-.500l-.900-2c-.200-.500-.400-.400-.600-.400z" />
  </svg>
);
export const Logo = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
    <path d="M32 6c3 7 22 14 22 31 0 12-9.500 21-22 21S10 49 10 37C10 20 29 13 32 6z" fill="#8a4b2a" />
    <path d="M32 6c3 7 22 14 22 31 0 3-.6 5.800-1.700 8.300C46 34 37 30 32 30s-14 4-20.300 15.300A20 20 0 0 1 10 37C10 20 29 13 32 6z" fill="#a8623a" />
    <path d="M16.500 47.500C21 40 27 37.500 32 37.500s11 2.500 15.500 10C44 54 38.500 58 32 58s-12-4-15.500-10.500z" fill="#e9cfa6" />
    <path d="M24 22c2-3.500 5-6 8-8" stroke="#f3d9b5" strokeWidth="2.500" strokeLinecap="round" fill="none" opacity=".7" />
  </svg>
);
