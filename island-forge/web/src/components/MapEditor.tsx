import { useEffect, useMemo, useRef, useState } from 'react';
import { FEATURE_TYPES, POI_KINDS, featureStyle, gridRef, toWorld, MODES, DEVICE_MAP, PREFABS, catalogEntry, chestPlan, type MapSpec } from '../../../core/src/index.ts';
import { IdPicker } from './IdPicker.tsx';
import { drawMap, hitTest, terrainImage, DEFAULT_LAYERS, type Layers, type Selection } from '../render/map2d.ts';

type Tool = 'select' | 'poi' | `feature:${string}`;

interface Props {
  spec: MapSpec;
  onCommit: (spec: MapSpec, opts?: { replanDevices?: boolean }) => void;
}

const SIZE = 1024;

export function MapEditor({ spec, onCommit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const [tool, setTool] = useState<Tool>('select');
  const [selected, setSelected] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<MapSpec | null>(null);
  const drag = useRef<{ sel: Selection; dx: number; dy: number; moved: boolean } | null>(null);
  const frozenTerrain = useRef<HTMLCanvasElement | null>(null);
  const view = draft || spec;

  useEffect(() => setSelected(null), [spec.seed, spec.mode]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, SIZE, SIZE);
    drawMap(ctx, view, SIZE, layers, selected, draft ? frozenTerrain.current || undefined : undefined);
  }, [view, layers, selected, draft]);

  const toMap = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width)), y: Math.min(0.98, Math.max(0.02, (e.clientY - r.top) / r.height)) };
  };

  const listFor = (s: MapSpec, kind: Selection['kind']) => (kind === 'poi' ? s.pois : kind === 'feature' ? s.features : s.devices);

  const onDown = (e: React.PointerEvent) => {
    const p = toMap(e);
    if (tool === 'poi') {
      const next = { ...spec, pois: [...spec.pois, { name: `New Location ${spec.pois.length + 1}`, kind: 'town', x: p.x, y: p.y, size: 'medium' as const, loot_tier: 2, elevation: 0.2, description: '', prefab: '', galleries: [] }] };
      onCommit(next, { replanDevices: true });
      setSelected({ kind: 'poi', index: next.pois.length - 1 });
      setTool('select');
      return;
    }
    if (tool.startsWith('feature:')) {
      const type = tool.slice(8);
      const next = { ...spec, features: [...spec.features, { type, x: p.x, y: p.y, note: '', team: 0, order: 0 }] };
      onCommit(next, { replanDevices: true });
      setSelected({ kind: 'feature', index: next.features.length - 1 });
      return;
    }
    const hit = hitTest(spec, p.x, p.y, layers);
    setSelected(hit);
    if (hit) {
      const item = listFor(spec, hit.kind)[hit.index];
      drag.current = { sel: hit, dx: item.x - p.x, dy: item.y - p.y, moved: false };
      frozenTerrain.current = terrainImage(spec);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toMap(e);
    d.moved = true;
    const base = draft || spec;
    const key = d.sel.kind === 'poi' ? 'pois' : d.sel.kind === 'feature' ? 'features' : 'devices';
    const list = [...(base[key] as any[])];
    list[d.sel.index] = { ...list[d.sel.index], x: p.x + d.dx, y: p.y + d.dy };
    setDraft({ ...base, [key]: list });
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved && draft) onCommit(draft, { replanDevices: d.sel.kind !== 'device' });
    setDraft(null);
  };

  const deleteSelected = () => {
    if (!selected) return;
    const key = selected.kind === 'poi' ? 'pois' : selected.kind === 'feature' ? 'features' : 'devices';
    const list = (spec[key] as any[]).filter((_, i) => i !== selected.index);
    if (key === 'pois' && list.length === 0) return;
    onCommit({ ...spec, [key]: list }, { replanDevices: key !== 'devices' });
    setSelected(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      if (e.key === 'Escape') {
        setTool('select');
        setSelected(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const usedFeatureTypes = useMemo(() => [...new Set([...Object.keys(MODES[spec.mode].features), ...FEATURE_TYPES])], [spec.mode]);
  const item = selected ? (listFor(spec, selected.kind)[selected.index] as any) : null;

  const update = (patch: Record<string, unknown>, replanDevices = true) => {
    if (!selected) return;
    const key = selected.kind === 'poi' ? 'pois' : selected.kind === 'feature' ? 'features' : 'devices';
    const list = [...(spec[key] as any[])];
    list[selected.index] = { ...list[selected.index], ...patch };
    onCommit({ ...spec, [key]: list }, { replanDevices: replanDevices && key !== 'devices' });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button className={`tab ${tool === 'select' ? 'tab-on' : ''}`} onClick={() => setTool('select')}>Select / move</button>
          <button className={`tab ${tool === 'poi' ? 'tab-on' : ''}`} onClick={() => setTool('poi')}>+ Location</button>
          <select
            className="input w-auto py-1.5"
            value={tool.startsWith('feature:') ? tool : ''}
            onChange={(e) => setTool((e.target.value || 'select') as Tool)}
            aria-label="Add feature"
          >
            <option value="">+ Feature…</option>
            {usedFeatureTypes.map((t) => (
              <option key={t} value={`feature:${t}`}>{featureStyle(t).label}</option>
            ))}
          </select>
          <button className="btn py-1.5" disabled={!selected} onClick={deleteSelected}>Delete</button>
          <span className="text-xs text-mute">{tool === 'select' ? 'Drag anything to move it.' : 'Click the map to place.'}</span>
        </div>
        <div className="relative mx-auto aspect-square max-w-[780px] overflow-hidden rounded-xl border border-white/10 bg-ink-950">
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            className={`block h-full w-full touch-none ${tool === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            aria-label="Island map editor"
          />
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-3 text-sm text-mute">
          {(Object.keys(layers) as (keyof Layers)[]).map((k) => (
            <label key={k} className="flex items-center gap-1.5 capitalize">
              <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} /> {k}
            </label>
          ))}
        </div>
      </div>

      <aside className="rounded-xl border border-white/10 bg-ink-950/50 p-3 text-sm">
        <h3 className="label">Inspector</h3>
        {!item && <p className="text-mute">Select a location, feature or device on the map to edit it. Press Delete to remove it.</p>}
        {item && selected?.kind === 'poi' && (
          <div className="space-y-2">
            <input className="input" value={item.name} onChange={(e) => update({ name: e.target.value }, false)} aria-label="Name" />
            <select className="input" value={item.kind} onChange={(e) => update({ kind: e.target.value }, false)} aria-label="Kind">
              {POI_KINDS.map((k) => <option key={k}>{k}</option>)}
            </select>
            <select className="input" value={item.size} onChange={(e) => update({ size: e.target.value })} aria-label="Size">
              {['small', 'medium', 'large'].map((k) => <option key={k}>{k}</option>)}
            </select>
            <label className="block text-xs text-mute">Loot tier {item.loot_tier}
              <input type="range" min={1} max={3} value={item.loot_tier} onChange={(e) => update({ loot_tier: +e.target.value })} className="w-full" />
            </label>
            <label className="block text-xs text-mute">Elevation {item.elevation.toFixed(2)}
              <input type="range" min={0} max={1} step={0.05} value={item.elevation} onChange={(e) => update({ elevation: +e.target.value })} className="w-full" />
            </label>
            <textarea className="input" rows={3} value={item.description} onChange={(e) => update({ description: e.target.value }, false)} aria-label="Description" />
            <label className="block text-xs text-mute">Prefab
              <select className="input" value={item.prefab} onChange={(e) => update({ prefab: e.target.value }, false)}>
                <option value="">Build by hand (no prefab)</option>
                {[...new Set(PREFABS.map((p) => p.category))].map((cat) => (
                  <optgroup key={cat} label={cat}>
                    {PREFABS.filter((p) => p.category === cat).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            {item.prefab && <p className="text-xs text-mute">{catalogEntry(item.prefab)?.description}</p>}
            <IdPicker kind="galleries" label="Galleries" value={item.galleries} max={6} onChange={(galleries) => update({ galleries }, false)} />
            <p className="text-xs text-mute">Chests: {chestPlan(spec, item).map((c) => `${c.name} ×${c.count}`).join(', ') || 'none'}</p>
          </div>
        )}
        {item && selected?.kind === 'feature' && (
          <div className="space-y-2">
            <select className="input" value={item.type} onChange={(e) => update({ type: e.target.value })} aria-label="Feature type">
              {FEATURE_TYPES.map((t) => <option key={t} value={t}>{featureStyle(t).label}</option>)}
            </select>
            <label className="block text-xs text-mute">Team (0 = none)
              <input className="input" type="number" min={0} max={8} value={item.team} onChange={(e) => update({ team: +e.target.value })} />
            </label>
            <label className="block text-xs text-mute">Order (checkpoints, gates, upgrades)
              <input className="input" type="number" min={0} max={999} value={item.order} onChange={(e) => update({ order: +e.target.value })} />
            </label>
            <input className="input" value={item.note} placeholder="Note" onChange={(e) => update({ note: e.target.value }, false)} aria-label="Note" />
          </div>
        )}
        {item && selected?.kind === 'device' && (
          <div className="space-y-1">
            <p className="font-bold">{DEVICE_MAP[item.device]?.name || item.device}</p>
            <p className="text-mute">{item.label}</p>
          </div>
        )}
        {item && (
          <p className="mt-3 text-xs text-mute">
            Grid {gridRef(item.x, item.y)} · UEFN X {toWorld(spec, item.x, item.y).X}, Y {toWorld(spec, item.x, item.y).Y} cm
          </p>
        )}
      </aside>
    </div>
  );
}
