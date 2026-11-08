// Fortnite Creative content catalog: prefabs, galleries, chests & containers, items, vehicles
// and creatures. Names follow Fortnite Creative / UEFN as of the time this was written; Epic
// adds and removes content every season, so the catalog can be extended at runtime with
// registerCatalogEntries() (the web app's "Import catalog" uses it).

export type CatalogKind = 'prefabs' | 'galleries' | 'chests' | 'items' | 'vehicles' | 'creatures';

export interface CatalogEntry {
  id: string;
  name: string;
  category: string;
  /** Matching hints: POI kinds, biomes, themes, rarity, slot... */
  tags: string[];
  description: string;
  size?: 'small' | 'medium' | 'large';
  /** Items: rarity / slot. Chests: what drops. */
  detail?: string;
  /** Set on entries added by the user. */
  custom?: boolean;
}

const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

type Row = [name: string, tags: string, description?: string, size?: 'small' | 'medium' | 'large', detail?: string];
function rows(category: string, list: Row[], prefix = ''): CatalogEntry[] {
  return list.map(([name, tags, description = '', size, detail]) => ({
    id: prefix + slug(name),
    name,
    category,
    tags: tags.split(/\s+/).filter(Boolean),
    description,
    ...(size ? { size } : {}),
    ...(detail ? { detail } : {}),
  }));
}

