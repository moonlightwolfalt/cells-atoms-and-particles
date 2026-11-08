# Island Forge for Python

A command-line tool and library for Island Forge map specs. Use it to generate islands in bulk, check them, render previews and download UEFN packages.

```bash
pip install -e ".[claude,render]"     # from island-forge/python
```

## Commands

```bash
island-forge modes                                   # all 31 island types
island-forge devices --category Logic                # UEFN device catalog
island-forge catalog                                 # prefabs, galleries, chests, items, vehicles, creatures
island-forge catalog prefabs --search castle

# Through a running Island Forge server (npm start):
island-forge generate "pizza tycoon on a beach" --mode tycoon --provider anthropic   # or openai (ChatGPT), gemini, deepseek, grok, mistral, llama, qwen, kimi
island-forge generate "lava temple run" --mode deathrun --provider offline -o run.json
island-forge batch prompts.txt --out-dir islands      # one prompt per line, or "mode | prompt"
island-forge package run.json                          # UEFN package zip
island-forge verse run.json --out-dir Verse            # .verse files

# Straight to Claude with the Anthropic Python SDK (no server):
ANTHROPIC_API_KEY=sk-ant-... island-forge generate "snow fort" --mode box_fights --direct

# Offline tools:
island-forge validate run.json
island-forge info run.json
island-forge markers run.json -o markers.csv           # UEFN world coordinates
island-forge render run.json -o preview.png            # quick Pillow preview
```

`--direct` saves Claude's raw layout. To get the device plan and Verse files, import it into the web app or send it through the server.

## Library

```python
from island_forge import IslandForgeClient, load_spec, validate_spec, summarize

client = IslandForgeClient("http://localhost:5173")
spec = client.generate("haunted mansion", mode="prop_hunt", provider="offline")
assert validate_spec(spec) == []
print(summarize(spec))
open("mansion.zip", "wb").write(client.package(spec))
```

## Tests

```bash
pip install -e ".[dev]" && pytest
ISLAND_FORGE_SERVER=http://localhost:5173 pytest   # also runs against a real server
```
