import json
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import pytest

from island_forge import DEVICES, MODES, IslandForgeClient, IslandForgeError, load_spec, markers, summarize, to_world, validate_spec
from island_forge.claude import MAP_SCHEMA_FOR_API, build_prompt
from island_forge.cli import main

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(params=["reload", "tycoon", "capture_the_flag"])
def spec(request):
    return load_spec(FIXTURES / f"{request.param}.json")


def test_catalogs_loaded():
    assert len(MODES) >= 30
    assert len(DEVICES) >= 75
    assert MODES["reload"]["rules"]["respawn_enabled"] is True
    assert "properties" in MAP_SCHEMA_FOR_API and "$schema" not in MAP_SCHEMA_FOR_API


def test_fixtures_validate(spec):
    assert validate_spec(spec) == []


def test_validate_catches_problems(spec):
    bad = json.loads(json.dumps(spec))
    bad["pois"][0]["x"] = 3
    bad["features"].append({"type": "spaceship", "x": 0.5, "y": 0.5})
    bad["mode"] = "nope"
    problems = validate_spec(bad)
    assert any("unknown mode" in p for p in problems)
    assert any("x must be between 0 and 1" in p for p in problems)
    assert any("unknown type 'spaceship'" in p for p in problems)
    assert validate_spec([]) == ["spec must be a JSON object"]
    assert "missing 'pois'" in validate_spec({k: v for k, v in spec.items() if k != "pois"})


def test_world_coordinates(spec):
    assert to_world(spec, 0.5, 0.5) == (0, 0, 0)
    half = spec["map_size_m"] * 50
    assert to_world(spec, 1, 0) == (half, half, 0)


def test_summary_and_markers(spec):
    s = summarize(spec)
    assert s["name"] == spec["name"]
    assert s["locations"] == [p["name"] for p in spec["pois"]]
    assert s["verse_modules"] == MODES[spec["mode"]]["verse"]
    assert len(markers(spec)) == len(spec["pois"]) + len(spec["features"])


def test_prompt_mentions_mode():
    text = build_prompt("pizza tycoon", "tycoon")
    assert "Tycoon" in text and "pizza tycoon" in text


def test_render_minimap(tmp_path, spec):
    pytest.importorskip("PIL")
    from PIL import Image

    from island_forge.render import render_minimap

    out = render_minimap(spec, tmp_path / "map.png", size=256)
    with Image.open(out) as img:
        assert img.size == (256, 256)


def test_cli_offline_commands(tmp_path, capsys):
    path = FIXTURES / "reload.json"
    assert main(["validate", str(path)]) == 0
    assert "OK" in capsys.readouterr().out
    assert main(["info", str(path)]) == 0
    assert json.loads(capsys.readouterr().out)["mode"] == "Reload"
    csv_out = tmp_path / "m.csv"
    assert main(["markers", str(path), "-o", str(csv_out)]) == 0
    assert csv_out.read_text().startswith("label,category,grid,X,Y,Z")
    assert main(["modes"]) == 0
    assert "Tycoon & Sim" in capsys.readouterr().out
    assert main(["generate", "x", "--mode", "nope"]) == 2


class _FakeApi(BaseHTTPRequestHandler):
    spec = None

    def log_message(self, *args):
        pass

    def _send(self, status, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(status)
        self.send_header("content-type", ctype)
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self._send(200, {"providers": [{"id": "offline"}], "status": {}})

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["content-length"])) or b"{}")
        if self.path == "/api/generate":
            if body.get("provider") == "anthropic" and not body.get("apiKey"):
                return self._send(400, {"error": "Add your Anthropic API key"})
            return self._send(200, {"spec": {**self.spec, "mode": body["mode"]}})
        if self.path == "/api/verse":
            return self._send(200, {"files": [{"path": "a.verse", "code": "# hi", "title": "A"}]})
        if self.path == "/api/package":
            return self._send(200, b"PK\x05\x06" + b"\0" * 18, "application/zip")
        self._send(404, {"error": "nope"})


@pytest.fixture
def fake_server():
    _FakeApi.spec = load_spec(FIXTURES / "reload.json")
    srv = HTTPServer(("127.0.0.1", 0), _FakeApi)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    yield f"http://127.0.0.1:{srv.server_address[1]}"
    srv.shutdown()


def test_client_against_fake_server(fake_server, tmp_path):
    client = IslandForgeClient(fake_server)
    assert client.providers()["providers"][0]["id"] == "offline"
    spec = client.generate("ice", "blitz", provider="offline")
    assert spec["mode"] == "blitz"
    with pytest.raises(IslandForgeError, match="API key") as err:
        client.generate("ice", "blitz", provider="anthropic")
    assert err.value.status == 400
    assert main(["--server", fake_server, "generate", "ice", "--provider", "offline", "-o", str(tmp_path / "i.json")]) == 0
    assert main(["--server", fake_server, "package", str(tmp_path / "i.json"), "-o", str(tmp_path / "p.zip")]) == 0
    assert (tmp_path / "p.zip").read_bytes().startswith(b"PK")
    assert main(["--server", fake_server, "verse", str(tmp_path / "i.json"), "--out-dir", str(tmp_path / "v")]) == 0
    assert (tmp_path / "v" / "a.verse").read_text() == "# hi"


def test_client_reports_unreachable_server():
    with pytest.raises(IslandForgeError, match="Could not reach"):
        IslandForgeClient("http://127.0.0.1:9", timeout=2).providers()


@pytest.mark.skipif(not os.environ.get("ISLAND_FORGE_SERVER"), reason="set ISLAND_FORGE_SERVER to run against a real server")
def test_real_server_round_trip(tmp_path):
    client = IslandForgeClient(os.environ["ISLAND_FORGE_SERVER"])
    spec = client.generate("haunted castle", "prop_hunt", provider="offline")
    assert validate_spec(spec) == []
    assert [f["path"].endswith(".verse") for f in client.verse(spec)]
    assert client.package(spec)[:2] == b"PK"


def test_catalog_and_builds(spec):
    from island_forge import CATALOG, search_catalog

    assert len(CATALOG["prefabs"]) >= 100 and len(CATALOG["galleries"]) >= 90
    assert any(e["id"] == "br_pleasant_park" for e in search_catalog("prefabs", "suburban"))
    with pytest.raises(KeyError):
        search_catalog("hats")
    s = summarize(spec)
    assert set(s["builds"]) == {p["name"] for p in spec["pois"]}
    assert s["loot"]["chests"] or s["loot"]["pool"] or spec["mode"] == "capture_the_flag"
    bad = json.loads(json.dumps(spec))
    bad["pois"][0]["prefab"] = "nope"
    bad["loot"]["pool"].append("it_laser_sword")
    bad["loot"]["chests"].append("custom_my_new_chest")
    problems = validate_spec(bad)
    assert "pois[0]: unknown prefab 'nope'" in problems
    assert "loot.pool: unknown id 'it_laser_sword'" in problems
    assert not any("custom_my_new_chest" in p for p in problems)


def test_cli_catalog(capsys):
    assert main(["catalog"]) == 0
    assert "prefabs" in capsys.readouterr().out
    assert main(["catalog", "chests", "--search", "llama"]) == 0
    assert "supply_llama" in capsys.readouterr().out
