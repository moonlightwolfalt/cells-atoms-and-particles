// Catalog of UEFN Creative devices Island Forge knows how to plan and place.
// Settings are sensible starting values; names follow the device names shown in UEFN.
import type { DeviceDef } from './types.ts';

type S = DeviceDef['settings'];
const d = (id: string, name: string, category: string, description: string, verse: string | undefined, settings: S = {}): DeviceDef => ({
  id,
  name,
  category,
  description,
  verse,
  settings,
});

export const DEVICES: DeviceDef[] = [
  // --- Game rules ---
  d('island_settings', 'Island Settings', 'Game Rules', 'Match-wide rules: players, teams, respawn, building, spawn location.', undefined, { 'Max Players': 16, 'Spawn Location': 'Player Spawn Pads', 'Allow Building': 'All' }),
  d('round_settings', 'Round Settings', 'Game Rules', 'Per-round overrides such as round time limits and win conditions.', 'round_settings_device', { 'Round Time Limit': '5 min' }),
  d('end_game', 'End Game', 'Game Rules', 'Ends the round or game for a player or team when activated.', 'end_game_device', { 'Activating Team': 'Any', 'Ends': 'Round' }),
  d('team_settings_inventory', 'Team Settings & Inventory', 'Game Rules', 'Team names, colours, starting inventory and team-only rules.', 'team_settings_and_inventory_device', { 'Team Name': 'Team 1', 'Team Color': 'Red' }),
  d('class_designer', 'Class Designer', 'Game Rules', 'Defines a loadout class (health, shields, items).', 'class_designer_device', { 'Class Name': 'Default', 'Starting Health': 100 }),
  d('class_selector', 'Class Selector', 'Game Rules', 'Switches the player who uses it to a class.', 'class_and_team_selector_device', { 'Class To Switch To': 1 }),
  d('score_manager', 'Score Manager', 'Game Rules', 'Awards score to the activating player or team.', 'score_manager_device', { 'Score Value': 1 }),
  d('elimination_manager', 'Elimination Manager', 'Game Rules', 'Reacts to eliminations, drops items, grants rewards.', 'elimination_manager_device', { 'Target Type': 'Player' }),
  d('timer', 'Timer', 'Game Rules', 'Countdown or stopwatch with success/failure events.', 'timer_device', { 'Duration': 300, 'Visible During Game': true }),
  d('tracker', 'Tracker', 'Game Rules', 'Counts stats (eliminations, items, anything) toward a goal.', 'tracker_device', { 'Stat To Track': 'Eliminations', 'Target Value': 10 }),
  d('accolades', 'Accolades', 'Game Rules', 'Grants XP accolades to players for achievements.', 'accolades_device', { 'XP Award': 'Small' }),
  d('player_counter', 'Player Counter', 'Game Rules', 'Counts players in an area or the whole game and fires events at a threshold.', 'player_counter_device', { 'Target Player Count': 1 }),

  // --- Spawning ---
  d('player_spawner', 'Player Spawn Pad', 'Spawning', 'Where players spawn. Use team-specific pads for team modes.', 'player_spawner_device', { 'Player Team': 'Any', 'Visible In Game': false }),
  d('battle_bus', 'Battle Bus', 'Spawning', 'Flies the bus across the island; players skydive from it.', undefined, { 'Bus Route': 'From layout', 'Jump Delay': 5 }),
  d('reboot_van', 'Reboot Van', 'Spawning', 'Reboots eliminated teammates with their reboot card.', undefined, { 'Reboot Time': 10 }),
  d('checkpoint_pad', 'Checkpoint Pad', 'Spawning', 'Sets a player\'s respawn point when they touch it.', undefined, { 'Visible In Game': true }),
  d('item_granter', 'Item Granter', 'Items', 'Grants items to a player (loadouts, rewards, weapon levels).', 'item_granter_device', { 'Grant': 'Current Item', 'On Grant Action': 'Keep All' }),
  d('item_spawner', 'Item Spawner', 'Items', 'Spawns items in the world on a timer.', 'item_spawner_device', { 'Respawn Item On Timer': true, 'Time Between Spawns': 30 }),
  d('item_remover', 'Item Remover', 'Items', 'Removes items from a player.', 'item_remover_device', { 'Affected Items': 'All' }),
  d('chest_spawner', 'Chest & Ammo Spawner', 'Items', 'Loot chests and ammo boxes placed around POIs.', undefined, { 'Chest Spawn Chance': '100%' }),
  d('vending_machine', 'Vending Machine', 'Items', 'Sells items for gold or materials.', 'vending_machine_device', { 'Cost': 200 }),
  d('capture_item_spawner', 'Capture Item Spawner', 'Items', 'Spawns a capturable item such as a flag.', 'capture_item_spawner_device', { 'Item': 'Flag', 'Team': 'Any' }),
  d('collectible_object', 'Collectible Object', 'Items', 'A coin/gem players collect for score or currency.', 'collectible_object_device', { 'Score': 1 }),
  d('supply_drop', 'Supply Drop Spawner', 'Items', 'Drops a balloon crate with loot from the sky.', 'supply_drop_spawner_device', { 'Drop Count': 1 }),

  // --- Storm & zones ---
  d('storm_controller', 'Storm Controller', 'Storm & Zones', 'A simple shrinking storm.', 'storm_controller_device', { 'Phases': 5 }),
  d('advanced_storm_controller', 'Advanced Storm Controller', 'Storm & Zones', 'Fully custom storm driven by Advanced Storm Beacons.', 'advanced_storm_controller_device', { 'Generate Storm On Game Start': true }),
  d('advanced_storm_beacon', 'Advanced Storm Beacon', 'Storm & Zones', 'One storm phase: radius, wait time, shrink time, damage.', 'advanced_storm_beacon_device', {}),
  d('capture_area', 'Capture Area', 'Storm & Zones', 'A zone teams capture and hold for points.', 'capture_area_device', { 'Capture Time': 10, 'Score While Held': 1 }),
  d('mutator_zone', 'Mutator Zone', 'Storm & Zones', 'Changes rules inside a volume and reports who enters/leaves.', 'mutator_zone_device', { 'Allow Building': false }),
  d('damage_volume', 'Damage Volume', 'Storm & Zones', 'Hurts or eliminates anything inside (lava, kill floors, traps).', 'damage_volume_device', { 'Damage Type': 'Elimination' }),
  d('barrier', 'Barrier', 'Storm & Zones', 'Invisible or visible wall that can be turned on/off (pre-round cages).', 'barrier_device', { 'Barrier Material': 'Glass' }),
  d('fog', 'Fog Device', 'Storm & Zones', 'Atmospheric fog for mood (horror, night).', undefined, { 'Fog Density': 0.4 }),
  d('water', 'Water Device', 'Storm & Zones', 'Swimmable water volumes for lakes and rivers.', undefined, { 'Shape': 'From layout' }),

  // --- Triggers & logic ---
  d('trigger', 'Trigger', 'Logic', 'Fires when a player steps on it or another device signals it.', 'trigger_device', { 'Visible In Game': false, 'Times Can Trigger': 'Infinite' }),
  d('button', 'Button', 'Logic', 'Interactable button (purchases, doors, minigame starts).', 'button_device', { 'Interaction Time': 0.5 }),
  d('conditional_button', 'Conditional Button', 'Logic', 'Button that requires items (keys, gold) to activate.', 'conditional_button_device', { 'Key Item': 'Gold', 'Item Count': 100 }),
  d('switch', 'Switch', 'Logic', 'Toggle on/off state for levers.', 'switch_device', {}),
  d('lock', 'Lock', 'Logic', 'Locks and unlocks doors.', 'lock_device', {}),
  d('input_trigger', 'Input Trigger', 'Logic', 'Fires when a player presses a chosen input (abilities, menus).', 'input_trigger_device', { 'Input': 'Crouch' }),
  d('signal_remote', 'Signal Remote Manager', 'Logic', 'Hand-held remote that sends signals.', 'signal_remote_manager_device', {}),
  d('sequencer', 'Sequencer', 'Logic', 'Fires a chain of events over time.', undefined, { 'Tempo': 60 }),
  d('channel_relay', 'Relay / Channels', 'Logic', 'Relays and receivers to wire devices together.', undefined, {}),

  // --- Movement ---
  d('teleporter', 'Teleporter', 'Movement', 'Moves players between points (spawn rooms, spectator boxes).', 'teleporter_device', { 'Teleporter Group': 'A' }),
  d('launch_pad', 'Launch Pad', 'Movement', 'Launches players into the air.', undefined, { 'Launch Strength': 'Normal' }),
  d('zipline', 'Zipline', 'Movement', 'Fast travel between two points.', undefined, {}),
  d('rift', 'Rift / Rift Point', 'Movement', 'Sends players skydiving from high above.', undefined, {}),
  d('speed_boost', 'Speed Boost Pad', 'Movement', 'Speeds players up along a course.', undefined, { 'Boost Strength': 2 }),
  d('bouncer', 'Bouncer', 'Movement', 'Bounces players up — great for obstacle courses.', undefined, { 'Bounce Height': 'Medium' }),
  d('prop_mover', 'Prop Mover', 'Movement', 'Moves props back and forth (moving platforms, sweepers).', 'prop_mover_device', { 'Distance': 1000, 'Speed': 2 }),

  // --- Racing & vehicles ---
  d('race_manager', 'Race Manager', 'Racing & Vehicles', 'Runs a race: laps, positions, finish.', 'race_manager_device', { 'Laps': 3 }),
  d('race_checkpoint', 'Race Checkpoint', 'Racing & Vehicles', 'A gate racers must pass, in order.', 'race_checkpoint_device', { 'Checkpoint Order': 1 }),
  d('vehicle_spawner', 'Vehicle Spawner', 'Racing & Vehicles', 'Spawns cars, boats, quads, etc.', undefined, { 'Vehicle': 'Sports Car', 'Respawn Time': 10 }),

  // --- AI & creatures ---
  d('creature_spawner', 'Creature Spawner', 'AI', 'Spawns hostile creatures in waves.', 'creature_spawner_device', { 'Creature Type': 'Fiend', 'Max Creatures': 6 }),
  d('guard_spawner', 'Guard Spawner', 'AI', 'Spawns AI guards that patrol and fight.', 'guard_spawner_device', { 'Guard Count': 3, 'Team': 'Wildlife & Creatures' }),
  d('wildlife_spawner', 'Wildlife Spawner', 'AI', 'Spawns animals for survival islands.', 'wildlife_spawner_device', { 'Wildlife': 'Boar' }),
  d('npc_spawner', 'NPC Spawner', 'AI', 'Spawns a custom NPC character (shopkeepers, quest givers).', 'npc_spawner_device', {}),
  d('sentry', 'Sentry', 'AI', 'Stationary turret that shoots players.', 'sentry_device', {}),
  d('boss_spawner', 'Boss (Guard + Item Granter)', 'AI', 'A tough guard that drops a mythic/medallion on elimination.', undefined, { 'Health': 1000 }),

  // --- Objectives ---
  d('objective', 'Objective', 'Objectives', 'Destructible objective for attack/defend.', 'objective_device', { 'Health': 1000 }),
  d('bomb', 'Explosive / Bomb Site', 'Objectives', 'Plant and defuse sites for Search & Destroy.', 'explosive_device', {}),
  d('vault', 'Vault (Lock + Keycard)', 'Objectives', 'Locked loot room opened with a keycard.', undefined, {}),

  // --- UI & feedback ---
  d('hud_message', 'HUD Message', 'UI', 'Shows a message on players\' screens.', 'hud_message_device', { 'Display Time': 4 }),
  d('billboard', 'Billboard', 'UI', 'Text sign in the world (instructions, shop names).', 'billboard_device', { 'Text': 'Welcome!' }),
  d('map_indicator', 'Map Indicator', 'UI', 'Marker/icon on the minimap and full map.', 'map_indicator_device', { 'Icon': 'Default' }),
  d('map_controller', 'Map Controller', 'UI', 'Captures the minimap for custom islands.', undefined, {}),
  d('popup_dialog', 'Popup Dialog', 'UI', 'Modal dialog with buttons (tutorials, shops, votes).', 'popup_dialog_device', {}),
  d('hud_controller', 'HUD Controller', 'UI', 'Shows/hides HUD elements.', undefined, {}),
  d('leaderboard', 'Leaderboard / Scoreboard', 'UI', 'Shows top players (uses island stats).', undefined, {}),

  // --- Atmosphere & audio ---
  d('day_sequence', 'Day Sequence', 'Atmosphere', 'Time of day, sun and sky colours.', undefined, { 'Time Of Day': 'From layout' }),
  d('skydome', 'Skydome', 'Atmosphere', 'Sky style and clouds.', undefined, {}),
  d('post_process', 'Post Process', 'Atmosphere', 'Colour grading and effects (horror, retro).', undefined, {}),
  d('audio_player', 'Audio Player', 'Atmosphere', 'Plays music or sound effects.', 'audio_player_device', { 'Volume': 1 }),
  d('radio', 'Radio', 'Atmosphere', 'Background music for lobbies and hangouts.', 'radio_device', {}),
  d('cinematic_sequence', 'Cinematic Sequence', 'Atmosphere', 'Plays a Sequencer cinematic (intros, outros).', 'cinematic_sequence_device', {}),
  d('campfire', 'Campfire', 'Atmosphere', 'Heals players nearby.', undefined, {}),

  // --- Economy & social ---
  d('analytics', 'Analytics', 'Economy & Social', 'Counts custom events for your island analytics.', 'analytics_device', {}),
  d('matchmaking_portal', 'Matchmaking Portal', 'Economy & Social', 'Sends players to another island (hubs).', undefined, {}),
  d('player_reference', 'Player Reference', 'Economy & Social', 'Shows a player statue (top player, winner).', 'player_reference_device', {}),
  d('prop_manipulator', 'Prop-o-Matic / Prop Manipulator', 'Economy & Social', 'Lets players disguise as props (Prop Hunt).', 'prop_manipulator_device', {}),
  d('verse_device', 'Verse Device (generated)', 'Verse', 'A custom device generated by Island Forge.', undefined, {}),

  // --- More game rules ---
  d('down_but_not_out', 'Down But Not Out', 'Game Rules', 'Knocked-down state and revives for team modes.', 'down_but_not_out_device', { 'Revive Time': 5 }),
  d('attribute_evaluator', 'Attribute Evaluator', 'Game Rules', 'Checks a player (team, class, items) and branches.', 'attribute_evaluator_device', {}),
  d('random_number_generator', 'Random Number Generator', 'Game Rules', 'Picks a random value and fires events.', 'random_number_generator_device', { 'Min': 1, 'Max': 6 }),
  d('stat_creator', 'Stat Creator', 'Game Rules', 'Defines a custom stat (coins, kills, laps).', 'stat_creator_device', { 'Stat Name': 'Coins' }),
  d('timed_objective', 'Timed Objective', 'Game Rules', 'Objective that must be held or defused before time runs out.', 'timed_objective_device', { 'Time': 60 }),
  d('skilled_interaction', 'Skilled Interaction', 'Game Rules', 'Timing mini-game interaction (lock picking, hacking).', undefined, {}),
  d('xp_coin', 'XP Coin', 'Game Rules', 'Collectible coin that awards XP.', undefined, {}),

  // --- More spawning ---
  d('player_checkpoint', 'Player Checkpoint', 'Spawning', 'Sets respawn location (Verse-controllable checkpoint).', 'player_checkpoint_device', {}),
  d('skydive_volume', 'Skydive Volume', 'Spawning', 'Lets players skydive / glide inside a volume.', 'skydive_volume_device', {}),
  d('rift_point_volume', 'Rift Point Volume', 'Spawning', 'Teleports players high into the sky to redeploy.', undefined, {}),
  d('changing_booth', 'Changing Booth', 'Spawning', 'Lets players change outfit.', 'changing_booth_device', {}),
  d('character_device', 'Character Device', 'Spawning', 'Displays a character model that can emote.', 'character_device', {}),

  // --- Items & power-ups ---
  d('item_placer', 'Item Placer', 'Items', 'Places a single item in the world.', undefined, {}),
  d('health_powerup', 'Health Powerup', 'Items', 'Pickup that heals.', 'health_powerup_device', { 'Amount': 50 }),
  d('shield_powerup', 'Shield Powerup', 'Items', 'Pickup that grants shields.', 'shield_powerup_device', { 'Amount': 50 }),
  d('damage_powerup', 'Damage Amplifier Powerup', 'Items', 'Pickup that boosts damage.', 'damage_amplifier_powerup_device', { 'Multiplier': 1.5 }),
  d('visual_effect_powerup', 'Visual Effect Powerup', 'Items', 'Pickup that applies a visual effect.', 'visual_effect_powerup_device', {}),
  d('fishing_zone', 'Fishing Zone', 'Items', 'Water area players can fish in.', 'fishing_zone_device', {}),
  d('fishing_rod_barrel', 'Fishing Rod Barrel', 'Items', 'Gives players a fishing rod.', undefined, {}),

  // --- More movement ---
  d('air_vent', 'Air Vent', 'Movement', 'Blows players upward.', 'air_vent_device', {}),
  d('ascender', 'Ascender', 'Movement', 'Zip players straight up a rope.', undefined, {}),
  d('grind_rail', 'Grind Rail', 'Movement', 'Rail players slide along.', undefined, {}),
  d('movement_modulator', 'Movement Modulator', 'Movement', 'Changes player speed (speed pads, slow zones).', 'movement_modulator_device', { 'Speed Multiplier': 1.5 }),
  d('trick_tile', 'Trick Tile', 'Movement', 'Floor tile that drops, flips or hides when stepped on.', 'trick_tile_device', {}),
  d('pinball_bumper', 'Pinball Bumper', 'Movement', 'Bounces players away.', undefined, {}),
  d('pinball_flipper', 'Pinball Flipper', 'Movement', 'Flips players across the map.', undefined, {}),
  d('physics_boulder', 'Physics Boulder', 'Movement', 'Rolling boulder that knocks players down.', 'physics_boulder_device', {}),
  d('physics_tree', 'Physics Tree', 'Movement', 'Tree that falls with physics.', 'physics_tree_device', {}),

  // --- More logic ---
  d('perception_trigger', 'Perception Trigger', 'Logic', 'Fires when a player looks at it or is seen.', 'perception_trigger_device', {}),
  d('pulse_trigger', 'Pulse Trigger', 'Logic', 'Sends a moving pulse that triggers devices in sequence.', 'pulse_trigger_device', {}),
  d('color_changing_tiles', 'Color Changing Tiles', 'Logic', 'Tiles that change colour when stepped on (territory games).', 'color_changing_tiles_device', {}),
  d('player_marker', 'Player Marker', 'Logic', 'Marks a player on the map/HUD.', 'player_marker_device', {}),
  d('chair', 'Chair', 'Logic', 'A seat players can sit on.', 'chair_device', {}),

  // --- Vehicles (one spawner each) ---
  d('vehicle_sports_car', 'Sports Car Spawner', 'Racing & Vehicles', 'Spawns a sports car.', 'vehicle_spawner_sports_car_device', { 'Respawn Time': 10 }),
  d('vehicle_sedan', 'Sedan Spawner', 'Racing & Vehicles', 'Spawns a sedan.', undefined, {}),
  d('vehicle_pickup', 'Pickup Truck Spawner', 'Racing & Vehicles', 'Spawns a pickup truck.', 'vehicle_spawner_pickup_truck_device', {}),
  d('vehicle_semi', 'Semi Truck Spawner', 'Racing & Vehicles', 'Spawns a big rig.', 'vehicle_spawner_big_rig_device', {}),
  d('vehicle_taxi', 'Taxi Spawner', 'Racing & Vehicles', 'Spawns a taxi.', undefined, {}),
  d('vehicle_quadcrasher', 'Quadcrasher Spawner', 'Racing & Vehicles', 'Spawns a Quadcrasher.', 'vehicle_spawner_quadcrasher_device', {}),
  d('vehicle_baller', 'Baller Spawner', 'Racing & Vehicles', 'Spawns a Baller.', 'vehicle_spawner_baller_device', {}),
  d('vehicle_boat', 'Motorboat Spawner', 'Racing & Vehicles', 'Spawns a motorboat.', 'vehicle_spawner_boat_device', {}),
  d('vehicle_helicopter', 'Helicopter Spawner', 'Racing & Vehicles', 'Spawns a helicopter.', 'vehicle_spawner_helicopter_device', {}),
  d('vehicle_dirtbike', 'Dirt Bike Spawner', 'Racing & Vehicles', 'Spawns a dirt bike.', 'vehicle_spawner_dirtbike_device', {}),
  d('vehicle_tank', 'Tank Spawner', 'Racing & Vehicles', 'Spawns a tank.', 'vehicle_spawner_tank_device', {}),
  d('vehicle_ufo', 'UFO Spawner', 'Racing & Vehicles', 'Spawns a UFO.', 'vehicle_spawner_ufo_device', {}),
  d('vehicle_shopping_cart', 'Shopping Cart Spawner', 'Racing & Vehicles', 'Spawns a shopping cart.', undefined, {}),
  d('vehicle_golf_cart', 'ATK Spawner', 'Racing & Vehicles', 'Spawns an all-terrain kart.', undefined, {}),
  d('vehicle_plane', 'X-4 Stormwing Spawner', 'Racing & Vehicles', 'Spawns a prop plane.', undefined, {}),
  d('vehicle_hoverboard', 'Hoverboard Spawner', 'Racing & Vehicles', 'Spawns a hoverboard.', undefined, {}),

  // --- More AI ---
  d('creature_placer', 'Creature Placer', 'AI', 'Places a single creature.', 'creature_placer_device', {}),
  d('creature_manager', 'Creature Manager', 'AI', 'Tunes creature health and damage.', 'creature_manager_device', {}),
  d('automated_turret', 'Automated Turret', 'AI', 'Turret that targets players or creatures.', 'automated_turret_device', {}),
  d('ai_patrol_path', 'AI Patrol Path', 'AI', 'Path guards walk along.', 'ai_patrol_path_device', {}),

  // --- More objectives ---
  d('ball_spawner', 'Ball Spawner', 'Objectives', 'Spawns a ball for sports modes.', 'ball_spawner_device', {}),
  d('shooting_target', 'Shooting Gallery Target', 'Objectives', 'Pop-up target for aim courses.', 'shooting_range_target_device', {}),
  d('explosive_barrel', 'Explosive Barrel', 'Objectives', 'Barrel that explodes when shot.', undefined, {}),

  // --- More UI ---
  d('video_player', 'Video Player', 'UI', 'Plays a video on a screen.', 'video_player_device', {}),
  d('holoscreen', 'Holoscreen', 'UI', 'Floating screen with text or an image.', undefined, {}),
  d('beacon', 'Beacon', 'UI', 'Light beam / waypoint visible from far away.', 'beacon_device', {}),

  // --- Cameras & controls ---
  d('orbit_camera', 'Orbit Camera', 'Cameras', 'Third-person orbit camera for the player.', 'gameplay_camera_orbit_device', {}),
  d('fixed_point_camera', 'Fixed Point Camera', 'Cameras', 'Camera locked to a position (horror, side-scroller).', 'gameplay_camera_fixed_point_device', {}),
  d('fixed_angle_camera', 'Fixed Angle Camera', 'Cameras', 'Top-down / isometric camera.', 'gameplay_camera_fixed_angle_device', {}),
  d('first_person_camera', 'First Person Camera', 'Cameras', 'First-person view.', undefined, {}),

  // --- More atmosphere ---
  d('customizable_light', 'Customizable Light', 'Atmosphere', 'Coloured light that can be toggled.', 'customizable_light_device', {}),
  d('audio_mixer', 'Audio Mixer', 'Atmosphere', 'Controls volume buses.', 'audio_mixer_device', {}),
  d('crowd_volume', 'Crowd Volume', 'Atmosphere', 'Cheering crowd in stands.', 'crowd_volume_device', {}),
  d('dance_mannequin', 'Dance Mannequin', 'Atmosphere', 'Mannequin that shows a dance.', 'dance_mannequin_device', {}),
  d('fire', 'Fire Device', 'Atmosphere', 'Spreading or static fire.', undefined, {}),
  d('vfx_spawner', 'VFX Spawner', 'Atmosphere', 'Particle effects (smoke, sparks, confetti).', undefined, {}),

  // --- Music (Patchwork) ---
  d('note_sequencer', 'Note Sequencer', 'Music', 'Patchwork melody sequencer.', undefined, {}),
  d('drum_sequencer', 'Drum Sequencer', 'Music', 'Patchwork drum sequencer.', undefined, {}),
  d('instrument_player', 'Instrument Player', 'Music', 'Plays a Patchwork instrument.', undefined, {}),
  d('omega_synthesizer', 'Omega Synthesizer', 'Music', 'Patchwork synthesizer.', undefined, {}),
  d('speaker', 'Speaker', 'Music', 'Outputs Patchwork audio.', undefined, {}),
];

