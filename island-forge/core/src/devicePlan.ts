// Decides which UEFN devices an island needs and where they go.
import type { MapSpec, PlacedDevice, Poi } from './types.ts';
import { MODES } from './modes.ts';
import { DEVICE_MAP, FEATURE_DEVICE } from './devices.ts';
import { stormCenters } from './terrain.ts';
import { VERSE_MODULES, verseModuleIds } from './verse/index.ts';
import { catalogEntry } from './catalog.ts';
import { VEHICLE_DEVICE } from './loot.ts';

const nameOf = (id: string) => catalogEntry(id)?.name || id;

/** How many of each chest type a location gets. */
export function chestPlan(spec: MapSpec, p: Poi): { id: string; name: string; count: number }[] {
  const big = p.size === 'large' ? 2 : p.size === 'medium' ? 1 : 0;
  const hasVault = spec.features.some((f) => f.type === 'vault' && Math.hypot(f.x - p.x, f.y - p.y) < 0.04);
  const counts: Record<string, number> = {
    treasure_chest: p.loot_tier * 2 + big,
    rare_chest: p.loot_tier >= 2 ? 1 + (p.loot_tier === 3 ? 1 : 0) : 0,
    ammo_box: p.loot_tier + 1,
    cooler: big ? 1 : 0,
    food_box: big ? 1 : 0,
    vault_chest: hasVault ? 3 : 0,
    bunker_chest: p.kind === 'military' || p.kind === 'base' ? 1 : 0,
    safe: p.loot_tier === 3 ? 1 : 0,
    weapon_rack: 2,
    ammo_crate_large: p.size === 'large' ? 1 : 0,
    fishing_spot: p.kind === 'docks' ? 2 : 0,
    supply_drop: 0,
    supply_llama: p.size === 'large' && p.loot_tier === 3 ? 1 : 0,
  };
  return spec.loot.chests
    .map((id) => ({ id, name: nameOf(id), count: counts[id] ?? (p.size === 'large' ? 1 : 0) }))
    .filter((c) => c.count > 0);
}

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
  const globals = mode.devices.filter((d) => !['verse_device', 'advanced_storm_beacon', 'player_spawner', 'chest_spawner', 'water', 'item_granter'].includes(d));
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

  // Chests & containers per location, from the island's loot plan.
  for (const p of spec.pois) {
    for (const c of chestPlan(spec, p)) add('chest_spawner', p.x, p.y, `${c.name} ×${c.count} — ${p.name}`, { Container: c.name, Count: c.count, Tier: p.loot_tier });
  }

  // Item granters: the starting loadout, or the weapon ladder for Gun Game.
  const granterItems = spec.mode === 'gun_game' ? spec.loot.pool : spec.loot.starting_loadout;
  granterItems.forEach((id, i) => {
    const p = ring(i, Math.max(granterItems.length, 1));
    add('item_granter', p.x + 0.04, p.y, spec.mode === 'gun_game' ? `Ladder #${i + 1} — ${nameOf(id)}` : `Loadout — ${nameOf(id)}`, { Item: nameOf(id), 'Grant On': spec.mode === 'gun_game' ? 'Verse' : 'Spawn' });
  });
  if (!granterItems.length && mode.devices.includes('item_granter')) {
    const p = ring(0, 1);
    add('item_granter', p.x + 0.04, p.y);
  }
  if (mode.devices.includes('water')) {
    for (const l of spec.lakes) add('water', l.x, l.y, 'Lake', { 'Radius (m)': Math.round(l.radius * spec.map_size_m) });
  }

  let vehicleN = 0;
  let creatureN = 0;
  for (const f of spec.features) {
    let dev = FEATURE_DEVICE[f.type];
    if (!dev) continue;
    const settings: PlacedDevice['settings'] = {};
    if (f.type === 'vehicle_spawner' && spec.loot.vehicles.length) {
      const v = spec.loot.vehicles[vehicleN++ % spec.loot.vehicles.length];
      dev = VEHICLE_DEVICE[v] || dev;
      settings.Vehicle = nameOf(v);
    }
    if ((f.type === 'creature_spawner' || f.type === 'wildlife' || f.type === 'guard_spawner') && spec.loot.creatures.length) {
      settings['Creature Type'] = nameOf(spec.loot.creatures[creatureN++ % spec.loot.creatures.length]);
    }
    if (f.team) {
      settings['Player Team'] = teamLabel(f.team);
      settings.Team = teamLabel(f.team);
    }
    if (f.order) settings['Checkpoint Order'] = f.order;
    if (f.type === 'upgrade_button') settings['Item Count'] = 50 * Math.max(1, f.order);
    const label = [DEVICE_MAP[dev]?.name, f.team ? teamLabel(f.team) : '', f.order ? `#${f.order}` : '', f.note].filter(Boolean).join(' — ');
    add(dev, f.x, f.y, label, settings);
  }

  for (const id of verseModuleIds(spec)) {
    const m = VERSE_MODULES[id];
    if (m) add('verse_device', 0.5, 0.5, `Verse — ${m.deviceName(spec)}`, { 'Verse file': m.fileName(spec) });
  }
  return out;
}
