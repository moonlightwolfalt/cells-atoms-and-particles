"""Generate a layout with Claude directly (no server), using the shared JSON schema.

The answer is the raw AI layout; send it through the server (`/api/verse`, `/api/package`) or
open it in the web app to get devices and Verse. Requires `pip install island-forge[claude]`.
"""

from __future__ import annotations

import json
from typing import Any

from .catalog import MAP_SCHEMA, mode_info

DEFAULT_MODEL = "claude-opus-5-5"
FALLBACK_MODELS = {"claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"}

SYSTEM = (
    "You are a level designer for Fortnite Creative / UEFN islands of every genre. "
    "Turn a short idea into a complete top-down layout. Coordinates are 0..1 across the square map, "
    "(0,0) is the north-west corner. Use original names only. Courses: put checkpoints along the road in order. "
    "Team features use team 1, 2, ...; otherwise 0. Storm phases shrink to 0, or are empty for modes without a storm. "
    "Reply with JSON matching the schema."
)


def build_prompt(idea: str, mode_id: str) -> str:
    mode = mode_info(mode_id)
    return "\n".join(
        [
            f"Game mode: {mode['label']} ({mode['category']}) - {mode['blurb']}",
            f"Layout style: {mode['layout']}. Map size about {mode['mapSizeM']} m. Locations: {mode['poiMin']}-{mode['poiMax']}.",
            f"Suggested features: {json.dumps(mode['features'])}",
            f"Default rules: {json.dumps(mode['rules'])}",
            f"Default storm: {json.dumps(mode['storm'])}" if mode["storm"] else "This mode has no storm.",
            "",
            f'Island idea: """{idea or "Surprise me with a fun, original island."}"""',
        ]
    )


def generate_with_claude(idea: str, mode_id: str = "reload", model: str = DEFAULT_MODEL, api_key: str | None = None) -> dict[str, Any]:
    try:
        import anthropic
    except ImportError as e:  # pragma: no cover - depends on optional install
        raise RuntimeError("Install the Claude extra: pip install 'island-forge[claude]'") from e

    client = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()
    params: dict[str, Any] = {
        "model": model,
        "max_tokens": 32000,
        "system": SYSTEM,
        "messages": [{"role": "user", "content": build_prompt(idea, mode_id)}],
        "output_config": {"format": {"type": "json_schema", "schema": MAP_SCHEMA_FOR_API}, "effort": "medium"},
    }
    try:
        if model in FALLBACK_MODELS:
            with client.beta.messages.stream(**params, betas=["server-side-fallback-2026-07-01"], fallbacks="default") as stream:
                message = stream.get_final_message()
        else:
            with client.messages.stream(**params) as stream:
                message = stream.get_final_message()
    except anthropic.AuthenticationError:
        raise RuntimeError("Anthropic rejected the API key.") from None
    except anthropic.RateLimitError:
        raise RuntimeError("Anthropic rate limit hit - wait a moment and try again.") from None
    except anthropic.NotFoundError:
        raise RuntimeError(f"Model {model!r} was not found for this API key.") from None
    except anthropic.APIStatusError as e:
        raise RuntimeError(f"Anthropic API error ({e.status_code}): {e.message}") from None
    except anthropic.APIConnectionError:
        raise RuntimeError("Could not reach Anthropic.") from None

    if message.stop_reason == "refusal":
        raise RuntimeError("Claude declined this prompt. Try rewording your island idea.")
    if message.stop_reason == "max_tokens":
        raise RuntimeError("The answer was cut off. Try a shorter idea.")
    text = "".join(block.text for block in message.content if block.type == "text")
    layout = json.loads(text)
    layout["mode"] = mode_id
    layout["prompt"] = idea
    layout["generator"] = f"anthropic/{model} (python)"
    return layout


# The API takes the schema without the $schema/title wrapper keys.
MAP_SCHEMA_FOR_API = {k: v for k, v in MAP_SCHEMA.items() if k not in ("$schema", "title")}
