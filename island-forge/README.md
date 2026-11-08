# Island Forge

Type an island idea, pick **Reload**, **Battle Royale** or **Blitz**, and an AI designs a full Fortnite-style island layout: named locations, biomes, roads, rivers, lakes, reboot vans, vaults, bosses, medallions, the battle bus route, the storm phases and the match rules. Then export it for UEFN.

![modes](https://img.shields.io/badge/modes-Reload%20%C2%B7%20Battle%20Royale%20%C2%B7%20Blitz-ffd60a)

## Quick start

```bash
cd island-forge
npm install
npm start            # http://localhost:5173
```

Optional: set your key before starting so you don't have to paste it in the app:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

## Choosing the AI

| Provider | Default model | Key |
|---|---|---|
| **Claude (Anthropic)**, recommended default | `claude-opus-5-5` (also `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-fable-5-1`) | `ANTHROPIC_API_KEY` or paste it in the app |
| OpenAI or any OpenAI-compatible API (OpenRouter, LM Studio, Groq…) | `gpt-5` (type any model, change the base URL) | `OPENAI_API_KEY` or in the app |
| Google Gemini | `gemini-2.5-flash` | `GEMINI_API_KEY` or in the app |
| Ollama (local) | `llama3.1` | none |
| Offline generator | — | none. Instant, works with no server. |

Claude gets the map schema as a structured output format, so its answer always parses. The other providers get the schema in the prompt, and every answer goes through the same normalizer, which fixes out-of-range values.

Keys typed in the app go only to your local server for that one request. They're saved in your browser only if you tick **Remember key**.

## Game modes

| | Reload | Battle Royale | Blitz |
|---|---|---|---|
| Island size | ~1000 m | ~2500 m | ~750 m |
| Players / teams | 40, squads | 100, squads | 36, solos |
| POIs | 5–8 | 12–18 | 4–6 |
| Respawn | on while a teammate lives, stops at storm phase 4 | off, reboot vans | off |
| Storm | 6 phases | 9 phases | 5 fast phases |
| Extras | vault, launch pads, rift | vaults, bosses, 8 reboot vans | medallion bosses |

These are starting presets. The AI adjusts them when your prompt asks for something different, and you can edit the rules, island name, tagline and POI names in the **Details** tab.

## Exporting to UEFN

In the **UEFN** tab:

- **UEFN package (.zip):** everything below plus `README.md`, a step-by-step guide with world coordinates for every POI and feature, and the device settings for Island Settings and the storm phases.
- **Island image (.jpg):** a 1920×1080 thumbnail for publishing, kept under 1 MB.
- **Minimap (.png):** a 1024×1024 top-down layout with an A–J / 1–10 grid.
- **Verse device (.verse):** a `creative_device` holding every marker position. Place it at your island's centre, pick a marker prop, and press play. It spawns a prop at each POI, feature, bus point and the final circle.
- **Map spec (.json):** the full layout.

### Importing into a new UEFN island

1. Create a new UEFN project (Blank island template).
2. Copy the `.verse` file into your project's Verse folder and **Build Verse Code**.
3. Drag the generated `*_layout_device` into the level at the island centre and choose marker props.
4. Launch a session. Markers show where to build each location. Shape the terrain to match `minimap.png`.
5. Set the devices from the package README and upload `thumbnail.jpg` when you publish.

To load a map back into Island Forge, use **Import .json / .zip** or drag the file onto the page.

### Limits

- UEFN has no public file format for injecting a finished level, so no tool can write a ready-made `.umap`. This one gives you the layout, positions, rules and Verse markers, and you build the terrain and buildings in UEFN.
- The Verse file is generated, not compiled here. It uses the standard `SpawnProp` API. If a UEFN update renames something, the compiler error points at the line to fix.

## Development

```bash
npm test     # node --test: generator, normalizer, Verse/README output, zip, provider routing
```

| File | What it does |
|---|---|
| `server.js` | Static server and `/api/generate` |
| `providers.js` | Claude (Anthropic SDK), OpenAI-compatible, Gemini, Ollama, offline |
| `public/lib/modes.js` | Mode presets, the JSON schema, the normalizer |
| `public/lib/procedural.js` | Offline generator |
| `public/lib/render.js` | Minimap and thumbnail renderer (canvas) |
| `public/lib/uefn.js` | Verse device and setup guide |
| `public/lib/zip.js` | Dependency-free zip writer and reader |

Not affiliated with or endorsed by Epic Games. Fortnite and UEFN are trademarks of Epic Games, Inc.