// ---------------------------------------------------------------- Prefabs
export const PREFABS: CatalogEntry[] = [
  ...rows('Battle Royale Locations', [
    ['Pleasant Park', 'town grassland suburban', 'Suburban houses around a park and soccer pitch.', 'large'],
    ['Retail Row', 'town city grassland shops', 'Shops, a water tower and a market street.', 'large'],
    ['Salty Springs', 'town grassland', 'Small residential town with a gas station.', 'medium'],
    ['Tilted Towers', 'city urban', 'Dense city block with tall buildings and a clock tower.', 'large'],
    ['Lazy Links', 'resort grassland golf', 'Golf course clubhouse and mansion.', 'large'],
    ['Lucky Landing', 'town temple grassland oriental', 'East-Asian themed village with a pagoda.', 'medium'],
    ['Loot Lake', 'landmark lake grassland', 'Lake with a central island house.', 'medium'],
    ['Lonely Lodge', 'resort forest cabin', 'Forest cabins around a tall lookout tower.', 'medium'],
    ['Paradise Palms', 'resort desert city', 'Desert resort town with a hotel and racetrack.', 'large'],
    ['Snobby Shores', 'resort beach mansion', 'Cliff-side luxury mansions.', 'medium'],
    ['Fatal Fields', 'farm grassland', 'Farm with barns, silos and fields.', 'large'],
    ['Junk Junction', 'industrial junkyard', 'Scrapyard with stacked cars and a crusher.', 'medium'],
    ['Haunted Hills', 'ruins swamp spooky castle', 'Graveyard and spooky church on a hill.', 'medium'],
    ['Wailing Woods', 'forest landmark maze', 'Dense forest with a hedge maze and bunker.', 'medium'],
    ['Dusty Divot', 'lab crater desert', 'Crater with research labs.', 'medium'],
    ['Shifty Shafts', 'cave industrial mine', 'Mine tunnels and industrial buildings.', 'medium'],
    ['Tomato Temple', 'temple town restaurant', 'Temple on a hill above a restaurant.', 'small'],
    ['Greasy Grove', 'town restaurant grassland', 'Small town with a burger restaurant.', 'medium'],
    ['Risky Reels', 'landmark cinema grassland', 'Drive-in movie theatre.', 'small'],
    ['Moisty Mire', 'swamp ruins', 'Swampland with a film set.', 'medium'],
    ['Leaky Lake', 'landmark lake grassland', 'Lake with a central house.', 'small'],
    ['Frosty Flights', 'military snow airfield', 'Snowy airfield with hangars.', 'medium'],
    ['Happy Hamlet', 'town snow', 'Snowy village.', 'medium'],
    ['Polar Peak', 'castle snow mountain', 'Castle on a snowy mountain.', 'medium'],
    ['Sunny Steps', 'temple desert', 'Desert temple ruins on terraces.', 'medium'],
    ['Neo Tilted', 'city urban neon futuristic', 'Futuristic neon city.', 'large'],
    ['Mega Mall', 'city shops', 'Large shopping mall.', 'large'],
    ['Pressure Plant', 'industrial lab', 'Industrial plant with a big pressure vessel.', 'medium'],
    ['Lazy Lagoon', 'docks beach pirate', 'Pirate-themed lagoon town.', 'medium'],
    ['Viking Village', 'castle snow mountain viking', 'Viking longhouses on a mountain.', 'medium'],
    ['Pirate Camp', 'docks beach pirate', 'Small pirate encampment.', 'small'],
    ['Sweaty Sands', 'resort beach town', 'Beach town with a boardwalk.', 'medium'],
    ['Holly Hedges', 'town grassland garden', 'Garden centre and suburban houses.', 'medium'],
    ['Misty Meadows', 'town grassland harbor', 'Village with a church and harbor.', 'medium'],
    ['Slurpy Swamp', 'industrial swamp factory', 'Juice factory in a swamp.', 'medium'],
    ['Frenzy Farm', 'farm grassland', 'Farm with barns and fields.', 'medium'],
    ['Steamy Stacks', 'industrial power', 'Power plant with cooling towers.', 'large'],
    ['Craggy Cliffs', 'docks town cliff', 'Fishing town on cliffs.', 'medium'],
    ['Dirty Docks', 'docks industrial', 'Shipping docks and warehouses.', 'medium'],
    ['Weeping Woods', 'forest cabin', 'Woods with a ranger station.', 'medium'],
    ['Catty Corner', 'town desert', 'Small desert town.', 'small'],
    ['Coral Castle', 'ruins beach castle', 'Sunken-island ruins.', 'medium'],
    ['Stealthy Stronghold', 'castle jungle fort', 'Jungle fortress.', 'medium'],
    ['Colossal Coliseum', 'arena ruins', 'Large coliseum arena.', 'large'],
    ['Hunters Haven', 'castle temple jungle', 'Ornate jungle palace.', 'medium'],
    ['Boney Burbs', 'town grassland', 'Suburban houses on a hill.', 'medium'],
    ['Logjam Lumberyard', 'industrial forest', 'Lumber mill and log piles.', 'medium'],
    ['Chonkers Speedway', 'course arena racing', 'Racetrack with stands.', 'large'],
    ['Sanctuary', 'temple futuristic', 'Futuristic sanctuary.', 'medium'],
    ['Shuffled Shrines', 'temple jungle', 'Shrines with a sacred tree.', 'medium'],
  ], 'br_'),
  ...rows('Themed Locations', [
    ['Medieval Castle', 'castle fort medieval forest grassland', 'Stone castle with towers and walls.', 'large'],
    ['Medieval Village', 'town medieval grassland', 'Timber houses and a market.', 'medium'],
    ['Western Town', 'town western desert', 'Saloon, sheriff office and main street.', 'medium'],
    ['Haunted Mansion', 'castle spooky swamp ruins', 'Creepy mansion with a graveyard.', 'medium'],
    ['Pirate Ship', 'docks pirate beach', 'Full-size pirate ship.', 'medium'],
    ['Viking Longship', 'docks viking snow', 'Viking ship.', 'small'],
    ['Desert Temple', 'temple desert ruins', 'Sandstone temple.', 'medium'],
    ['Jungle Temple', 'temple jungle ruins', 'Mossy stepped temple.', 'medium'],
    ['Ice Castle', 'castle snow', 'Castle made of ice.', 'medium'],
    ['Volcano Lair', 'lab volcanic base', 'Villain lair inside a volcano.', 'large'],
    ['Space Base', 'lab base futuristic', 'Sci-fi base modules.', 'medium'],
    ['Agency Headquarters', 'base military lab spy', 'Spy agency headquarters.', 'large'],
    ['Secret Bunker', 'military base cave spy', 'Underground bunker.', 'small'],
    ['Ski Lodge', 'resort snow cabin', 'Mountain lodge with lifts.', 'medium'],
    ['Lighthouse', 'landmark docks beach', 'Coastal lighthouse.', 'small'],
    ['Beach Resort', 'resort beach', 'Hotel and pool by the beach.', 'medium'],
    ['Candy Factory', 'industrial candy', 'Colourful sweets factory.', 'medium'],
    ['Toy Store', 'city shops candy', 'Toy shop interior.', 'small'],
    ['Junkyard', 'industrial junkyard', 'Stacked wrecks and scrap.', 'medium'],
    ['Racetrack Pit Lane', 'course racing', 'Pits, garages and grandstand.', 'medium'],
    ['Stadium', 'arena city', 'Sports stadium.', 'large'],
    ['Skate Park', 'arena city', 'Ramps, rails and bowls.', 'small'],
    ['Prison Block', 'military base', 'Cells, yard and watchtowers.', 'large'],
    ['Hospital', 'city lab spooky', 'Hospital wards and corridors.', 'medium'],
    ['School', 'town city', 'Classrooms, gym and yard.', 'medium'],
    ['Museum', 'city landmark', 'Galleries and exhibits.', 'medium'],
    ['Train Station', 'town industrial', 'Platforms and a station hall.', 'medium'],
    ['Airport Hangar', 'military industrial airfield', 'Hangar and runway.', 'medium'],
    ['Oil Rig', 'industrial docks', 'Offshore oil platform.', 'medium'],
    ['Military Outpost', 'military base fort', 'Sandbags, tents and watchtowers.', 'medium'],
    ['Wild West Fort', 'fort western desert', 'Wooden stockade fort.', 'medium'],
    ['Samurai Village', 'town temple oriental', 'Japanese-style village and shrine.', 'medium'],
    ['Pyramid', 'temple desert landmark', 'Giant pyramid.', 'large'],
    ['Treehouse Village', 'town forest jungle', 'Houses built in the trees.', 'medium'],
    ['Underwater Base', 'lab base docks', 'Sub-sea research base.', 'medium'],
    ['Neon Arcade', 'city neon urban', 'Arcade hall with neon signs.', 'small'],
    ['Nightclub', 'city neon urban party', 'Dance floor and DJ booth.', 'small'],
    ['Farmhouse & Barn', 'farm grassland autumn', 'Farmhouse, barn and silo.', 'medium'],
    ['Pumpkin Patch', 'farm autumn spooky', 'Harvest field with pumpkins.', 'small'],
    ['Gas Station', 'town city', 'Roadside gas station.', 'small'],
    ['Diner', 'town restaurant', 'Roadside diner.', 'small'],
    ['Pizza Restaurant', 'town restaurant city', 'Pizza parlour.', 'small'],
    ['Burger Restaurant', 'town restaurant city', 'Burger joint.', 'small'],
    ['Motel', 'town desert', 'Two-storey roadside motel.', 'small'],
    ['Office Tower', 'city urban', 'Multi-floor office building.', 'medium'],
    ['Apartment Block', 'city urban', 'Apartments with balconies.', 'medium'],
    ['Suburban House', 'town grassland', 'Two-storey family house.', 'small'],
    ['Warehouse', 'industrial docks', 'Large storage warehouse.', 'medium'],
    ['Factory', 'industrial', 'Factory floor with machinery.', 'medium'],
    ['Water Treatment Plant', 'industrial lab', 'Tanks and pipes.', 'medium'],
    ['Wind Farm', 'industrial grassland landmark', 'Wind turbines on a ridge.', 'medium'],
    ['Radio Tower', 'landmark military', 'Tall radio mast.', 'small'],
    ['Observatory', 'landmark lab mountain', 'Telescope dome on a hill.', 'small'],
    ['Ancient Ruins', 'ruins temple', 'Broken columns and arches.', 'medium'],
    ['Cave Network', 'cave mountain', 'Natural cave system.', 'medium'],
    ['Crystal Cave', 'cave candy', 'Glowing crystal cavern.', 'small'],
  ], 'th_'),
  ...rows('Arenas & Game Spaces', [
    ['Box Fight Arena', 'arena base', 'Square arena with spawn boxes.', 'small'],
    ['1v1 Build Arena', 'arena', 'Flat duel platform.', 'small'],
    ['Zone Wars Island', 'arena landmark', 'Compact island for moving zones.', 'medium'],
    ['Team Bases (Red & Blue)', 'base arena team', 'Mirrored team bases.', 'medium'],
    ['Capture Point Plaza', 'plaza arena', 'Open plaza for a capture zone.', 'small'],
    ['Lobby Hub', 'plaza hub', 'Spawn hub with portals.', 'medium'],
    ['Parkour Start Platform', 'plaza start', 'Start area with timer board.', 'small'],
    ['Obstacle Course Section', 'course grassland', 'Jumps, gaps and rails.', 'medium'],
    ['Lava Jump Section', 'course volcanic temple', 'Floating platforms over lava.', 'small'],
    ['Ice Slide Section', 'course snow', 'Slippery slides and ice blocks.', 'small'],
    ['Swinging Axe Hall', 'course castle spooky swamp', 'Corridor of swinging blades.', 'small'],
    ['Rooftop Run', 'course city urban neon', 'Jumps between rooftops.', 'small'],
    ['Jungle Vine Swing', 'course jungle', 'Vines, logs and river jumps.', 'small'],
    ['Candy Bounce Section', 'course candy', 'Jelly bouncers and gumdrop hops.', 'small'],
    ['Pirate Plank Run', 'course pirate beach docks', 'Planks, barrels and cannons.', 'small'],
    ['Desert Ruins Run', 'course desert ruins', 'Crumbling pillars and sand traps.', 'small'],
    ['Finish Podium', 'finish plaza', 'Winners podium and confetti.', 'small'],
    ['Tycoon Plot', 'base plaza tycoon', 'Empty plot with claim pad.', 'medium'],
    ['Shop Strip', 'plaza town shops', 'Row of shops for a hub.', 'medium'],
    ['Horror Corridor', 'spooky lab', 'Dark corridors and rooms.', 'medium'],
    ['Escape Room Set', 'lab castle', 'Linked puzzle rooms.', 'medium'],
    ['Wave Defense Fort', 'fort base', 'Walls and choke points.', 'medium'],
  ], 'ar_'),
];

