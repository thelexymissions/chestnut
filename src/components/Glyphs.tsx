// Small drawings for the welcome questions and the home path. Line art only,
// so each inherits the colour of whatever it sits on.

interface G { size?: number }
const frame = (size = 44) => ({
  width: size, height: size, viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
});
const Face = ({ size, children }: G & { children: React.ReactNode }) => (
  <svg {...frame(size)}><circle cx="24" cy="24" r="18" />{children}</svg>
);

export const MOOD_ART: Record<string, (p: G) => React.ReactElement> = {
  joyful: (p) => <Face {...p}><path d="M16 20c1-2 3-2 4 0M28 20c1-2 3-2 4 0" /><path d="M15 27c3 6 15 6 18 0z" fill="currentColor" fillOpacity=".18" /></Face>,
  calm: (p) => <Face {...p}><path d="M15 21c1.500 1.500 3.500 1.500 5 0M28 21c1.500 1.500 3.500 1.500 5 0" /><path d="M18 29c3.500 2.500 8.500 2.500 12 0" /></Face>,
  tired: (p) => <Face {...p}><path d="M15 21h5M28 21h5" /><path d="M19 31h10" /><path d="M36 9l3-3M38.500 13.500l4-1.500" strokeWidth="1.8" /></Face>,
  worried: (p) => <Face {...p}><path d="M15 20l5-2.500M33 20l-5-2.500" /><circle cx="18" cy="23" r="1.300" fill="currentColor" /><circle cx="30" cy="23" r="1.300" fill="currentColor" /><path d="M17 32c2-2 4 2 6 0s4 2 6 0 2 0 2 0" /></Face>,
  sad: (p) => <Face {...p}><circle cx="18" cy="21" r="1.300" fill="currentColor" /><circle cx="30" cy="21" r="1.300" fill="currentColor" /><path d="M17 33c3.500-4 10.500-4 14 0" /><path d="M32 25c1 2.500 1 4 0 4.500s-2-.5-1.500-2z" fill="currentColor" fillOpacity=".3" strokeWidth="1.600" /></Face>,
  lonely: (p) => <Face {...p}><circle cx="18" cy="22" r="1.300" fill="currentColor" /><circle cx="30" cy="22" r="1.300" fill="currentColor" /><path d="M19 31c3-1.500 7-1.500 10 0" /><path d="M14 17c2-1.500 4-1.500 6-.5M34 17c-2-1.500-4-1.500-6-.5" strokeWidth="1.800" /></Face>,
};

export const AREA_ART: Record<string, (p: G) => React.ReactElement> = {
  family: ({ size }) => <svg {...frame(size)}><path d="M8 22 24 8l16 14" /><path d="M12 20v18h24V20" /><path d="M24 34c-5-3.500-7-6-7-8.500a3.500 3.500 0 0 1 7-1 3.500 3.500 0 0 1 7 1c0 2.500-2 5-7 8.500z" /></svg>,
  work: ({ size }) => <svg {...frame(size)}><rect x="6" y="15" width="36" height="24" rx="4" /><path d="M18 15v-3a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3" /><path d="M6 26h36M21 26v3h6v-3" /></svg>,
  health: ({ size }) => <svg {...frame(size)}><path d="M24 40C12 32 7 26 7 19a8.500 8.500 0 0 1 17-2 8.500 8.500 0 0 1 17 2c0 7-5 13-17 21z" /><path d="M13 24h6l3-6 4 11 3-5h6" /></svg>,
  money: ({ size }) => <svg {...frame(size)}><ellipse cx="24" cy="14" rx="14" ry="6" /><path d="M10 14v9c0 3.300 6.300 6 14 6s14-2.700 14-6v-9" /><path d="M10 23v9c0 3.300 6.300 6 14 6s14-2.700 14-6v-9" /></svg>,
  people: ({ size }) => <svg {...frame(size)}><circle cx="17" cy="16" r="6" /><circle cx="33" cy="18" r="5" /><path d="M5 38c0-7 5-11 12-11s12 4 12 11" /><path d="M30 28c6-1 12 2.500 12 9" /></svg>,
  future: ({ size }) => <svg {...frame(size)}><path d="M6 38c8 0 10-8 18-8s10-10 18-10" /><path d="M35 14h7v7" /><circle cx="12" cy="13" r="4" /><path d="M12 5v2M12 19v2M4 13h2M18 13h2" strokeWidth="1.800" /></svg>,
};

