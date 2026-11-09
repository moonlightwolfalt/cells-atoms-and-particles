"""Load, validate and inspect Island Forge map specs (the JSON the web app exports)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .catalog import CATALOG_IDS, DEVICES, FEATURE_TYPES, MODES

CM_PER_M = 100
MAX_ELEVATION_CM = 6000

REQUIRED = {
    "format": str,
    "mode": str,
    "name": str,
    "map_size_m": (int, float),
    "pois": list,
    "features": list,
    "storm": dict,
    "rules": dict,
    "publish": dict,
    "devices": list,
}


def load_spec(path: str | Path) -> dict[str, Any]:
    """Read a map spec from a .json file (or the map-spec.json inside a UEFN package folder)."""
    p = Path(path)
    if p.is_dir():
        p = p / "map-spec.json"
    return json.loads(p.read_text(encoding="utf-8"))


def save_spec(spec: dict[str, Any], path: str | Path) -> Path:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(spec, indent=2) + "\n", encoding="utf-8")
    return p


def validate_spec(spec: Any) -> list[str]:
    """Return a list of problems; an empty list means the spec is usable."""
    if not isinstance(spec, dict):
        return ["spec must be a JSON object"]
    problems: list[str] = []
    for key, kind in REQUIRED.items():
        if key not in spec:
            problems.append(f"missing '{key}'")
        elif not isinstance(spec[key], kind):
            problems.append(f"'{key}' has the wrong type")
    if problems:
        return problems
    if not str(spec["format"]).startswith("island-forge/map@"):
        problems.append(f"unknown format {spec['format']!r}")
    if spec["mode"] not in MODES:
        problems.append(f"unknown mode {spec['mode']!r}")
    if not spec["pois"]:
        problems.append("needs at least one location")

    def in_range(item: dict[str, Any], label: str) -> None:
        for axis in ("x", "y"):
            v = item.get(axis)
            if not isinstance(v, (int, float)) or not 0 <= v <= 1:
                problems.append(f"{label}: {axis} must be between 0 and 1")

    for i, p in enumerate(spec["pois"]):
        in_range(p, f"pois[{i}] ({p.get('name', '?')})")
        if p.get("prefab") and not _known(p["prefab"]):
            problems.append(f"pois[{i}]: unknown prefab {p['prefab']!r}")
        for extra in p.get("extra_prefabs", []):
            if not _known(extra):
                problems.append(f"pois[{i}]: unknown extra prefab {extra!r}")
    for key, ids in (spec.get("loot") or {}).items():
        for id_ in ids:
            if not _known(id_):
                problems.append(f"loot.{key}: unknown id {id_!r}")
    for i, f in enumerate(spec["features"]):
        in_range(f, f"features[{i}]")
        if f.get("type") not in FEATURE_TYPES:
            problems.append(f"features[{i}]: unknown type {f.get('type')!r}")
    for i, d in enumerate(spec["devices"]):
        if d.get("device") not in DEVICES:
            problems.append(f"devices[{i}]: unknown device {d.get('device')!r}")
    phases = spec["storm"].get("phases", [])
    radii = [p.get("end_radius_pct", 0) for p in phases]
    if radii != sorted(radii, reverse=True):
        problems.append("storm phases must shrink")
    return problems


def to_world(spec: dict[str, Any], x: float, y: float, elevation: float = 0.0) -> tuple[int, int, int]:
    """Map 0..1 coordinates to UEFN centimetres around the island centre (+X north, +Y east)."""
    size_cm = spec["map_size_m"] * CM_PER_M
    return (round(-(y - 0.5) * size_cm) + 0, round((x - 0.5) * size_cm) + 0, round(elevation * MAX_ELEVATION_CM) + 0)


def grid_ref(x: float, y: float) -> str:
    col = "ABCDEFGHIJ"[min(9, max(0, int(x * 10)))]
    row = min(10, max(1, int(y * 10) + 1))
    return f"{col}{row}"


def markers(spec: dict[str, Any]) -> list[dict[str, Any]]:
    """Every location and feature with grid reference and UEFN world coordinates."""
    out = []
    for p in spec["pois"]:
        X, Y, Z = to_world(spec, p["x"], p["y"], p.get("elevation", 0))
        out.append({"label": p["name"], "category": "poi", "grid": grid_ref(p["x"], p["y"]), "X": X, "Y": Y, "Z": Z})
    for f in spec["features"]:
        X, Y, Z = to_world(spec, f["x"], f["y"])
        out.append({"label": f["type"], "category": f["type"], "grid": grid_ref(f["x"], f["y"]), "X": X, "Y": Y, "Z": Z})
    return out


def _known(id_: str) -> bool:
    """Catalog ids, plus entries the user imported into the web app (custom_*)."""
    return id_ in CATALOG_IDS or id_.startswith("custom_")


def _name(id_: str | None) -> str | None:
    if not id_:
        return None
    return CATALOG_IDS.get(id_, {}).get("name", id_)


def summarize(spec: dict[str, Any]) -> dict[str, Any]:
    mode = MODES.get(spec["mode"], {})
    feature_counts: dict[str, int] = {}
    for f in spec["features"]:
        feature_counts[f["type"]] = feature_counts.get(f["type"], 0) + 1
    device_counts: dict[str, int] = {}
    for d in spec["devices"]:
        if d.get("enabled", True):
            device_counts[d["device"]] = device_counts.get(d["device"], 0) + 1
    return {
        "name": spec["name"],
        "mode": mode.get("label", spec["mode"]),
        "category": mode.get("category"),
        "map_size_m": spec["map_size_m"],
        "players": spec["rules"].get("max_players"),
        "locations": [p["name"] for p in spec["pois"]],
        "features": feature_counts,
        "devices": device_counts,
        "storm_phases": len(spec["storm"].get("phases", [])),
        "builds": {
            p["name"]: {
                "prefab": _name(p.get("prefab")),
                "extra_prefabs": [_name(x) for x in p.get("extra_prefabs", [])],
                "galleries": [_name(g) for g in p.get("galleries", [])],
            }
            for p in spec["pois"]
        },
        "loot": {k: [_name(i) for i in v] for k, v in (spec.get("loot") or {}).items()},
        "verse_modules": mode.get("verse", []),
        "tags": spec["publish"].get("tags", []),
    }
