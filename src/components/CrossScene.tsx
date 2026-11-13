import { memo, useId } from 'react';

// The picture at the heart of the app: a plain wooden cross on a hill, with the
// sun rising behind it. Drawn as vector art so it is sharp at any size.
//
// "tall" fills a whole screen (the opening moment and the welcome); "wide" sits
// at the top of the card on Home, as wide as the card, with the dark hill
// running on beneath the words. Both show the same drawing.

// rays of light fanning up from the sun: [angle in degrees (−90 is straight up), half-width in degrees]
const RAYS: [number, number][] = [[-160, 2.4], [-143, 3.4], [-127, 2.2], [-113, 3], [-100, 2], [-80, 2], [-67, 3], [-53, 2.2], [-37, 3.4], [-20, 2.4]];
const at = (deg: number, r: number) => `${(500 + r * Math.cos((deg * Math.PI) / 180)).toFixed(1)} ${(1000 + r * Math.sin((deg * Math.PI) / 180)).toFixed(1)}`;
const STARS: [number, number, number][] = [[120, 90, 2.2], [260, 210, 1.6], [410, 70, 1.8], [560, 160, 2.4], [700, 60, 1.5], [840, 190, 2], [930, 90, 1.7], [180, 330, 1.5], [760, 320, 1.8], [470, 260, 1.4], [60, 240, 1.6], [640, 390, 1.3]];

export const CrossScene = memo(function CrossScene({ variant, live }: { variant: 'tall' | 'wide'; live?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const u = (name: string) => `url(#${id}${name})`;
  return (
    <svg
      className={`cross-scene ${variant}${live ? ' live' : ''}`}
      viewBox={variant === 'tall' ? '0 0 1000 1400' : '0 380 1000 1700'}
      preserveAspectRatio={variant === 'tall' ? 'xMidYMax slice' : 'xMidYMin meet'}
      aria-hidden
    >
      <defs>
        <linearGradient id={id + 'sky'} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="1040">
          <stop offset="0" stopColor="#12122b" />
          <stop offset="0.3" stopColor="#33244f" />
          <stop offset="0.56" stopColor="#7e3f63" />
          <stop offset="0.78" stopColor="#d9794f" />
          <stop offset="0.93" stopColor="#f6c583" />
          <stop offset="1" stopColor="#fde4b4" />
        </linearGradient>
        <radialGradient id={id + 'glow'} gradientUnits="userSpaceOnUse" cx="500" cy="1000" r="560">
          <stop offset="0" stopColor="#fff7dc" stopOpacity="0.95" />
          <stop offset="0.28" stopColor="#ffd98f" stopOpacity="0.5" />
          <stop offset="0.62" stopColor="#f6a765" stopOpacity="0.16" />
          <stop offset="1" stopColor="#f6a765" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id + 'ray'} gradientUnits="userSpaceOnUse" cx="500" cy="1000" r="880">
          <stop offset="0" stopColor="#fff3cf" stopOpacity="0.34" />
          <stop offset="0.55" stopColor="#ffe2b0" stopOpacity="0.12" />
          <stop offset="1" stopColor="#ffe2b0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id + 'sun'} gradientUnits="userSpaceOnUse" cx="500" cy="1000" r="124">
          <stop offset="0" stopColor="#fffdf3" />
          <stop offset="0.7" stopColor="#fff3cf" />
          <stop offset="1" stopColor="#ffe3a6" />
        </radialGradient>
        <linearGradient id={id + 'hill'} gradientUnits="userSpaceOnUse" x1="0" y1="1000" x2="0" y2="1400">
          <stop offset="0" stopColor="#2a1a12" />
          <stop offset="1" stopColor="#0f0906" />
        </linearGradient>
        <linearGradient id={id + 'wood'} gradientUnits="userSpaceOnUse" x1="396" y1="0" x2="604" y2="0">
          <stop offset="0" stopColor="#3a2315" />
          <stop offset="0.5" stopColor="#1e120b" />
          <stop offset="1" stopColor="#3a2315" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="1000" height="1400" fill={u('sky')} />
      <g className="cs-stars" fill="#fff">
        {STARS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} opacity={0.35 + (i % 4) * 0.12} style={{ animationDelay: `${(i % 5) * 0.9}s` }} />)}
      </g>

      {/* light spreading up from behind the hill */}
      <g className="cs-rays">
        {RAYS.map(([a, w], i) => <path key={a} d={`M500 1000 L${at(a - w, 880)} L${at(a + w, 880)} Z`} fill={u('ray')} opacity={0.6 + (i % 2) * 0.4} />)}
      </g>
      <circle className="cs-glow" cx="500" cy="1000" r="560" fill={u('glow')} />
      <circle cx="500" cy="1004" r="150" fill="#ffe9b5" opacity="0.22" />
      <circle cx="500" cy="1004" r="122" fill={u('sun')} />

      {/* thin cloud lit from below */}
      <g className="cs-clouds">
        <ellipse cx="250" cy="872" rx="210" ry="9" fill="#ffd3a1" opacity="0.3" />
        <ellipse cx="790" cy="838" rx="180" ry="8" fill="#ffc79a" opacity="0.26" />
        <ellipse cx="660" cy="742" rx="230" ry="9" fill="#c9708a" opacity="0.26" />
        <ellipse cx="210" cy="700" rx="170" ry="7" fill="#b0627f" opacity="0.22" />
      </g>

      {/* far country, then the hill */}
      <path d="M0 1092 C120 1040 240 1078 370 1052 C470 1032 560 1066 690 1040 C800 1018 900 1054 1000 1030 L1000 1400 L0 1400 Z" fill="#5d3357" opacity="0.75" />
      <path d="M0 1130 C150 1094 300 1120 430 1100 C560 1080 700 1112 840 1090 C910 1080 960 1094 1000 1090 L1000 1400 L0 1400 Z" fill="#3a2038" opacity="0.85" />
      <path d="M-20 2100 L-20 1086 C120 1076 250 1052 330 1028 C400 1008 450 1000 500 1000 C550 1000 600 1008 670 1028 C750 1052 880 1076 1020 1086 L1020 2100 Z" fill={u('hill')} />
      <path d="M250 1051 C285 1042 310 1034 330 1028 C400 1008 450 1000 500 1000 C550 1000 600 1008 670 1028 C690 1034 715 1042 750 1051" fill="none" stroke="#f4b26c" strokeWidth="2.5" strokeLinecap="round" opacity="0.36" />

      {/* the cross: two plain beams of dark wood, edged by the light behind */}
      <g className="cs-cross">
        <rect x="483" y="688" width="34" height="320" rx="2" fill={u('wood')} />
        <rect x="396" y="770" width="208" height="33" rx="2" fill={u('wood')} />
        <g stroke="#0b0604" strokeWidth="1.4" opacity="0.35">
          <path d="M493 700 L493 1000 M506 696 L506 1002" />
          <path d="M404 781 L596 781 M408 792 L592 792" />
        </g>
        <g fill="none" stroke="#f0aa66" strokeWidth="2" strokeLinecap="round" opacity="0.6">
          <path d="M483 806 L483 1004 M517 806 L517 1004" />
          <path d="M398 803 L481 803 M519 803 L602 803" />
          <path d="M483 690 L483 768 M517 690 L517 768" opacity="0.5" />
        </g>
      </g>
    </svg>
  );
});
