# Island Forge

Describe an island, pick one of **31 Fortnite / UEFN island types**, and an AI designs the whole thing. You get the layout, terrain, every UEFN device it needs with settings, the Verse code for the game mode, a 3D preview, the island image and the publish text. Then you export all of it for UEFN.

| Part | Tech | Folder |
|---|---|---|
| **Web app** (main app) | TypeScript, React 19, Tailwind CSS 4, WebGL (three.js), HTML5 Canvas, Vite | [`web/`](web/) |
| **Shared core**: island types, devices, Verse library, terrain, exporters | TypeScript (runs in browsers, Node and React Native) | [`core/`](core/) |
| **Server**: AI providers and HTTP API | TypeScript on Node 22+, Anthropic SDK | [`server/`](server/) |
| **Python** toolkit and CLI | Python 3.10+, optional Anthropic SDK and Pillow | [`python/`](python/) |
| **Ruby** gem and CLI | Ruby 3 (standard library only) | [`ruby/`](ruby/) |
| **Mobile app** | React Native and Expo (iOS, Android, web) | [`mobile/`](mobile/) |
| **Shared schema**: map format, modes, devices | JSON Schema | [`schema/`](schema/) |

## Quick start

```bash
cd island-forge
npm install
npm run build        # builds the web app
npm start            # http://localhost:5173
```

During development, `npm run dev` runs the API on :5174 and the Vite dev server on :5173 with hot reload.

To use Claude without pasting a key into the app, set it before starting:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

## What you can make: 31 island types

| Category | Island types |
|---|---|
| Battle Royale | Battle Royale · Reload · Blitz · Zero Build BR · Zone Wars |
| Combat | Box Fights · 1v1 Build Fights · Red vs Blue · Free For All · Gun Game · Sniper Duel |
| Objective | Capture the Flag · King of the Hill · Domination · Search & Destroy |
| Party & Social | Prop Hunt · Hide & Seek · Infected · Murder Mystery · Party Games · Hangout / Roleplay |
| Parkour & Racing | Deathrun / Parkour · Obstacle Party · Racing · Edit / Aim Course |
| Survival & Horror | Wave Defense · Horror Escape · Escape Room · Survival Island |
| Tycoon & Sim | Tycoon · Simulator / Clicker |

Each type has its own layout style:
- **Island:** a coastline with named locations (POIs).
- **Arena:** team bases on opposite sides.
- **Course:** a winding path with ordered checkpoints, or a race loop.
- **Plots:** a tycoon hub with plots around it.
- **Hub:** a town for social and party modes.

Each type also comes with its own rules, storm (or none), features, devices and Verse modules.

## What the web app does

- **Generate** with Claude (the default, `claude-opus-5-5`), OpenAI or any OpenAI-compatible API, Gemini, Ollama, or the instant offline generator.
- **Map editor:** drag locations and features around, add new ones from 37 feature types, edit team, order and size, and delete. Undo and redo with Ctrl+Z and Ctrl+Shift+Z.
- **3D view (WebGL):** terrain from the same height field the heightmap export uses, plus water, buildings, labels, feature beacons, the storm ring and the Battle Bus.
- **Island image:** a 1920×1080 thumbnail. It can use a shot of the 3D view as its picture.
- **Devices:** the planned UEFN devices for the island, which you can turn on or off and change settings for. The full catalog of 80 devices is there to add more.
- **Verse:** the generated Verse devices for the island type, with syntax colouring, copy, download and step-by-step wiring instructions.
- **Details and rules:** name, time of day, biome, map size, players, teams, respawns, rounds, score, building, loot and storm.
- **Publish:** title (40 characters max), description, tags and release notes.
- **Export:** the full UEFN package or any single file.
- **Import:** load a `.json` or `.zip` you exported before, or drop it on the page.

## The UEFN package