export const NEED_ART: Record<string, (p: G) => React.ReactElement> = {
  peace: ({ size }) => <svg {...frame(size)}><path d="M4 30c5 0 5-4 10-4s5 4 10 4 5-4 10-4 5 4 10 4" /><path d="M4 38c5 0 5-4 10-4s5 4 10 4 5-4 10-4 5 4 10 4" /><circle cx="24" cy="14" r="6" /></svg>,
  strength: ({ size }) => <svg {...frame(size)}><path d="M4 40 18 14l8 12 5-7 13 21z" /><path d="M14.500 20.500l3.500 3 3.500-3.500" /></svg>,
  hope: ({ size }) => <svg {...frame(size)}><path d="M4 36h40" /><path d="M12 36a12 12 0 0 1 24 0" /><path d="M24 12v6M10 18l4 4M38 18l-4 4M4 28h5M39 28h5" /></svg>,
  guidance: ({ size }) => <svg {...frame(size)}><circle cx="24" cy="24" r="18" /><path d="m30 18-3.500 8.500L18 30l3.500-8.500z" fill="currentColor" fillOpacity=".18" /></svg>,
  comfort: ({ size }) => <svg {...frame(size)}><path d="M9 28c0-10 6-16 15-16s15 6 15 16" /><path d="M5 28h38l-3 10H8z" /><path d="M24 22c-3-2-4-3.500-4-5a2.200 2.200 0 0 1 4-.8 2.200 2.200 0 0 1 4 .8c0 1.500-1 3-4 5z" /></svg>,
  joy: ({ size }) => <svg {...frame(size)}><path d="M24 6l3.500 9.500L37 19l-9.500 3.500L24 32l-3.500-9.500L11 19l9.500-3.500z" /><path d="M38 30l1.500 4 4 1.500-4 1.500-1.500 4-1.500-4-4-1.500 4-1.500zM9 31l1 2.800 2.800 1-2.800 1-1 2.800-1-2.800-2.800-1 2.800-1z" strokeWidth="1.800" /></svg>,
};

export const STEP_ART: Record<string, (p: G) => React.ReactElement> = {
  verse: ({ size }) => <svg {...frame(size)}><rect x="12" y="6" width="24" height="36" rx="5" /><path d="M18 17h12M18 24h12M18 31h7" /></svg>,
  learn: ({ size }) => <svg {...frame(size)}><path d="M24 40C12 32 7 26 7 19a8.500 8.500 0 0 1 17-2 8.500 8.500 0 0 1 17 2c0 7-5 13-17 21z" /><path d="m17 22 5 5 9-10" /></svg>,
  return: ({ size }) => <svg {...frame(size)}><path d="M4 36h40" /><path d="M12 36a12 12 0 0 1 24 0" /><path d="M24 12v6M10 18l4 4M38 18l-4 4" /></svg>,
  explore: ({ size }) => <svg {...frame(size)}><rect x="14" y="8" width="20" height="32" rx="4" /><path d="M24 15v18M19 28l5 5 5-5" /></svg>,
  around: ({ size }) => <svg {...frame(size)}><rect x="16" y="10" width="16" height="28" rx="4" /><path d="M10 24H4M7 20l-4 4 4 4M38 24h6M41 20l4 4-4 4" /></svg>,
  save: ({ size }) => <svg {...frame(size)}><path d="M13 7h22a2 2 0 0 1 2 2v32l-13-9-13 9V9a2 2 0 0 1 2-2z" /></svg>,
  trivia: ({ size }) => <svg {...frame(size)}><circle cx="24" cy="24" r="18" /><path d="M18.500 19a5.500 5.500 0 1 1 8 5c-1.800 1-2.500 2-2.500 4" /><circle cx="24" cy="33.500" r="1.200" fill="currentColor" /></svg>,
  share: ({ size }) => <svg {...frame(size)}><path d="M42 6 21 27" /><path d="M42 6 29 42l-8-15-15-8z" /></svg>,
};