export const DEVICE_MAP: Record<string, DeviceDef> = Object.fromEntries(DEVICES.map((x) => [x.id, x]));
export const DEVICE_CATEGORIES = [...new Set(DEVICES.map((x) => x.category))];

/** Which device each map feature turns into when the island is built. */
export const FEATURE_DEVICE: Record<string, string> = {
  reboot_van: 'reboot_van',
  vault: 'vault',
  boss: 'boss_spawner',
  medallion: 'boss_spawner',
  vending_machine: 'vending_machine',
  launch_pad: 'launch_pad',
  supply_drop: 'supply_drop',
  campfire: 'campfire',
  zipline: 'zipline',
  rift: 'rift',
  spawn_pad: 'player_spawner',
  team_spawn: 'player_spawner',
  capture_zone: 'capture_area',
  flag: 'capture_item_spawner',
  bomb_site: 'bomb',
  checkpoint: 'checkpoint_pad',
  finish_line: 'trigger',
  race_checkpoint: 'race_checkpoint',
  tycoon_plot: 'button',
  shop: 'vending_machine',
  upgrade_button: 'conditional_button',
  creature_spawner: 'creature_spawner',
  guard_spawner: 'guard_spawner',
  vehicle_spawner: 'vehicle_spawner',
  powerup: 'health_powerup',
  turret: 'automated_turret',
  teleporter: 'teleporter',
  trap: 'damage_volume',
  collectible: 'collectible_object',
  hiding_spot: 'mutator_zone',
  item_spawner: 'item_spawner',
  minigame_pad: 'trigger',
  npc: 'npc_spawner',
  wildlife: 'wildlife_spawner',
  objective: 'objective',
  sentry: 'sentry',
  bouncer: 'bouncer',
  moving_platform: 'prop_mover',
  speed_boost: 'speed_boost',
};
