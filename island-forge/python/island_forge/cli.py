"""island-forge command line: generate islands, inspect specs, render previews, export UEFN packages."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

from .catalog import CATALOG, DEVICES, MODES, search_catalog
from .client import IslandForgeClient, IslandForgeError
from .spec import load_spec, markers, save_spec, summarize, validate_spec


def _slug(name: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-") or "island"


def cmd_modes(args: argparse.Namespace) -> int:
    by_cat: dict[str, list[dict]] = {}
    for m in MODES.values():
        by_cat.setdefault(m["category"], []).append(m)
    for cat, modes in by_cat.items():
        print(f"\n{cat}")
        for m in modes:
            print(f"  {m['id']:<20} {m['label']:<22} {m['rules']['max_players']:>3}p  {m['blurb']}")
    return 0


def cmd_devices(args: argparse.Namespace) -> int:
    rows = [d for d in DEVICES.values() if not args.category or d["category"].lower() == args.category.lower()]
    for d in rows:
        print(f"{d['id']:<26} {d['category']:<18} {d['name']}")
    return 0


def cmd_catalog(args: argparse.Namespace) -> int:
    if not args.kind:
        for kind, entries in CATALOG.items():
            print(f"{kind:<10} {len(entries):>4} entries")
        return 0
    for e in search_catalog(args.kind, args.search or ""):
        print(f"{e['id']:<34} {e['category']:<26} {e['name']}")
    return 0


def cmd_generate(args: argparse.Namespace) -> int:
    if args.mode not in MODES:
        print(f"Unknown mode {args.mode!r}. Run `island-forge modes`.", file=sys.stderr)
        return 2
    if args.direct:
        from .claude import generate_with_claude

        spec = generate_with_claude(args.prompt, args.mode, model=args.model or "claude-opus-5-5")
        out = Path(args.out or f"{_slug(spec.get('name', 'island'))}.layout.json")
        save_spec(spec, out)
        print(f"Saved raw Claude layout to {out}. Open it in the web app (Import) to get devices and Verse.")
        return 0
    client = IslandForgeClient(args.server)
    spec = client.generate(args.prompt, args.mode, provider=args.provider, model=args.model)
    out = Path(args.out or f"{_slug(spec['name'])}.island.json")
    save_spec(spec, out)
    print(f"{spec['name']} ({MODES[spec['mode']]['label']}): {len(spec['pois'])} locations, {len(spec['features'])} features, {len(spec['devices'])} devices -> {out}")
    return 0


def cmd_batch(args: argparse.Namespace) -> int:
    client = IslandForgeClient(args.server)
    out_dir = Path(args.out_dir)
    lines = [l.strip() for l in Path(args.prompts).read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")]
    failures = 0
    for i, line in enumerate(lines, 1):
        mode, _, prompt = line.partition("|") if "|" in line else (args.mode, "", line)
        mode = mode.strip() or args.mode
        try:
            spec = client.generate(prompt.strip(), mode, provider=args.provider, model=args.model)
            path = save_spec(spec, out_dir / f"{i:03d}-{_slug(spec['name'])}.island.json")
            print(f"[{i}/{len(lines)}] {spec['name']} -> {path}")
        except IslandForgeError as e:
            failures += 1
            print(f"[{i}/{len(lines)}] failed: {e}", file=sys.stderr)
    return 1 if failures else 0


def cmd_validate(args: argparse.Namespace) -> int:
    problems = validate_spec(load_spec(args.spec))
    if problems:
        for p in problems:
            print(f"- {p}")
        return 1
    print("OK")
    return 0


def cmd_info(args: argparse.Namespace) -> int:
    print(json.dumps(summarize(load_spec(args.spec)), indent=2))
    return 0


def cmd_markers(args: argparse.Namespace) -> int:
    rows = markers(load_spec(args.spec))
    out = open(args.out, "w", newline="", encoding="utf-8") if args.out else sys.stdout
    writer = csv.DictWriter(out, fieldnames=["label", "category", "grid", "X", "Y", "Z"])
    writer.writeheader()
    writer.writerows(rows)
    if args.out:
        out.close()
        print(f"Wrote {len(rows)} markers to {args.out}")
    return 0


def cmd_render(args: argparse.Namespace) -> int:
    from .render import render_minimap

    spec = load_spec(args.spec)
    out = render_minimap(spec, args.out or f"{_slug(spec['name'])}-preview.png", size=args.size)
    print(f"Wrote {out}")
    return 0


def cmd_package(args: argparse.Namespace) -> int:
    spec = load_spec(args.spec)
    data = IslandForgeClient(args.server).package(spec)
    out = Path(args.out or f"{_slug(spec['name'])}-uefn.zip")
    out.write_bytes(data)
    print(f"Wrote UEFN package {out} ({len(data):,} bytes)")
    return 0


def cmd_verse(args: argparse.Namespace) -> int:
    spec = load_spec(args.spec)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for f in IslandForgeClient(args.server).verse(spec):
        (out_dir / f["path"]).write_text(f["code"], encoding="utf-8")
        print(f"{out_dir / f['path']}  ({f['title']})")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="island-forge", description="Generate Fortnite / UEFN islands with AI and export them for UEFN.")
    p.add_argument("--server", default="http://localhost:5173", help="Island Forge server URL (default: %(default)s)")
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("modes", help="list every island type").set_defaults(func=cmd_modes)
    d = sub.add_parser("devices", help="list the UEFN device catalog")
    d.add_argument("--category")
    d.set_defaults(func=cmd_devices)

    c = sub.add_parser("catalog", help="browse the Fortnite Creative catalog (prefabs, galleries, chests, items, vehicles, creatures)")
    c.add_argument("kind", nargs="?", choices=list(CATALOG))
    c.add_argument("--search")
    c.set_defaults(func=cmd_catalog)

    g = sub.add_parser("generate", help="generate an island from a prompt")
    g.add_argument("prompt")
    g.add_argument("--mode", default="reload")
    g.add_argument("--provider", default="anthropic", choices=["anthropic", "claude_code", "openai", "gemini", "deepseek", "grok", "mistral", "llama", "qwen", "kimi", "compatible", "ollama", "offline"], help="anthropic (Claude), claude_code (Claude Code via the Agent SDK), openai (ChatGPT), gemini, deepseek, grok, mistral, llama, qwen, kimi, compatible, ollama or offline")
    g.add_argument("--model")
    g.add_argument("--direct", action="store_true", help="call Claude directly with the Anthropic Python SDK (no server)")
    g.add_argument("-o", "--out")
    g.set_defaults(func=cmd_generate)

    b = sub.add_parser("batch", help="generate many islands from a text file (one prompt per line, optional 'mode | prompt')")
    b.add_argument("prompts")
    b.add_argument("--mode", default="reload")
    b.add_argument("--provider", default="anthropic")
    b.add_argument("--model")
    b.add_argument("--out-dir", default="islands")
    b.set_defaults(func=cmd_batch)

    for name, func, helptext in [("validate", cmd_validate, "check a map spec"), ("info", cmd_info, "summarize a map spec")]:
        c = sub.add_parser(name, help=helptext)
        c.add_argument("spec")
        c.set_defaults(func=func)

    m = sub.add_parser("markers", help="export every location/feature with UEFN coordinates as CSV")
    m.add_argument("spec")
    m.add_argument("-o", "--out")
    m.set_defaults(func=cmd_markers)

    r = sub.add_parser("render", help="render a quick minimap preview PNG (needs Pillow)")
    r.add_argument("spec")
    r.add_argument("-o", "--out")
    r.add_argument("--size", type=int, default=1024)
    r.set_defaults(func=cmd_render)

    k = sub.add_parser("package", help="download the full UEFN package zip from the server")
    k.add_argument("spec")
    k.add_argument("-o", "--out")
    k.set_defaults(func=cmd_package)

    v = sub.add_parser("verse", help="write the Verse files for a spec")
    v.add_argument("spec")
    v.add_argument("--out-dir", default="Verse")
    v.set_defaults(func=cmd_verse)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except (IslandForgeError, RuntimeError, FileNotFoundError, json.JSONDecodeError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