// ---------------------------------------------------------------- Galleries
export const GALLERIES: CatalogEntry[] = [
  ...rows('Building Galleries', [
    ['Suburban Gallery', 'town grassland'], ['Tilted Town Gallery', 'city urban'], ['Office Gallery', 'city urban'],
    ['Retail Gallery', 'city shops town'], ['Industrial Gallery', 'industrial'], ['Factory Gallery', 'industrial'],
    ['Farm Gallery', 'farm grassland autumn'], ['Barn Gallery', 'farm'], ['Cabin Gallery', 'forest snow cabin'],
    ['Medieval Gallery', 'castle medieval'], ['Castle Gallery', 'castle fort'], ['Haunted Gallery', 'spooky swamp castle'],
    ['Western Gallery', 'western desert town'], ['Desert Gallery', 'desert town'], ['Viking Gallery', 'viking snow'],
    ['Pirate Gallery', 'pirate docks beach'], ['Pirate Camp Gallery', 'pirate beach'], ['Lighthouse Gallery', 'docks beach landmark'],
    ['Docks Gallery', 'docks industrial'], ['Military Gallery', 'military base'], ['Bunker Gallery', 'military base cave'],
    ['Agency Gallery', 'spy base lab'], ['Lab Gallery', 'lab futuristic'], ['Sci-Fi Gallery', 'futuristic lab'],
    ['Neo Tilted Gallery', 'neon futuristic city'], ['Temple Gallery', 'temple oriental'], ['Lucky Landing Gallery', 'oriental temple town'],
    ['Jungle Temple Gallery', 'temple jungle ruins'], ['Ruins Gallery', 'ruins'], ['Stone Pillar Gallery', 'ruins temple'],
    ['Pool Gallery', 'resort'], ['Resort Gallery', 'resort beach'], ['Ski Lodge Gallery', 'snow resort'],
    ['Restaurant Gallery', 'restaurant town'], ['Gas Station Gallery', 'town'], ['Diner Gallery', 'restaurant town'],
    ['Motel Gallery', 'town desert'], ['Prison Gallery', 'military base'], ['Hospital Gallery', 'city lab'],
    ['School Gallery', 'town city'], ['Arena Gallery', 'arena'], ['Stadium Gallery', 'arena city'],
    ['Candy Gallery', 'candy'], ['Toy Gallery', 'candy toy'], ['Winter Village Gallery', 'snow town'],
    ['Floor & Wall Gallery', 'arena base'], ['Metal Wall Gallery', 'industrial base'], ['Brick Wall Gallery', 'town city'],
    ['Wood Wall Gallery', 'cabin farm'], ['Glass Gallery', 'city futuristic'], ['Stairs & Ramps Gallery', 'arena course'],
    ['Roof Gallery', 'town'], ['Door Gallery', 'town city'], ['Window Gallery', 'town city'],
  ], 'gb_'),
  ...rows('Nature Galleries', [
    ['Tree Gallery', 'forest grassland'], ['Pine Tree Gallery', 'forest snow'], ['Palm Tree Gallery', 'beach jungle desert'],
    ['Jungle Gallery', 'jungle'], ['Swamp Gallery', 'swamp'], ['Autumn Gallery', 'autumn'], ['Snow Nature Gallery', 'snow'],
    ['Desert Nature Gallery', 'desert'], ['Rock Gallery', 'mountain'], ['Cliff Gallery', 'mountain beach'],
    ['Lava Gallery', 'volcanic'], ['Crystal Gallery', 'cave candy'], ['Flower Gallery', 'grassland'],
    ['Bush & Shrub Gallery', 'grassland forest'], ['Mushroom Gallery', 'forest swamp'], ['Beach Gallery', 'beach'],
    ['Water & Lake Gallery', 'lake beach'], ['Cave Gallery', 'cave mountain'], ['Coral Gallery', 'beach docks'],
  ], 'gn_'),
  ...rows('Prop Galleries', [
    ['Furniture Gallery', 'town city'], ['Kitchen Gallery', 'town restaurant'], ['Bathroom Gallery', 'town city'],
    ['Office Prop Gallery', 'city'], ['Shop Prop Gallery', 'shops city'], ['Industrial Prop Gallery', 'industrial'],
    ['Farm Prop Gallery', 'farm'], ['Military Prop Gallery', 'military'], ['Medieval Prop Gallery', 'medieval castle'],
    ['Spooky Prop Gallery', 'spooky'], ['Pirate Prop Gallery', 'pirate'], ['Sci-Fi Prop Gallery', 'futuristic lab'],
    ['Sports Prop Gallery', 'arena'], ['Party Prop Gallery', 'party candy'], ['Holiday Prop Gallery', 'snow party'],
    ['Vehicle Wreck Gallery', 'junkyard industrial'], ['Road & Street Gallery', 'town city'], ['Fence Gallery', 'farm town'],
    ['Sign Gallery', 'town city'], ['Lighting Gallery', 'city neon'], ['Neon Sign Gallery', 'neon city'],
    ['Container Gallery', 'docks industrial'], ['Barrels & Crates Gallery', 'docks industrial'], ['Statue Gallery', 'landmark'],
    ['Particle & FX Gallery', 'landmark party'], ['Chests & Ammo Gallery', 'loot'], ['Traps Gallery', 'course trap'],
  ], 'gp_'),
];

