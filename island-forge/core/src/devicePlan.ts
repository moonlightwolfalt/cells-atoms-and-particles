// Decides which UEFN devices an island needs and where they go.
import type { MapSpec, PlacedDevice } from './types.ts';
import { MODES } from './modes.ts';
import { DEVICE_MAP, FEATURE_DEVICE } from './devices.ts';
import { stormCenters } from './terrain.ts';
import { VERSE_MODULES } from './verse/index.ts';

const TEAM_NAMES = ['Any', 'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Pink', 'Teal'];

export function teamLabel(team: number): string {
  return team > 0 ? TEAM_NAMES[team] || `Team ${team}` : 'Any';
}

export function planDevices(spec: MapSpec): PlacedDevice[] {
  const mode = MODES[spec.mode];
  const out: PlacedDevice[] = [];
  const counts: Record<string, number> = {};
  const add = (device: string, x: number, y: number, label?: string, settings: PlacedDevice['settings'] = {}) => {
    const def = DEVICE_MAP[device];
    if (!def) return;
    counts[device] = (counts[device] || 0) + 1;
    out.push({
      id: `${device}-${counts[device]}`,
      device,
      label: label || def.name,
      x,
      y,
      settings: { ...def.settings, ...settings },
      enabled: true,
    });
  };

  // Global devices sit in a ring near the middle of the map, in a "device room".
  const ring = (i: number, n: number) => ({ x: 0.5 + Math.cos((i / n) * Math.PI * 2) * 0.03, y: 0.5 + Math.sin((i / n) * Math.PI * 2) * 0.03 });
  const r = spec.rules;
  const globals = mode.devices.filter((d) => !['verse_device', 'advanced_storm_beacon', 'player_spawner', 'chest_spawner', 'water'].includes(d));
  globals.forEach((dev, i) => {
    const p = ring(i, globals.length);
    const settings: PlacedDevice['settings'] = {};
    if (dev === 'island_settings') {
      Object.assign(settings, {
        'Max Players': r.max_players,
        'Team Size': r.team_size,
        Teams: r.team_count || 'Squads',
        'Allow Building': r.build_mode === 'build' ? 'All' : r.build_mode === 'edit_only' ? 'None (edit only)' : 'None',
        Respawn: r.respawn_enabled ? `On (${r.respawn_delay_s}s)` : 'Off',
        'Spawn Location': mode.busRoute ? 'Battle Bus' : 'Player Spawn Pads',
        'Starting Materials': r.starting_materials,
        'Round Count': r.rounds,
      });
    }
    if (dev === 'round_settings') Object.assign(settings, { 'Round Time Limit': `${Math.round(r.round_time_s / 60)} min`, Rounds: r.rounds });
    if (dev === 'score_manager' && r.score_to_win) settings['Score To Win'] = r.score_to_win;
    if (dev === 'timer') settings.Duration = r.round_time_s;
    if (dev === 'day_sequence') settings['Time Of Day'] = spec.time_of_day;
    if (dev === 'fog' && spec.time_of_day === 'night') settings['Fog Density'] = 0.6;
    add(dev, p.x, p.y, undefined, settings);
  });

  if (mode.devices.includes('advanced_storm_beacon')) {
    stormCenters(spec).forEach((c, i) => {
      const ph = spec.storm.phases[i];
      add('advanced_storm_beacon', c.x, c.y, `Storm Beacon — Phase ${i + 1}`, {
        Phase: i + 1,
        'End Radius (m)': Math.round(ph.end_radius_pct * spec.map_size_m),
        'Wait Time (s)': ph.wait_s,
        'Shrink Time (s)': ph.shrink_s,
        'Damage Per Tick': ph.damage_per_tick,
      });
    });
  }

  if (mode.devices.includes('chest_spawner')) {
    for (const p of spec.pois) add('chest_spawner', p.x, p.y, `Loot — ${p.name}`, { Chests: p.loot_tier * 4 + (p.size === 'large' ? 4 : 0), Tier: p.loot_tier });
  }
  if (mode.devices.includes('water')) {
    for (const l of spec.lakes) add('water', l.x, l.y, 'Lake', { 'Radius (m)': Math.round(l.radius * spec.map_size_m) });
  }

  for (const f of spec.features) {
    const dev = FEATURE_DEVICE[f.type];
    if (!dev) continue;
    const settings: PlacedDevice['settings'] = {};
    if (f.team) {
      settings['Player Team'] = teamLabel(f.team);
      settings.Team = teamLabel(f.team);
    }
    if (f.order) settings['Checkpoint Order'] = f.order;
    if (f.type === 'upgrade_button') settings['Item Count'] = 50 * Math.max(1, f.order);
    const label = [DEVICE_MAP[dev]?.name, f.team ? teamLabel(f.team) : '', f.order ? `#${f.order}` : '', f.note].filter(Boolean).join(' — ');
    add(dev, f.x, f.y, label, settings);
  }

  for (const id of mode.verse) {
    const m = VERSE_MODULES[id];
    if (m) add('verse_device', 0.5, 0.5, `Verse — ${m.deviceName(spec)}`, { 'Verse file': m.fileName(spec) });
  }
  return out;
}
