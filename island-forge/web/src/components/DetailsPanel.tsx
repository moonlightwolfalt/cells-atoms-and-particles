import { MODES, BUILD_MODES, TIMES_OF_DAY, BIOMES, gridRef, normalizeSpec, type MapSpec, type Rules } from '../../../core/src/index.ts';

const fmt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`);

export function DetailsPanel({ spec, onCommit }: { spec: MapSpec; onCommit: (s: MapSpec, o?: { replanDevices?: boolean; mergeWithLast?: boolean }) => void }) {
  const mode = MODES[spec.mode];
  const r = spec.rules;
  const set = (patch: Partial<MapSpec>, replan = false) => onCommit({ ...spec, ...patch }, { replanDevices: replan, mergeWithLast: true });
  const setRule = (k: keyof Rules, v: unknown) => onCommit(normalizeSpec({ ...spec, rules: { ...r, [k]: v } }, spec.mode), { replanDevices: true });

  const num = (k: keyof Rules, label: string, min: number, max: number) => (
    <label className="text-xs text-mute">
      {label}
      <input className="input py-1" type="number" min={min} max={max} value={r[k] as number} onChange={(e) => setRule(k, Number(e.target.value))} />
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs text-mute">Island name
          <input className="input" maxLength={48} value={spec.name} onChange={(e) => set({ name: e.target.value || 'Untitled Island' })} />
        </label>
        <label className="text-xs text-mute">Tagline
          <input className="input" maxLength={120} value={spec.tagline} onChange={(e) => set({ tagline: e.target.value })} />
        </label>
        <label className="text-xs text-mute md:col-span-2">Description
          <textarea className="input" rows={2} maxLength={600} value={spec.description} onChange={(e) => set({ description: e.target.value })} />
        </label>
        <label className="text-xs text-mute">Time of day
          <select className="input" value={spec.time_of_day} onChange={(e) => set({ time_of_day: e.target.value as MapSpec['time_of_day'] }, true)}>
            {TIMES_OF_DAY.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-xs text-mute">Base biome
          <select className="input" value={spec.base_biome} onChange={(e) => set({ base_biome: e.target.value })}>
            {BIOMES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-xs text-mute">Map size (m)
          <input className="input" type="number" min={50} max={4000} value={spec.map_size_m} onChange={(e) => set({ map_size_m: Math.max(50, Math.min(4000, Number(e.target.value) || 50)) })} />
        </label>
        <p className="self-end text-xs text-mute">
          {mode.label} · {mode.category} · {mode.layout} layout · made with {spec.generator}
        </p>
      </div>

      <section>
        <h3 className="label">Rules</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {num('max_players', 'Max players', 1, 100)}
          {num('team_size', 'Team size', 1, 16)}
          {num('team_count', 'Team count (0 = FFA)', 0, 16)}
          {num('respawn_delay_s', 'Respawn delay (s)', 0, 120)}
          {num('respawn_cutoff_phase', 'Respawns stop at phase', 0, 20)}
          {num('rounds', 'Rounds', 1, 50)}
          {num('round_time_s', 'Round time (s)', 30, 7200)}
          {num('score_to_win', 'Score to win', 0, 100000)}
          {num('starting_materials', 'Starting mats', 0, 999)}
          <label className="text-xs text-mute">Building
            <select className="input py-1" value={r.build_mode} onChange={(e) => setRule('build_mode', e.target.value)}>
              {BUILD_MODES.map((b) => <option key={b} value={b}>{b.replace('_', ' ')}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-mute"><input type="checkbox" checked={r.respawn_enabled} onChange={(e) => setRule('respawn_enabled', e.target.checked)} /> Respawns on</label>
        </div>
        <label className="mt-3 block text-xs text-mute">Loot
          <input className="input" value={r.loot_pool_notes} onChange={(e) => setRule('loot_pool_notes', e.target.value)} />
        </label>
      </section>

      <section>
        <h3 className="label">Locations ({spec.pois.length})</h3>
        <div className="overflow-x-auto">
          <table className="table-x">
            <thead><tr><th>Name</th><th>Kind</th><th>Size</th><th>Loot</th><th>Grid</th></tr></thead>
            <tbody>
              {spec.pois.map((p, i) => (
                <tr key={i}>
                  <td>
                    <input className="input py-1" value={p.name} onChange={(e) => {
                      const pois = [...spec.pois];
                      pois[i] = { ...p, name: e.target.value || 'Unnamed' };
                      set({ pois });
                    }} />
                  </td>
                  <td>{p.kind}</td><td>{p.size}</td><td>{'★'.repeat(p.loot_tier)}</td><td>{gridRef(p.x, p.y)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {spec.storm.phases.length > 0 && (
        <section>
          <h3 className="label">Storm ({spec.storm.phases.length} phases)</h3>
          <div className="overflow-x-auto">
            <table className="table-x">
              <thead><tr><th>#</th><th>Wait</th><th>Shrink</th><th>End radius</th><th>Damage</th></tr></thead>
              <tbody>
                {spec.storm.phases.map((p, i) => (
                  <tr key={i}><td>{i + 1}</td><td>{fmt(p.wait_s)}</td><td>{fmt(p.shrink_s)}</td><td>{Math.round(p.end_radius_pct * spec.map_size_m)} m</td><td>{p.damage_per_tick}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
