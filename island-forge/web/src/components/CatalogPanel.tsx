import { useMemo, useRef, useState } from 'react';
import {
  CATALOG, CATALOG_LABELS, DEVICES, DEVICE_MAP, VERSE_MODULES, registerCatalogEntries, verseModuleIds,
  type CatalogKind, type MapSpec, type Loot,
} from '../../../core/src/index.ts';
import { store, download } from '../storage.ts';

type View = CatalogKind | 'devices' | 'verse';
const VIEWS: [View, string][] = [
  ['prefabs', CATALOG_LABELS.prefabs],
  ['galleries', CATALOG_LABELS.galleries],
  ['devices', 'Devices'],
  ['verse', 'Verse devices'],
  ['chests', CATALOG_LABELS.chests],
  ['items', CATALOG_LABELS.items],
  ['vehicles', CATALOG_LABELS.vehicles],
  ['creatures', CATALOG_LABELS.creatures],
];
const LOOT_KEY: Partial<Record<View, keyof Loot>> = { items: 'pool', chests: 'chests', vehicles: 'vehicles', creatures: 'creatures' };

interface Row {
  id: string;
  name: string;
  category: string;
  description: string;
  extra?: string;
  custom?: boolean;
}

/** Re-applies catalog entries the user imported earlier (called once at start-up). */
export function restoreCustomCatalog(): number {
  const saved = store.get<Partial<Record<CatalogKind, any[]>>>('customCatalog', {});
  let n = 0;
  for (const [kind, list] of Object.entries(saved)) n += registerCatalogEntries(kind as CatalogKind, list || []);
  return n;
}

