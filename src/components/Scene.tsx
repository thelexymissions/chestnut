import { memo, useMemo, type CSSProperties } from 'react';
import { hash, sceneMeta, sceneUrl, type Scene } from '../lib/scenes';

// A card's background. The painted picture is still; when `live` is set, a few
// light layers move slowly over it: stars twinkle, mist drifts, water shimmers,
// the light breathes. Only opacity and transform are animated.

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SceneView = memo(function SceneView({ scene, live, hero }: { scene: Scene; live: boolean; hero?: boolean }) {
  const meta = sceneMeta(scene);
  const stars = useMemo(() => {
    if (!meta.stars) return [];
    const r = seeded(hash(scene.id + ':twinkle'));
    return Array.from({ length: 16 }, () => ({ x: r() * 100, y: r() * 56, s: 1.5 + r() * 2.2, d: r() * 6, t: 3.2 + r() * 4 }));
  }, [scene.id, meta.stars]);

  const vars = {
    backgroundImage: `url("${sceneUrl(scene)}")`,
    '--lx': `${(meta.lightX * 100).toFixed(1)}%`,
    '--ly': `${(meta.lightY * 100).toFixed(1)}%`,
    '--hy': `${(meta.horizonY * 100).toFixed(1)}%`,
    '--glow': meta.glow,
    '--sun': meta.sun,
    '--c1': meta.colors[0],
    '--c2': meta.colors[1],
    '--c3': meta.colors[2],
  } as CSSProperties;

  return (
    <div className={'stage-wrap' + (hero ? ' hero' : '')} aria-hidden>
      <div className={`stage layout-${meta.layout}${scene.kind === 'photo' ? ' photo' : ''}${live ? ' live' : ''}`} style={vars}>
        {live && (
          <>
            {meta.layout === 'glow' && (<><i className="lv blob b1" /><i className="lv blob b2" /><i className="lv blob b3" /></>)}
            {(meta.layout === 'ridges' || meta.layout === 'horizon' || meta.layout === 'night') && <i className="lv halo" />}
            {stars.map((st, i) => (
              <i key={i} className="lv star" style={{ left: `${st.x}%`, top: `${st.y}%`, width: st.s, height: st.s, animationDelay: `${st.d}s`, animationDuration: `${st.t}s` }} />
            ))}
            {(meta.layout === 'ridges' || meta.layout === 'night') && (<><i className="lv mist m1" /><i className="lv mist m2" /></>)}
            {meta.layout === 'horizon' && <i className="lv shimmer" />}
          </>
        )}
      </div>
      <i className="grain" />
    </div>
  );
});