// ---------------------------------------------------------------- Chests & containers
export const CHESTS: CatalogEntry[] = rows('Chests & Containers', [
  ['Treasure Chest', 'common loot', 'Standard chest: a weapon, ammo, a consumable and materials.', undefined, 'weapon + ammo + consumable + mats'],
  ['Rare Chest', 'rare loot', 'Higher-rarity chest with more items.', undefined, 'rare+ weapons, heals'],
  ['Ammo Box', 'common ammo', 'Ammo for every weapon type.', undefined, 'ammo'],
  ['Supply Drop', 'rare loot event', 'Falls from the sky with high-rarity loot.', undefined, 'epic+ weapons, shields, mats'],
  ['Supply Llama', 'rare loot', 'Llama piñata full of materials and consumables.', undefined, 'mats, consumables, ammo'],
  ['Cooler', 'common heal', 'Food and healing items.', undefined, 'heals'],
  ['Food Box', 'common heal', 'Food items.', undefined, 'food'],
  ['Ice Machine', 'common', 'Ice to throw.', undefined, 'utility'],
  ['Safe', 'rare loot', 'Locked safe with gold and items.', undefined, 'gold + items'],
  ['Vault Chest', 'epic loot', 'Chest inside a keycard vault.', undefined, 'legendary/mythic'],
  ['Bunker Chest', 'epic loot', 'High-tier chest in bunkers.', undefined, 'epic+ weapons'],
  ['Oathbound Chest', 'rare loot themed', 'Themed chest with a guaranteed rarity.', undefined, 'rare+ weapon'],
  ['Holiday Present', 'common loot snow', 'Holiday gift box.', undefined, 'random item'],
  ['Fishing Spot', 'common heal water', 'Fish with a rod for food and weapons.', undefined, 'fish, items'],
  ['Ammo Crate (Large)', 'common ammo', 'Large ammo crate.', undefined, 'lots of ammo'],
  ['Weapon Rack', 'common loot', 'Rack holding a set weapon (Item Spawner).', undefined, 'set weapon'],
]);

