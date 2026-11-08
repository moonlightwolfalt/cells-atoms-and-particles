// Default loot plan per island type: starting loadout, loot pool, chest types, vehicles, creatures.
import type { Loot, ModeDef } from './types.ts';

const it = (...names: string[]) => names.map((n) => `it_${n}`);
const ch = (...names: string[]) => names;

const BR_POOL = it('assault_rifle', 'burst_assault_rifle', 'heavy_assault_rifle', 'pump_shotgun', 'tactical_shotgun', 'submachine_gun', 'compact_smg', 'pistol', 'hunting_rifle', 'bolt_action_sniper_rifle', 'rocket_launcher', 'grenade', 'shockwave_grenade', 'bandages', 'med_kit', 'small_shield_potion', 'shield_potion', 'chug_jug', 'slurp_juice', 'launch_pad_item', 'port_a_fort');
const ARENA_LOADOUT = it('assault_rifle', 'pump_shotgun', 'submachine_gun', 'small_shield_potion', 'med_kit');

export function defaultLoot(mode: ModeDef): Loot {
  const base: Loot = { starting_loadout: [], pool: [], chests: [], vehicles: [], creatures: [] };
  switch (mode.id) {
    case 'battle_royale':
    case 'reload':
    case 'zero_build_br':
      return { ...base, pool: BR_POOL, chests: ch('treasure_chest', 'rare_chest', 'ammo_box', 'cooler', 'supply_drop', 'vault_chest'), vehicles: ['sports_car', 'pickup_truck', 'motorboat', 'quadcrasher'], creatures: mode.id === 'battle_royale' ? ['boss', 'henchman', 'wolf', 'boar'] : [] };
    case 'blitz':
      return { ...base, pool: BR_POOL, chests: ch('treasure_chest', 'rare_chest', 'ammo_box', 'supply_drop'), creatures: ['boss', 'henchman'] };
    case 'zone_wars':
      return { ...base, starting_loadout: [...ARENA_LOADOUT, ...it('shockwave_grenade', 'chug_splash')] };
    case 'box_fights':
    case 'build_fights':
      return { ...base, starting_loadout: it('pump_shotgun', 'submachine_gun', 'assault_rifle', 'small_shield_potion') };
    case 'red_vs_blue':
    case 'free_for_all':
      return { ...base, starting_loadout: it('assault_rifle', 'pistol'), pool: [...ARENA_LOADOUT, ...it('rocket_launcher', 'grenade', 'heavy_sniper_rifle')], chests: ch('weapon_rack', 'ammo_box') };
    case 'gun_game':
      return { ...base, pool: it('pistol', 'revolver', 'submachine_gun', 'tactical_smg', 'pump_shotgun', 'tactical_shotgun', 'assault_rifle', 'burst_assault_rifle', 'heavy_assault_rifle', 'hunting_rifle', 'bolt_action_sniper_rifle', 'minigun', 'grenade_launcher', 'rocket_launcher', 'pickaxe') };
    case 'sniper_duel':
      return { ...base, starting_loadout: it('heavy_sniper_rifle', 'bolt_action_sniper_rifle', 'pistol', 'bandages') };
    case 'capture_the_flag':
    case 'domination':
    case 'king_of_the_hill':
      return { ...base, starting_loadout: ARENA_LOADOUT, pool: it('rocket_launcher', 'grenade', 'shield_potion'), chests: ch('ammo_box', 'weapon_rack') };
    case 'search_and_destroy':
      return { ...base, starting_loadout: it('pistol'), pool: it('assault_rifle', 'tactical_smg', 'pump_shotgun', 'bolt_action_sniper_rifle', 'smoke_grenade', 'grenade', 'shield_potion') };
    case 'prop_hunt':
    case 'hide_and_seek':
      return { ...base, starting_loadout: it('pump_shotgun', 'flashlight'), pool: it('impulse_grenade', 'bush') };
    case 'infected':
      return { ...base, starting_loadout: it('pump_shotgun', 'submachine_gun'), pool: it('shockwave_grenade', 'med_kit'), creatures: ['zombie'] };
    case 'murder_mystery':
      return { ...base, pool: it('revolver', 'pickaxe', 'flashlight'), chests: ch('safe') };
    case 'party_games':
    case 'hangout':
      return { ...base, pool: it('shockwave_hammer', 'grapple_glove', 'boogie_bomb', 'fishing_rod'), vehicles: mode.id === 'hangout' ? ['sports_car', 'taxi', 'shopping_cart', 'hoverboard'] : [], creatures: mode.id === 'hangout' ? ['shopkeeper_npc', 'quest_giver_npc', 'chicken'] : [] };
    case 'deathrun':
    case 'obstacle_party':
    case 'edit_course':
      return { ...base, starting_loadout: mode.id === 'edit_course' ? it('pickaxe', 'wood') : [] };
    case 'racing':
      return { ...base, vehicles: ['rocket_racing_car', 'sports_car'] };
    case 'wave_defense':
      return { ...base, starting_loadout: it('assault_rifle', 'pump_shotgun', 'med_kit'), pool: it('minigun', 'rocket_launcher', 'grenade', 'shield_potion', 'chug_jug'), chests: ch('ammo_box', 'treasure_chest'), creatures: ['fiend', 'ranged_fiend', 'brute', 'elite_fiend'] };
    case 'horror':
    case 'escape_room':
      return { ...base, starting_loadout: it('flashlight'), pool: it('keycard', 'bandages'), chests: ch('safe'), creatures: mode.id === 'horror' ? ['zombie', 'guard_ai'] : [] };
    case 'survival':
      return { ...base, starting_loadout: it('pickaxe'), pool: it('bow', 'crossbow', 'hunting_rifle', 'pump_shotgun', 'apple', 'banana', 'mushroom', 'cozy_campfire', 'fishing_rod'), chests: ch('treasure_chest', 'cooler', 'food_box', 'fishing_spot'), creatures: ['wolf', 'boar', 'raptor', 'chicken', 'fiend'] };
    case 'tycoon':
    case 'simulator':
      return { ...base, pool: it('gold_bars', 'assault_rifle', 'pump_shotgun'), chests: ch('safe') };
    default:
      return { ...base, pool: BR_POOL.slice(0, 8), chests: ch('treasure_chest', 'ammo_box') };
  }
}

/** Vehicle catalog id -> device id of its spawner. */
export const VEHICLE_DEVICE: Record<string, string> = {
  sports_car: 'vehicle_sports_car',
  sedan: 'vehicle_sedan',
  pickup_truck: 'vehicle_pickup',
  semi_truck: 'vehicle_semi',
  taxi: 'vehicle_taxi',
  dirt_bike: 'vehicle_dirtbike',
  quadcrasher: 'vehicle_quadcrasher',
  atk_golf_cart: 'vehicle_golf_cart',
  baller: 'vehicle_baller',
  shopping_cart: 'vehicle_shopping_cart',
  motorboat: 'vehicle_boat',
  helicopter_choppa: 'vehicle_helicopter',
  x_4_stormwing: 'vehicle_plane',
  ufo: 'vehicle_ufo',
  hoverboard: 'vehicle_hoverboard',
  driftboard: 'vehicle_hoverboard',
  tank: 'vehicle_tank',
  rocket_racing_car: 'vehicle_sports_car',
};
