"""Catalogs shared with the TypeScript core (regenerate with `npm run schema`)."""

from __future__ import annotations

import json
from importlib import resources
from typing import Any


def _load(name: str) -> Any:
    return json.loads(resources.files("island_forge").joinpath("data", name).read_text(encoding="utf-8"))


MAP_SCHEMA: dict[str, Any] = _load("island-map.schema.json")
MODES: dict[str, dict[str, Any]] = {m["id"]: m for m in _load("modes.json")}
DEVICES: dict[str, dict[str, Any]] = {d["id"]: d for d in _load("devices.json")}
FEATURE_TYPES: list[str] = _load("feature-types.json")
#: Fortnite Creative catalog: prefabs, galleries, chests, items, vehicles, creatures.
CATALOG: dict[str, list[dict[str, Any]]] = _load("catalog.json")
CATALOG_IDS: dict[str, dict[str, Any]] = {e["id"]: e for entries in CATALOG.values() for e in entries}


def search_catalog(kind: str, query: str = "") -> list[dict[str, Any]]:
    if kind not in CATALOG:
        raise KeyError(f"Unknown catalog {kind!r}. Known: {', '.join(CATALOG)}")
    q = query.lower()
    return [e for e in CATALOG[kind] if not q or q in f"{e['name']} {e['category']} {' '.join(e['tags'])} {e.get('description', '')}".lower()]


def mode_info(mode_id: str) -> dict[str, Any]:
    try:
        return MODES[mode_id]
    except KeyError:
        raise KeyError(f"Unknown mode {mode_id!r}. Known modes: {', '.join(sorted(MODES))}") from None