// ---------------------------------------------------------------- Items
export const ITEMS: CatalogEntry[] = [
  ...rows('Assault Rifles', [
    ['Assault Rifle', 'weapon ar'], ['Burst Assault Rifle', 'weapon ar'], ['Heavy Assault Rifle', 'weapon ar'], ['Scoped Assault Rifle', 'weapon ar'],
    ['Infantry Rifle', 'weapon ar'], ['Thermal Scoped Rifle', 'weapon ar'], ['Striker AR', 'weapon ar'], ['Red-Eye Assault Rifle', 'weapon ar'],
  ], 'it_'),
  ...rows('Shotguns', [
    ['Pump Shotgun', 'weapon shotgun'], ['Tactical Shotgun', 'weapon shotgun'], ['Heavy Shotgun', 'weapon shotgun'], ['Combat Shotgun', 'weapon shotgun'],
    ['Lever Action Shotgun', 'weapon shotgun'], ['Charge Shotgun', 'weapon shotgun'], ['Double Barrel Shotgun', 'weapon shotgun'], ['Auto Shotgun', 'weapon shotgun'],
  ], 'it_'),
  ...rows('SMGs & Pistols', [
    ['Submachine Gun', 'weapon smg'], ['Tactical SMG', 'weapon smg'], ['Compact SMG', 'weapon smg'], ['Suppressed SMG', 'weapon smg'], ['Drum Gun', 'weapon smg'],
    ['Pistol', 'weapon pistol'], ['Revolver', 'weapon pistol'], ['Hand Cannon', 'weapon pistol'], ['Dual Pistols', 'weapon pistol'], ['Suppressed Pistol', 'weapon pistol'],
  ], 'it_'),
  ...rows('Snipers & Heavy', [
    ['Bolt-Action Sniper Rifle', 'weapon sniper'], ['Semi-Auto Sniper Rifle', 'weapon sniper'], ['Heavy Sniper Rifle', 'weapon sniper'], ['Hunting Rifle', 'weapon sniper'],
    ['Crossbow', 'weapon bow'], ['Bow', 'weapon bow'], ['Minigun', 'weapon heavy'], ['Light Machine Gun', 'weapon heavy'],
    ['Rocket Launcher', 'weapon explosive'], ['Grenade Launcher', 'weapon explosive'], ['Guided Missile', 'weapon explosive'], ['Quad Launcher', 'weapon explosive'],
  ], 'it_'),
  ...rows('Throwables & Utility', [
    ['Grenade', 'utility explosive'], ['Impulse Grenade', 'utility mobility'], ['Shockwave Grenade', 'utility mobility'], ['Boogie Bomb', 'utility'],
    ['Clinger', 'utility explosive'], ['Stink Bomb', 'utility'], ['Smoke Grenade', 'utility'], ['Remote Explosives', 'utility explosive'],
    ['Port-a-Fort', 'utility build'], ['Launch Pad Item', 'utility mobility'], ['Grappler', 'utility mobility'], ['Grapple Glove', 'utility mobility'],
    ['Shockwave Hammer', 'utility mobility melee'], ['Rift-To-Go', 'utility mobility'], ['Bush', 'utility stealth'], ['Decoy Grenade', 'utility'],
    ['Fishing Rod', 'utility'], ['Flashlight', 'utility horror'], ['Keycard', 'utility key'], ['Pickaxe', 'melee'],
  ], 'it_'),
  ...rows('Healing & Shields', [
    ['Bandages', 'heal'], ['Med Kit', 'heal'], ['Small Shield Potion', 'shield'], ['Shield Potion', 'shield'], ['Chug Jug', 'heal shield'],
    ['Slurp Juice', 'heal shield'], ['Chug Splash', 'heal shield'], ['Med-Mist', 'heal'], ['Cozy Campfire', 'heal'], ['Shield Keg', 'shield'],
    ['Apple', 'heal food'], ['Banana', 'heal food'], ['Mushroom', 'shield food'], ['Coconut', 'heal food'], ['Pepper', 'food speed'],
    ['Flowberry', 'shield food'], ['Slap Juice', 'food stamina'],
  ], 'it_'),
  ...rows('Traps & Materials', [
    ['Damage Trap', 'trap'], ['Spike Trap', 'trap'], ['Bouncer Trap', 'trap mobility'], ['Wall Launcher', 'trap'],
    ['Wood', 'material'], ['Stone', 'material'], ['Metal', 'material'], ['Gold Bars', 'currency'],
  ], 'it_'),
];

