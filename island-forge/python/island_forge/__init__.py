"""Island Forge for Python: generate Fortnite / UEFN island layouts and work with map specs."""

from .catalog import DEVICES, FEATURE_TYPES, MAP_SCHEMA, MODES, mode_info
from .client import IslandForgeClient, IslandForgeError
from .spec import load_spec, markers, save_spec, summarize, to_world, validate_spec

__version__ = "2.0.0"
__all__ = [
    "DEVICES",
    "FEATURE_TYPES",
    "MAP_SCHEMA",
    "MODES",
    "IslandForgeClient",
    "IslandForgeError",
    "load_spec",
    "markers",
    "mode_info",
    "save_spec",
    "summarize",
    "to_world",
    "validate_spec",
]
