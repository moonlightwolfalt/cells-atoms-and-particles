import { useMemo, useState } from 'react';
import { DEVICES, DEVICE_MAP, DEVICE_CATEGORIES, gridRef, type MapSpec, type PlacedDevice } from '../../../core/src/index.ts';

export function DevicesPanel({ spec, onCommit, onReplan }: { spec: MapSpec; onCommit: (s: MapSpec) => void; onReplan: () => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [catalogCat, setCatalogCat] = useState(DEVICE_CATEGORIES[0]);

  const groups = useMemo(() => {
    const q = query.toLowerCase();
    const g: Record<string, { device: string; items: { d: PlacedDevice; i: number }[] }> = {};
    spec.devices.forEach((d, i) => {
      const def = DEVICE_MAP[d.device];
      if (q && !`${def?.name} ${d.label}`.toLowerCase().includes(q)) return;
      (g[d.device] ||= { device: d.device, items: [] }).items.push({ d, i });
    });
    return Object.values(g).sort((a, b) => (DEVICE_MAP[a.device]?.category || '').localeCompare(DEVICE_MAP[b.device]?.category || ''));
  }, [spec.devices, query]);

  const setDevice = (i: number, patch: Partial<PlacedDevice>) => {
    const devices = [...spec.devices];
    devices[i] = { ...devices[i], ...patch };
    onCommit({ ...spec, devices });
  };

  const addDevice = (id: string) => {
    const def = DEVICE_MAP[id];
    const n = spec.devices.filter((d) => d.device === id).length + 1;
    onCommit({ ...spec, devices: [...spec.devices, { id: `${id}-custom-${n}`, device: id, label: def.name, x: 0.5, y: 0.5, settings: { ...def.settings }, enabled: true }] });
    setOpen(id);
  };

  const enabled = spec.devices.filter((d) => d.enabled).length;

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input className="input max-w-xs" placeholder="Filter devices…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <span className="text-sm text-mute">{enabled} of {spec.devices.length} devices on · {groups.length} types</span>
          <button className="btn ml-auto" onClick={onReplan} title="Rebuild the device plan from the layout">Re-plan from layout</button>
        </div>
        <div className="space-y-2">
          {groups.map((g) => {
            const def = DEVICE_MAP[g.device];
            const isOpen = open === g.device;
            const onCount = g.items.filter((x) => x.d.enabled).length;
            return (
              <div key={g.device} className="rounded-xl border border-white/10 bg-ink-950/40">
                <button className="flex w-full items-center gap-3 p-3 text-left" onClick={() => setOpen(isOpen ? null : g.device)} aria-expanded={isOpen}>
                  <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-bold uppercase text-mute">{def?.category}</span>
                  <span className="font-bold">{def?.name || g.device}</span>
                  <span className="text-sm text-mute">× {onCount}</span>
                  {def?.verse && <code className="ml-auto hidden text-xs text-sky sm:inline">{def.verse}</code>}
                </button>
                {isOpen && (
                  <div className="space-y-2 border-t border-white/10 p-3">
                    <p className="text-sm text-mute">{def?.description}</p>
                    {g.items.map(({ d, i }) => (
                      <div key={d.id} className="rounded-lg bg-ink-800/60 p-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="flex items-center gap-1.5 text-sm">
                            <input type="checkbox" checked={d.enabled} onChange={(e) => setDevice(i, { enabled: e.target.checked })} />
                            <input className="input w-64 py-1" value={d.label} onChange={(e) => setDevice(i, { label: e.target.value })} aria-label="Device label" />
                          </label>
                          <span className="text-xs text-mute">{gridRef(d.x, d.y)}</span>
                        </div>
                        {Object.keys(d.settings).length > 0 && (
                          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {Object.entries(d.settings).map(([k, v]) => (
                              <label key={k} className="text-xs text-mute">
                                {k}
                                {typeof v === 'boolean' ? (
                                  <input type="checkbox" className="ml-2" checked={v} onChange={(e) => setDevice(i, { settings: { ...d.settings, [k]: e.target.checked } })} />
                                ) : (
                                  <input
                                    className="input py-1"
                                    value={String(v)}
                                    onChange={(e) => setDevice(i, { settings: { ...d.settings, [k]: typeof v === 'number' && e.target.value.trim() !== '' && !isNaN(+e.target.value) ? +e.target.value : e.target.value } })}
                                  />
                                )}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <aside className="rounded-xl border border-white/10 bg-ink-950/50 p-3">
        <h3 className="label">UEFN device catalog ({DEVICES.length})</h3>
        <div className="mb-2 flex flex-wrap gap-1">
          {DEVICE_CATEGORIES.map((c) => (
            <button key={c} className={`chip ${c === catalogCat ? 'bg-white text-sun-ink' : ''}`} onClick={() => setCatalogCat(c)}>{c}</button>
          ))}
        </div>
        <ul className="max-h-[520px] space-y-1 overflow-y-auto">
          {DEVICES.filter((d) => d.category === catalogCat).map((d) => (
            <li key={d.id} className="flex items-start gap-2 rounded-lg p-2 hover:bg-white/5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{d.name}</div>
                <div className="text-xs text-mute">{d.description}</div>
              </div>
              <button className="btn px-2 py-1 text-xs" onClick={() => addDevice(d.id)} aria-label={`Add ${d.name}`}>Add</button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
