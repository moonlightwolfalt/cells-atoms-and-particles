"""HTTP client for the Island Forge server (standard library only)."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any


class IslandForgeError(RuntimeError):
    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


class IslandForgeClient:
    """Talks to a running Island Forge server (`npm start`, default http://localhost:5173)."""

    def __init__(self, base_url: str = "http://localhost:5173", timeout: float = 600.0):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _request(self, method: str, path: str, body: Any = None) -> tuple[bytes, str]:
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base_url + path, data=data, method=method, headers={"content-type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as res:
                return res.read(), res.headers.get("content-type", "")
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                message = json.loads(raw).get("error", raw.decode(errors="replace"))
            except (ValueError, AttributeError):
                message = raw.decode(errors="replace")
            raise IslandForgeError(message, e.code) from None
        except urllib.error.URLError as e:
            raise IslandForgeError(f"Could not reach the Island Forge server at {self.base_url} ({e.reason}). Start it with `npm start`.") from None

    def _json(self, method: str, path: str, body: Any = None) -> Any:
        raw, _ = self._request(method, path, body)
        return json.loads(raw)

    def providers(self) -> dict[str, Any]:
        return self._json("GET", "/api/providers")

    def catalog(self) -> dict[str, Any]:
        return self._json("GET", "/api/catalog")

    def generate(self, prompt: str, mode: str = "reload", provider: str = "anthropic", model: str | None = None, api_key: str | None = None, base_url: str | None = None) -> dict[str, Any]:
        body = {"prompt": prompt, "mode": mode, "provider": provider}
        if model:
            body["model"] = model
        if api_key:
            body["apiKey"] = api_key
        if base_url:
            body["baseUrl"] = base_url
        return self._json("POST", "/api/generate", body)["spec"]

    def verse(self, spec: dict[str, Any]) -> list[dict[str, Any]]:
        return self._json("POST", "/api/verse", {"spec": spec})["files"]

    def readme(self, spec: dict[str, Any]) -> str:
        raw, _ = self._request("POST", "/api/readme", {"spec": spec})
        return raw.decode()

    def package(self, spec: dict[str, Any]) -> bytes:
        raw, _ = self._request("POST", "/api/package", {"spec": spec})
        return raw
