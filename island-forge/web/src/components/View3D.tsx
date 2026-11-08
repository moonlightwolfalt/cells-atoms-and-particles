import { useEffect, useRef, useState } from 'react';
import type { MapSpec } from '../../../core/src/index.ts';
import { IslandScene } from '../render/scene3d.ts';

export function View3D({ spec, sceneRef }: { spec: MapSpec; sceneRef?: React.MutableRefObject<IslandScene | null> }) {
  const box = useRef<HTMLDivElement>(null);
  const scene = useRef<IslandScene | null>(null);
  const [error, setError] = useState('');
  const [spin, setSpin] = useState(true);

  useEffect(() => {
    if (!box.current) return;
    try {
      scene.current = new IslandScene(box.current);
      if (sceneRef) sceneRef.current = scene.current;
    } catch (e: any) {
      setError(`WebGL is not available in this browser (${e?.message || 'unknown error'}).`);
    }
    return () => {
      scene.current?.dispose();
      scene.current = null;
      if (sceneRef) sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    scene.current?.setSpec(spec);
  }, [spec]);

  useEffect(() => {
    if (scene.current) scene.current.autoRotate = spin;
  }, [spin]);

  return (
    <div>
      <div ref={box} className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-ink-950" aria-label="3D island preview">
        {error && <p className="absolute inset-0 grid place-items-center p-6 text-center text-mute">{error}</p>}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm text-mute">
        <span>Drag to orbit · scroll to zoom · right-drag to pan</span>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={spin} onChange={(e) => setSpin(e.target.checked)} /> Auto-rotate</label>
        <button className="btn py-1" onClick={() => { scene.current?.resetView(); setSpin(true); }}>Reset view</button>
      </div>
    </div>
  );
}
