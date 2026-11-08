// Display style for every feature type (used by the 2D map, the 3D view and the mobile app).
export interface FeatureStyle {
  color: string;
  glyph: string;
  label: string;
}

export const FEATURE_STYLE: Record<string, FeatureStyle> = {
  reboot_van: { color: '#2f7bff', glyph: 'R', label: 'Reboot Van' },
  vault: { color: '#f5c518', glyph: 'V', label: 'Vault' },
  boss: { color: '#e5383b', glyph: 'B', label: 'Boss' },
  medallion: { color: '#9b5de5', glyph: 'M', label: 'Medallion' },
  vending_machine: { color: '#00bbf9', glyph: '$', label: 'Vending Machine' },
  launch_pad: { color: '#ff8c00', glyph: '▲', label: 'Launch Pad' },
  supply_drop: { color: '#4361ee', glyph: 'S', label: 'Supply Drop' },
  campfire: { color: '#f3722c', glyph: 'F', label: 'Campfire' },
  zipline: { color: '#adb5bd', glyph: 'Z', label: 'Zipline' },
  rift: { color: '#c77dff', glyph: '◎', label: 'Rift' },
  spawn_pad: { color: '#4cc9f0', glyph: 'P', label: 'Spawn Pad' },
  team_spawn: { color: '#4cc9f0', glyph: 'P', label: 'Team Spawn' },
  capture_zone: { color: '#ffd60a', glyph: '◆', label: 'Capture Zone' },
  flag: { color: '#ff006e', glyph: '⚑', label: 'Flag' },
  bomb_site: { color: '#d00000', glyph: '✱', label: 'Bomb Site' },
  checkpoint: { color: '#06d6a0', glyph: '✓', label: 'Checkpoint' },
  finish_line: { color: '#ffffff', glyph: '★', label: 'Finish' },
  race_checkpoint: { color: '#06d6a0', glyph: '▶', label: 'Race Gate' },
  tycoon_plot: { color: '#8ac926', glyph: '▣', label: 'Tycoon Plot' },
  shop: { color: '#00bbf9', glyph: '$', label: 'Shop' },
  upgrade_button: { color: '#ffbe0b', glyph: '+', label: 'Upgrade Button' },
  creature_spawner: { color: '#7b2cbf', glyph: 'C', label: 'Creature Spawner' },
  guard_spawner: { color: '#9d0208', glyph: 'G', label: 'Guard Spawner' },
  vehicle_spawner: { color: '#3a86ff', glyph: '⛟', label: 'Vehicle Spawner' },
  teleporter: { color: '#b5179e', glyph: 'T', label: 'Teleporter' },
  trap: { color: '#ef233c', glyph: '!', label: 'Trap' },
  collectible: { color: '#ffd166', glyph: '●', label: 'Collectible' },
  hiding_spot: { color: '#52b788', glyph: 'H', label: 'Hiding Spot' },
  item_spawner: { color: '#90e0ef', glyph: 'I', label: 'Item Spawner' },
  minigame_pad: { color: '#f72585', glyph: '♦', label: 'Minigame Pad' },
  npc: { color: '#e9c46a', glyph: 'N', label: 'NPC' },
  wildlife: { color: '#a98467', glyph: 'W', label: 'Wildlife' },
  objective: { color: '#e63946', glyph: 'O', label: 'Objective' },
  sentry: { color: '#6c757d', glyph: 'X', label: 'Sentry' },
  bouncer: { color: '#80ffdb', glyph: '⇡', label: 'Bouncer' },
  moving_platform: { color: '#adb5bd', glyph: '↔', label: 'Moving Platform' },
  speed_boost: { color: '#fb8500', glyph: '»', label: 'Speed Boost' },
  powerup: { color: '#80ed99', glyph: '✚', label: 'Power-up' },
  turret: { color: '#495057', glyph: '⊕', label: 'Turret' },
};

export const TEAM_COLORS = ['#ffffff', '#ef233c', '#3a86ff', '#38b000', '#ffd60a', '#9d4edd', '#fb8500', '#ff4d6d', '#2ec4b6'];

export function featureStyle(type: string): FeatureStyle {
  return FEATURE_STYLE[type] || { color: '#cccccc', glyph: '?', label: type };
}