| File | Use in UEFN |
|---|---|
| `README.md` | Step-by-step import guide with coordinates for every location and the device and storm settings |
| `heightmap-1009.png` | 16-bit grayscale heightmap, 1009×1009 (a standard Unreal landscape size), for Landscape import or as a sculpting reference |
| `biome-paint.png` | Shows which landscape material goes where |
| `Verse/*.verse` | Verse devices for the island type (see below) |
| `devices.csv` | Every device with UEFN world coordinates and settings |
| `publish.txt` | Title, description, tags and release notes |
| `thumbnail.jpg` / `minimap.png` | Island image (1920×1080, under 1 MB) and top-down map |
| `map-spec.json` | The full island, which you can re-import into any Island Forge client |

### Verse library (13 modules)

| Module | Used by |
|---|---|
| Layout markers: spawns a prop at every location so you can build on the layout | every island type |
| Elimination scoring: points per elimination, ends the game at the score limit | BR, combat and objective modes |
| Match HUD: custom on-screen title, countdown and hint built with Verse UI | every island type |
| Round manager: pre-round barrier countdown and round timer | Zone Wars, Box Fights, party modes |
| Reload respawns: respawn only while a teammate lives, stopping at a storm phase | Reload |
| Gun Game ladder: an elimination moves you to the next weapon | Gun Game |
| Zone control: King of the Hill and Domination scoring | KotH, Domination |
| Course timer: in-order checkpoints, finish times, best times | Deathrun, Obstacle Party, Racing, Edit Course |
| Tycoon economy: claimable plot, income, upgrade buttons that reveal buildings | Tycoon, Simulator |
| Creature waves: escalating waves with breaks between them | Wave Defense, Survival |
| Collect to escape: collect items to open the exit | Horror, Escape Room |
| Team swap: caught players join the hunters | Prop Hunt, Hide & Seek, Infected |
| Persistent stats: matches and eliminations saved across sessions | many island types |

### Limits

- **No finished level file.** UEFN has no public file format for injecting a finished level, so no tool can write a ready-made `.umap`. Island Forge gives you everything around it, and you build the terrain and buildings in UEFN using the markers, heightmap and guide.
- **Verse is generated, not compiled.** The Verse files use long-standing Fortnite Verse APIs but haven't been compiled in UEFN by this tool. If a UEFN update renames something, the compiler error points at the line to fix.

## Other clients

- **Python:** `pip install -e python[claude,render]`, then `island-forge generate "pizza tycoon" --mode tycoon`. See [python/README.md](python/README.md).
- **Ruby:** `ruby ruby/bin/island-forge-rb generate "haunted hospital" --mode horror`. See [ruby/README.md](ruby/README.md).
- **Mobile:** `cd mobile && npm install && npm start`. See [mobile/README.md](mobile/README.md).

## API

| Route | What it does |
|---|---|
| `GET /api/providers` | AI providers, and which have keys set on the server |
| `GET /api/catalog` | Island types, devices, Verse modules |
| `GET /api/schema` | JSON schema the AI answers in |
| `POST /api/generate` | `{prompt, mode, provider, model?, apiKey?, baseUrl?}` → `{spec}` |
| `POST /api/verse` | `{spec}` → `{files}` |
| `POST /api/readme` | `{spec}` → setup guide (Markdown) |
| `POST /api/package` | `{spec}` → UEFN package (.zip, without the browser-rendered images) |

## Development

```bash
npm test             # core and server tests (node --test)
npm run typecheck    # TypeScript for core, server and scripts
npx tsc -p web/tsconfig.json
npm run schema       # regenerate /schema and the Python/Ruby data copies after changing the core
cd python && pytest  # Python tests
ruby -Ilib ruby/test/test_island_forge.rb   # Ruby tests (run from island-forge/)
cd mobile && npx tsc --noEmit               # React Native typecheck
```

Not affiliated with or endorsed by Epic Games. Fortnite and UEFN are trademarks of Epic Games, Inc.