export function CatalogPanel({ spec, onCommit, onStatus }: { spec: MapSpec; onCommit: (s: MapSpec, o?: { replanDevices?: boolean }) => void; onStatus: (t: string, k?: '' | 'error' | 'success') => void }) {
  const [view, setView] = useState<View>(() => store.get('catalogView', 'prefabs') as View);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [onlyUsed, setOnlyUsed] = useState(false);
  const [version, setVersion] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const used = useMemo(() => {
    const ids = new Set<string>();
    spec.pois.forEach((p) => {
      if (p.prefab) ids.add(p.prefab);
      p.galleries.forEach((g) => ids.add(g));
    });
    Object.values(spec.loot).forEach((list) => list.forEach((id) => ids.add(id)));
    spec.devices.forEach((d) => d.enabled && ids.add(d.device));
    verseModuleIds(spec).forEach((id) => ids.add(id));
    return ids;
  }, [spec]);

  const rows: Row[] = useMemo(() => {
    if (view === 'devices') return DEVICES.map((d) => ({ id: d.id, name: d.name, category: d.category, description: d.description, extra: d.verse }));
    if (view === 'verse') {
      return [
        ...Object.values(VERSE_MODULES).map((m) => ({ id: m.id, name: m.title, category: 'Island Forge Verse modules', description: m.description, extra: 'generated' })),
        ...DEVICES.filter((d) => d.verse).map((d) => ({ id: d.id, name: d.name, category: `Fortnite Verse API · ${d.category}`, description: d.description, extra: d.verse })),
      ];
    }
    return CATALOG[view].map((e) => ({ id: e.id, name: e.name, category: e.category, description: e.description || e.tags.join(', '), extra: e.detail || e.size, custom: e.custom }));
  }, [view, version]);

  const categories = useMemo(() => [...new Set(rows.map((r) => r.category))], [rows]);
  const filtered = rows.filter((r) => {
    if (category && r.category !== category) return false;
    if (onlyUsed && !used.has(r.id)) return false;
    const q = query.trim().toLowerCase();
    return !q || `${r.name} ${r.category} ${r.description} ${r.extra || ''}`.toLowerCase().includes(q);
  });

  const lootKey = LOOT_KEY[view];
  const toggleLoot = (id: string) => {
    if (!lootKey) return;
    const list = spec.loot[lootKey];
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    onCommit({ ...spec, loot: { ...spec.loot, [lootKey]: next } }, { replanDevices: true });
  };
  const addDevice = (id: string) => {
    const def = DEVICE_MAP[id];
    const n = spec.devices.filter((d) => d.device === id).length + 1;
    onCommit({ ...spec, devices: [...spec.devices, { id: `${id}-custom-${n}`, device: id, label: def.name, x: 0.5, y: 0.5, settings: { ...def.settings }, enabled: true }] });
    onStatus(`Added ${def.name} to the island.`, 'success');
  };

  const importCatalog = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const saved = store.get<Partial<Record<CatalogKind, any[]>>>('customCatalog', {});
      let n = 0;
      for (const kind of Object.keys(CATALOG) as CatalogKind[]) {
        const list = Array.isArray(data?.[kind]) ? data[kind] : [];
        if (!list.length) continue;
        n += registerCatalogEntries(kind, list);
        saved[kind] = [...(saved[kind] || []), ...list];
      }
      if (!n) throw new Error('No entries found. Use { "prefabs": [{ "name": "...", "tags": ["castle"] }], "galleries": [...], ... }');
      store.set('customCatalog', saved);
      setVersion((v) => v + 1);
      onStatus(`Imported ${n} catalog entries.`, 'success');
    } catch (e: any) {
      onStatus(`Catalog import failed: ${e.message}`, 'error');
    }
  };

  const counts = Object.fromEntries(VIEWS.map(([v]) => [v, v === 'devices' ? DEVICES.length : v === 'verse' ? Object.keys(VERSE_MODULES).length + DEVICES.filter((d) => d.verse).length : CATALOG[v as CatalogKind].length]));

  return (
    <div>
      <p className="mb-3 max-w-3xl text-sm text-mute">
        Everything Island Forge knows from Fortnite Creative. Epic changes content every season, so if something is missing or renamed, import your own entries — they're saved in this browser and the generator starts using them right away.
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {VIEWS.map(([v, label]) => (
          <button key={v} className={`tab ${view === v ? 'tab-on' : ''}`} onClick={() => { setView(v); setCategory(''); store.set('catalogView', v); }}>
            {label} <span className="opacity-60">{counts[v]}</span>
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" placeholder="Search the catalog…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-mute"><input type="checkbox" checked={onlyUsed} onChange={(e) => setOnlyUsed(e.target.checked)} /> Used in this island</label>
        <span className="text-sm text-mute">{filtered.length} shown</span>
        <div className="ml-auto flex gap-2">
          <button className="btn" onClick={() => fileRef.current?.click()}>Import catalog .json</button>
          <button className="btn" onClick={() => download('island-forge-catalog.json', JSON.stringify(CATALOG, null, 2), 'application/json')}>Export catalog</button>
          <input ref={fileRef} type="file" hidden accept=".json,application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) importCatalog(f); e.target.value = ''; }} />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((r) => {
          const isUsed = used.has(r.id);
          return (
            <div key={r.id} className={`rounded-xl border p-3 ${isUsed ? 'border-sun/60 bg-sun/10' : 'border-white/10 bg-ink-950/40'}`}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-bold">
                    {r.name} {r.custom && <span className="ml-1 rounded bg-sky/30 px-1.5 text-[10px] uppercase">custom</span>}
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-mute">{r.category}</div>
                </div>
                {lootKey && (
                  <button className={`btn shrink-0 px-2 py-1 text-xs ${spec.loot[lootKey].includes(r.id) ? 'btn-primary' : ''}`} onClick={() => toggleLoot(r.id)}>
                    {spec.loot[lootKey].includes(r.id) ? 'In island ✓' : 'Add'}
                  </button>
                )}
                {view === 'devices' && <button className="btn shrink-0 px-2 py-1 text-xs" onClick={() => addDevice(r.id)}>Add</button>}
                {(view === 'prefabs' || view === 'galleries') && isUsed && <span className="shrink-0 text-xs text-sun">in island</span>}
              </div>
              <p className="mt-1 text-sm text-mute">{r.description}</p>
              {r.extra && <code className="mt-1 block truncate text-[11px] text-sky-300">{r.extra}</code>}
            </div>
          );
        })}
      </div>
      {!filtered.length && <p className="py-10 text-center text-mute">Nothing matches.</p>}
    </div>
  );
}