// ---------------------------------------------------------------- Vehicles
export const VEHICLES: CatalogEntry[] = rows('Vehicles', [
  ['Sports Car', 'car road racing', 'Fast two-door car.'], ['Sedan', 'car road', 'Four-seat family car.'],
  ['Pickup Truck', 'car road offroad', 'Sturdy pickup.'], ['Semi Truck', 'car road heavy', 'Big rig.'],
  ['Taxi', 'car road city', 'City taxi.'], ['Dirt Bike', 'bike offroad', 'Fast two-wheeler.'],
  ['Quadcrasher', 'offroad', 'Ramming quad bike.'], ['ATK Golf Cart', 'offroad', 'All-terrain kart.'],
  ['Baller', 'offroad', 'Rolling ball with a grapple.'], ['Shopping Cart', 'fun', 'Push-and-ride cart.'],
  ['Motorboat', 'boat water', 'Boat with missiles.'], ['Helicopter (Choppa)', 'air', 'Five-seat helicopter.'],
  ['X-4 Stormwing', 'air plane', 'Prop plane.'], ['UFO', 'air sci-fi', 'Flying saucer.'],
  ['Hoverboard', 'board', 'Hover board.'], ['Driftboard', 'board', 'Hover board with boost.'],
  ['Tank', 'military heavy', 'Armoured tank.'], ['Rocket Racing Car', 'racing', 'High-speed racing car.'],
  ['Battle Bus', 'air spawn', 'Spawn bus for BR modes.'], ['Mech', 'military sci-fi', 'Walking mech.'],
]);

