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


def mode_info(mode_id: str) -> dict[str, Any]:
    try:
        return MODES[mode_id]
    except KeyError:
        raise KeyError(f"Unknown mode {mode_id!r}. Known modes: {', '.join(sorted(MODES))}") from None
