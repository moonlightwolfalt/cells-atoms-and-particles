"""Quick minimap preview with Pillow (`pip install island-forge[render]`).

This is a lightweight preview; the web app renders the full terrain, 3D view and thumbnails.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

FEATURE_COLORS = {
    "reboot_van": "#2f7bff", "vault": "#f5c518", "boss": "#e5383b", "medallion": "#9b5de5", "vending_machine": "#00bbf9",
    "launch_pad": "#ff8c00", "supply_drop": "#4361ee", "campfire": "#f3722c", "spawn_pad": "#4cc9f0", "team_spawn": "#4cc9f0",
    "capture_zone": "#ffd60a", "flag": "#ff006e", "bomb_site": "#d00000", "checkpoint": "#06d6a0", "finish_line": "#ffffff",
    "race_checkpoint": "#06d6a0", "tycoon_plot": "#8ac926", "upgrade_button": "#ffbe0b", "creature_spawner": "#7b2cbf",
    "trap": "#ef233c", "collectible": "#ffd166", "teleporter": "#b5179e",
}
BIOME_COLORS = {
    "grassland": (111, 191, 74), "forest": (56, 135, 58), "desert": (227, 194, 122), "snow": (236, 242, 247),
    "swamp": (96, 112, 60), "jungle": (42, 154, 82), "volcanic": (78, 62, 60), "beach": (240, 220, 154),
    "mountain": (141, 138, 131), "urban": (154, 163, 173), "autumn": (214, 137, 58), "candy": (245, 154, 200),
}
TEAM_COLORS = ["#ffffff", "#ef233c", "#3a86ff", "#38b000", "#ffd60a"]


def render_minimap(spec: dict[str, Any], path: str | Path, size: int = 1024) -> Path:
    try:
        from PIL import Image, ImageDraw
    except ImportError as e:  # pragma: no cover - optional dependency
        raise RuntimeError("Install Pillow: pip install 'island-forge[render]'") from e

    s = size
    img = Image.new("RGB", (s, s), (22, 78, 150))
    draw = ImageDraw.Draw(img)
    island_layout = spec["mode"] in {"battle_royale", "reload", "blitz", "zero_build_br", "zone_wars", "survival"}
    base = BIOME_COLORS.get(spec.get("base_biome", "grassland"), BIOME_COLORS["grassland"])
    if island_layout:
        draw.ellipse([s * 0.06, s * 0.06, s * 0.94, s * 0.94], fill=(238, 216, 150))
        draw.ellipse([s * 0.09, s * 0.09, s * 0.91, s * 0.91], fill=base)
    else:
        draw.rectangle([s * 0.04, s * 0.04, s * 0.96, s * 0.96], fill=base)
    for b in spec.get("biomes", []):
        r = b["radius"] * s * 0.8
        draw.ellipse([b["x"] * s - r, b["y"] * s - r, b["x"] * s + r, b["y"] * s + r], fill=BIOME_COLORS.get(b["type"], base))
    for lake in spec.get("lakes", []):
        r = lake["radius"] * s
        draw.ellipse([lake["x"] * s - r, lake["y"] * s - r, lake["x"] * s + r, lake["y"] * s + r], fill=(58, 164, 214))
    for river in spec.get("rivers", []):
        draw.line([(p["x"] * s, p["y"] * s) for p in river["points"]], fill=(58, 164, 214), width=max(2, s // 110))
    for road in spec.get("roads", []):
        draw.line([(p["x"] * s, p["y"] * s) for p in road["points"]], fill=(245, 235, 210), width=max(2, s // 300))
    for p in spec["pois"]:
        r = {"small": 18, "medium": 26, "large": 36}.get(p.get("size", "medium"), 26) * s / 1000
        draw.ellipse([p["x"] * s - r, p["y"] * s - r, p["x"] * s + r, p["y"] * s + r], outline="white", width=2)
    for f in spec["features"]:
        r = 10 * s / 1000
        outline = TEAM_COLORS[f["team"]] if 0 < f.get("team", 0) < len(TEAM_COLORS) else "white"
        draw.ellipse([f["x"] * s - r, f["y"] * s - r, f["x"] * s + r, f["y"] * s + r], fill=FEATURE_COLORS.get(f["type"], "#cccccc"), outline=outline, width=2)
    phases = spec["storm"].get("phases", [])
    if phases:
        r = phases[0]["end_radius_pct"] * s
        cx = 0.5 + (spec["storm"]["final_x"] - 0.5) / len(phases)
        cy = 0.5 + (spec["storm"]["final_y"] - 0.5) / len(phases)
        draw.ellipse([cx * s - r, cy * s - r, cx * s + r, cy * s + r], outline=(220, 200, 255), width=3)
    for k in range(1, 10):
        draw.line([(k * s / 10, 0), (k * s / 10, s)], fill=(120, 150, 190), width=1)
        draw.line([(0, k * s / 10), (s, k * s / 10)], fill=(120, 150, 190), width=1)
    for p in spec["pois"]:
        label = p["name"].upper()
        x, y = p["x"] * s, p["y"] * s - 40 * s / 1000
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            draw.text((x + dx, y + dy), label, fill="black", anchor="mm")
        draw.text((x, y), label, fill="white", anchor="mm")
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)
    return out


def distance(a: dict[str, float], b: dict[str, float]) -> float:
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])