// ---------------------------------------------------------------- Creatures & NPCs
export const CREATURES: CatalogEntry[] = rows('Creatures & NPCs', [
  ['Fiend', 'creature hostile', 'Melee creature.'], ['Elite Fiend', 'creature hostile', 'Stronger fiend.'],
  ['Ranged Fiend', 'creature hostile', 'Ranged attacker.'], ['Brute', 'creature hostile', 'Large tank creature.'],
  ['Elite Brute', 'creature hostile', 'Armoured brute.'], ['Cube Fiend', 'creature hostile', 'Cube monster.'],
  ['Zombie', 'creature hostile horror', 'Shambling undead.'], ['Wolf', 'wildlife hostile', 'Pack predator.'],
  ['Boar', 'wildlife', 'Charges when hit.'], ['Chicken', 'wildlife passive', 'Grab to glide.'],
  ['Frog', 'wildlife passive', 'Hops around.'], ['Raptor', 'wildlife hostile', 'Fast dinosaur.'],
  ['Klombo', 'wildlife passive', 'Huge friendly creature.'], ['Shark', 'wildlife water hostile', 'Hunts in water.'],
  ['Guard (AI)', 'npc hostile', 'Armed patrolling guard.'], ['Henchman', 'npc hostile', 'Boss bodyguard.'],
  ['Boss', 'npc hostile boss', 'Tough boss that drops loot.'], ['Shopkeeper NPC', 'npc friendly', 'Sells items.'],
  ['Quest Giver NPC', 'npc friendly', 'Gives objectives.'], ['Sentry Turret', 'turret hostile', 'Automated turret.'],
]);

// ---------------------------------------------------------------- Registry
export const CATALOG: Record<CatalogKind, CatalogEntry[]> = {
  prefabs: PREFABS,
  galleries: GALLERIES,
  chests: CHESTS,
  items: ITEMS,
  vehicles: VEHICLES,
  creatures: CREATURES,
};

