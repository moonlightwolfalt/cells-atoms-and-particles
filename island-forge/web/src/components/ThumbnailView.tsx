import { useEffect, useRef, useState } from 'react';
import type { MapSpec } from '../../../core/src/index.ts';
import { renderThumbnail } from '../render/map2d.ts';
import type { IslandScene } from '../render/scene3d.ts';

export function ThumbnailView({ spec, scene, useHero, setUseHero }: { spec: MapSpec; scene: IslandScene | null; useHero: boolean; setUseHero: (v: boolean) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [heroSnap, setHeroSnap] = useState<HTMLCanvasElement | null>(null);

  const snap = () => {
    if (!scene) return;
    const src = scene.screenshot();
    const size = Math.min(src.width, src.height);
    const c = document.createElement('canvas');
    c.width = c.height = 900;
    c.getContext('2d')!.drawImage(src, (src.width - size) / 2, (src.height - size) / 2, size, size, 0, 0, 900, 900);
    setHeroSnap(c);
    setUseHero(true);
  };

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.getContext('2d')!.drawImage(renderThumbnail(spec, useHero && heroSnap ? heroSnap : undefined), 0, 0);
  }, [spec, useHero, heroSnap]);

  return (
    <div>
      <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10">
        <canvas ref={ref} width={1920} height={1080} className="block h-full w-full" />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm text-mute">
        <span>1920×1080 island thumbnail · exported as JPEG under 1 MB</span>
        <button className="btn py-1" disabled={!scene} onClick={snap} title={scene ? '' : 'Open the 3D tab first'}>Use 3D view as picture</button>
        {heroSnap && <label className="flex items-center gap-1.5"><input type="checkbox" checked={useHero} onChange={(e) => setUseHero(e.target.checked)} /> 3D picture</label>}
      </div>
    </div>
  );
}

export function heroFrom(scene: IslandScene | null): HTMLCanvasElement | undefined {
  if (!scene) return undefined;
  const src = scene.screenshot();
  const size = Math.min(src.width, src.height);
  const c = document.createElement('canvas');
  c.width = c.height = 900;
  c.getContext('2d')!.drawImage(src, (src.width - size) / 2, (src.height - size) / 2, size, size, 0, 0, 900, 900);
  return c;
}