export const CATALOG_LABELS: Record<CatalogKind, string> = {
  prefabs: 'Prefabs',
  galleries: 'Galleries',
  chests: 'Chests & containers',
  items: 'Weapons & items',
  vehicles: 'Vehicles',
  creatures: 'Creatures & NPCs',
};

const index = new Map<string, CatalogEntry>();
const rebuild = () => {
  index.clear();
  for (const list of Object.values(CATALOG)) for (const e of list) index.set(e.id, e);
};
rebuild();

export function catalogEntry(id: string): CatalogEntry | undefined {
  return index.get(id);
}

/** Add or replace user entries (e.g. new season content). Returns how many were added. */
export function registerCatalogEntries(kind: CatalogKind, entries: Partial<CatalogEntry>[]): number {
  const list = CATALOG[kind];
  if (!list) return 0;
  let n = 0;
  for (const e of entries) {
    if (!e || typeof e.name !== 'string' || !e.name.trim()) continue;
    const entry: CatalogEntry = {
      id: (typeof e.id === 'string' && e.id) || `custom_${slug(e.name)}`,
      name: e.name.trim().slice(0, 80),
      category: (typeof e.category === 'string' && e.category) || 'Custom',
      tags: Array.isArray(e.tags) ? e.tags.map(String).slice(0, 20) : [],
      description: typeof e.description === 'string' ? e.description.slice(0, 300) : '',
      ...(e.size ? { size: e.size } : {}),
      ...(e.detail ? { detail: String(e.detail).slice(0, 120) } : {}),
      custom: true,
    };
    const at = list.findIndex((x) => x.id === entry.id);
    if (at >= 0) list[at] = entry;
    else list.push(entry);
    n++;
  }
  rebuild();
  return n;
}

export function catalogCounts(): Record<CatalogKind, number> {
  return Object.fromEntries(Object.entries(CATALOG).map(([k, v]) => [k, v.length])) as Record<CatalogKind, number>;
}

// ---------------------------------------------------------------- Suggestions

function score(entry: CatalogEntry, wants: string[]): number {
  let s = 0;
  for (const w of wants) if (entry.tags.includes(w)) s += 1;
  return s;
}

function pickStable<T>(list: T[], key: string): T {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return list[(h >>> 0) % list.length];
}

/** Best prefab for a location, from its kind, size and the island's theme/biome words. */
export function suggestPrefab(kind: string, themeWords: string[], size: string, key: string, used: Set<string> = new Set()): string {
  const wants = [kind, ...themeWords];
  // Game-space prefabs (arenas, course sections, plots) only suit game-space locations.
  const gameSpace = ['arena', 'base', 'plaza', 'course'].includes(kind);
  const eligible = PREFABS.filter((p) => gameSpace || p.category !== 'Arenas & Game Spaces');
  const scored = eligible.map((p) => ({ p, s: score(p, wants) * 2 + (p.size === size ? 1 : 0) + (p.tags.includes(kind) ? 6 : 0) }));
  const best = Math.max(...scored.map((x) => x.s));
  if (best <= 0) return '';
  // Prefer a near-best prefab this island hasn't used yet, so locations don't all look the same.
  const fresh = scored.filter((x) => x.s >= best - 2 && x.s >= 6 && !used.has(x.p.id));
  const pool = fresh.length ? fresh.filter((x) => x.s === Math.max(...fresh.map((f) => f.s))) : scored.filter((x) => x.s === best);
  const id = pickStable(pool.map((x) => x.p), key).id;
  used.add(id);
  return id;
}

/** 2-3 galleries that suit a location. */
export function suggestGalleries(kind: string, themeWords: string[], key: string): string[] {
  const wants = [kind, ...themeWords];
  const out: string[] = [];
  for (const cat of ['Building Galleries', 'Nature Galleries', 'Prop Galleries']) {
    const list = GALLERIES.filter((g) => g.category === cat);
    const scored = list.map((g) => ({ g, s: score(g, wants) }));
    const best = Math.max(...scored.map((x) => x.s));
    if (best > 0) out.push(pickStable(scored.filter((x) => x.s === best).map((x) => x.g), key + cat).id);
  }
  return out;
}
