import { MODES, MODE_IDS, normalizeSpec } from './lib/modes.js';
import { generateProcedural } from './lib/procedural.js';
import { drawMinimap, renderMinimapCanvas, renderThumbnailCanvas, FEATURE_STYLE } from './lib/render.js';
import { generateVerse, generateReadme, verseIdent, gridRef } from './lib/uefn.js';
import { createZip, readZip } from './lib/zip.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const EXAMPLES = [
  'Frozen volcano island with a neon city in the middle and pirate docks on the coast',
  'Cozy autumn farmland with a haunted swamp in the south and a big castle on a hill',
  'Desert canyon with an abandoned spy base, oil refinery and a hidden jungle temple',
  'Candy-themed party island with a giant cake mountain and a sweets factory',
];

const OFFLINE_PROVIDERS = [{ id: 'offline', label: 'Offline generator (no AI, instant)', defaultModel: 'procedural', models: [], needsKey: false }];

const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(`island-forge:${k}`);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(`island-forge:${k}`, JSON.stringify(v));
    } catch {
      /* storage unavailable */
    }
  },
  del(k) {
    try {
      localStorage.removeItem(`island-forge:${k}`);
    } catch {
      /* storage unavailable */
    }
  },
};

const state = {
  mode: store.get('mode', 'reload'),
  spec: null,
  providers: OFFLINE_PROVIDERS,
  envKeys: {},
  serverAvailable: false,
  layers: { grid: true, labels: true, features: true, storm: true, bus: true },
};
if (!MODES[state.mode]) state.mode = 'reload';

function setStatus(msg, kind = '') {
  const el = $('#status');
  el.textContent = msg;
  el.className = `status ${kind}`;
}

// ---------- Controls ----------

function renderModes() {
  const wrap = $('#modes');
  wrap.innerHTML = '';
  for (const id of MODE_IDS) {
    const b = document.createElement('button');
    b.className = 'mode';
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.textContent = MODES[id].label;
    b.setAttribute('aria-checked', String(id === state.mode));
    b.addEventListener('click', () => {
      state.mode = id;
      store.set('mode', id);
      renderModes();
    });
    wrap.appendChild(b);
  }
  $('#mode-blurb').textContent = MODES[state.mode].blurb;
}

function renderExamples() {
  const wrap = $('#examples');
  for (const ex of EXAMPLES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = ex.length > 42 ? `${ex.slice(0, 40)}…` : ex;
    b.title = ex;
    b.addEventListener('click', () => {
      $('#prompt').value = ex;
      $('#prompt').focus();
    });
    wrap.appendChild(b);
  }
}

function currentProvider() {
  return state.providers.find((p) => p.id === $('#provider').value) || state.providers[0];
}

function syncProviderFields() {
  const p = currentProvider();
  const saved = store.get(`model:${p.id}`, '');
  $('#model').value = saved || p.defaultModel;
  $('#model').disabled = p.id === 'offline';
  $('#model-list').innerHTML = p.models.map((m) => `<option value="${m}"></option>`).join('');
  $('#baseurl-row').hidden = !p.baseUrl;
  $('#baseurl').value = store.get(`baseurl:${p.id}`, '') || p.baseUrl || '';
  $('#key-row').hidden = !p.needsKey && p.id !== 'openai';
  $('#apikey').placeholder = p.keyHint || '';
  const remembered = store.get(`key:${p.id}`, '');
  $('#apikey').value = remembered;
  $('#remember').checked = Boolean(remembered);
  $('#env-note').textContent = state.envKeys[p.id]?.envKey ? '— set on the server, optional here' : '';
  store.set('provider', p.id);
}

async function loadProviders() {
  try {
    const res = await fetch('/api/providers');
    if (!res.ok) throw new Error();
    const data = await res.json();
    state.providers = data.providers;
    state.envKeys = data.status || {};
    state.serverAvailable = true;
  } catch {
    state.serverAvailable = false;
  }
  const sel = $('#provider');
  sel.innerHTML = state.providers.map((p) => `<option value="${p.id}">${p.label}</option>`).join('');
  const saved = store.get('provider', state.providers[0].id);
  sel.value = state.providers.some((p) => p.id === saved) ? saved : state.providers[0].id;
  syncProviderFields();
  if (!state.serverAvailable) setStatus('Server not running — only the offline generator is available. Run "npm start" to use AI models.');
}

// ---------- Generation ----------

function setBusy(busy) {
  $('#generate').disabled = busy;
  $('#reroll').disabled = busy;
  $('.spinner').hidden = !busy;
}

async function generate() {
  const p = currentProvider();
  const prompt = $('#prompt').value.trim();
  const model = $('#model').value.trim();
  const apiKey = $('#apikey').value.trim();
  const baseUrl = $('#baseurl').value.trim();
  store.set(`model:${p.id}`, model);
  if (p.baseUrl) store.set(`baseurl:${p.id}`, baseUrl);
  if ($('#remember').checked && apiKey) store.set(`key:${p.id}`, apiKey);
  else store.del(`key:${p.id}`);

  if (p.id === 'offline' || !state.serverAvailable) {
    setSpec(generateProcedural(prompt, state.mode));
    setStatus('Generated offline. Pick an AI provider for richer, prompt-aware layouts.', 'success');
    return;
  }

  setBusy(true);
  const started = performance.now();
  setStatus(`Asking ${p.label.replace(/ —.*/, '')} (${model}) to design your ${MODES[state.mode].label} island…`);
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: p.id, model, apiKey, baseUrl, prompt, mode: state.mode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    setSpec(data.spec);
    setStatus(`Done in ${((performance.now() - started) / 1000).toFixed(1)}s — ${data.spec.pois.length} locations.`, 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    setBusy(false);
  }
}

function reroll() {
  const seed = (Math.random() * 2 ** 32) >>> 0;
  setSpec(generateProcedural($('#prompt').value.trim(), state.mode, seed));
  setStatus('New offline layout.', 'success');
}

// ---------- Rendering ----------

function setSpec(spec) {
  state.spec = normalizeSpec(spec, spec?.mode || state.mode);
  store.set('lastSpec', state.spec);
  if (state.spec.mode !== state.mode) {
    state.mode = state.spec.mode;
    renderModes();
  }
  renderAll();
}

function renderMap() {
  const c = $('#map-canvas');
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  if (state.spec) drawMinimap(ctx, state.spec, c.width, state.layers);
}

function renderThumb() {
  const c = $('#thumb-canvas');
  const ctx = c.getContext('2d');
  if (!state.spec) return;
  ctx.drawImage(renderThumbnailCanvas(state.spec), 0, 0);
}

function renderLegend() {
  const used = new Set(state.spec?.features.map((f) => f.type) || []);
  $('#legend').innerHTML = [...used]
    .map((t) => `<span><i style="background:${FEATURE_STYLE[t].color}">${FEATURE_STYLE[t].glyph}</i>${FEATURE_STYLE[t].label}</span>`)
    .join('');
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function renderDetails() {
  const s = state.spec;
  if (!s) return;
  const r = s.rules;
  $('#details').innerHTML = `
    <label class="sublabel" for="ed-name">Island name</label>
    <input id="ed-name" value="${esc(s.name)}" maxlength="48" />
    <label class="sublabel" for="ed-tag">Tagline</label>
    <input id="ed-tag" value="${esc(s.tagline)}" maxlength="120" />
    <p class="hint">${esc(s.description)}</p>
    <p class="hint">Mode <b>${MODES[s.mode].label}</b> · theme ${esc(s.theme)} · ${s.map_size_m} m island · made with ${esc(s.generator)}</p>

    <h3>Rules</h3>
    <div class="rules">
      <label>Max players<input class="inline" type="number" min="2" max="100" data-rule="max_players" value="${r.max_players}" /></label>
      <label>Team size<input class="inline" type="number" min="1" max="4" data-rule="team_size" value="${r.team_size}" /></label>
      <label>Respawn delay (s)<input class="inline" type="number" min="0" max="120" data-rule="respawn_delay_s" value="${r.respawn_delay_s}" /></label>
      <label>Respawns stop at phase<input class="inline" type="number" min="0" max="20" data-rule="respawn_cutoff_phase" value="${r.respawn_cutoff_phase}" /></label>
      <label>Starting mats<input class="inline" type="number" min="0" max="999" data-rule="starting_materials" value="${r.starting_materials}" /></label>
      <label class="check"><input type="checkbox" data-rule="respawn_enabled" ${r.respawn_enabled ? 'checked' : ''} /> Respawns on</label>
    </div>

    <h3>Locations (${s.pois.length})</h3>
    <div class="table-scroll"><table>
      <tr><th>Name</th><th>Kind</th><th>Size</th><th>Loot</th><th>Grid</th></tr>
      ${s.pois
        .map(
          (p, i) => `<tr><td><input class="inline" data-poi="${i}" value="${esc(p.name)}" maxlength="40" /></td><td>${p.kind}</td><td>${p.size}</td><td>${'★'.repeat(p.loot_tier)}</td><td>${gridRef(p.x, p.y)}</td></tr>`,
        )
        .join('')}
    </table></div>

    <h3>Storm (${s.storm.phases.length} phases)</h3>
    <div class="table-scroll"><table>
      <tr><th>#</th><th>Wait</th><th>Shrink</th><th>End radius</th><th>Damage</th></tr>
      ${s.storm.phases
        .map((p, i) => `<tr><td>${i + 1}</td><td>${p.wait_s}s</td><td>${p.shrink_s}s</td><td>${Math.round(p.end_radius_pct * s.map_size_m)} m</td><td>${p.damage_per_tick}</td></tr>`)
        .join('')}
    </table></div>
    <h3>Loot</h3><p class="hint">${esc(r.loot_pool_notes)}</p>`;

  let t;
  const later = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      store.set('lastSpec', state.spec);
      renderMap();
      renderThumb();
      renderUefn();
    }, 250);
  };
  $('#ed-name').addEventListener('input', (e) => {
    state.spec.name = e.target.value || 'Untitled Island';
    later();
  });
  $('#ed-tag').addEventListener('input', (e) => {
    state.spec.tagline = e.target.value;
    later();
  });
  $$('[data-poi]').forEach((inp) =>
    inp.addEventListener('input', (e) => {
      state.spec.pois[+e.target.dataset.poi].name = e.target.value || 'Unnamed';
      later();
    }),
  );
  $$('[data-rule]').forEach((inp) =>
    inp.addEventListener('change', (e) => {
      const k = e.target.dataset.rule;
      state.spec.rules[k] = e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value);
      state.spec = normalizeSpec(state.spec, state.spec.mode);
      renderDetails();
      later();
    }),
  );
}

function renderUefn() {
  $('#verse-preview').textContent = state.spec ? generateVerse(state.spec) : '';
}

function renderAll() {
  renderMap();
  renderThumb();
  renderLegend();
  renderDetails();
  renderUefn();
}

// ---------- Export / import ----------

const slug = () => verseIdent(state.spec?.name || 'island').replace(/_/g, '-');

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function canvasBlob(canvas, type, quality) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function thumbnailJpeg() {
  const c = renderThumbnailCanvas(state.spec);
  for (const q of [0.92, 0.85, 0.75, 0.65, 0.5]) {
    const b = await canvasBlob(c, 'image/jpeg', q);
    if (b.size < 1_000_000) return b;
  }
  return canvasBlob(c, 'image/jpeg', 0.4);
}

const minimapPng = () => canvasBlob(renderMinimapCanvas(state.spec, 1024), 'image/png');
const specJson = () => JSON.stringify(state.spec, null, 2);

async function exportWhat(kind) {
  if (!state.spec) return setStatus('Generate an island first.', 'error');
  const base = slug();
  const id = verseIdent(state.spec.name);
  if (kind === 'json') return download(`${base}.island.json`, new Blob([specJson()], { type: 'application/json' }));
  if (kind === 'thumb') return download(`${base}-thumbnail.jpg`, await thumbnailJpeg());
  if (kind === 'minimap') return download(`${base}-minimap.png`, await minimapPng());
  if (kind === 'verse') return download(`${id}_layout.verse`, new Blob([generateVerse(state.spec)], { type: 'text/plain' }));
  if (kind === 'readme') return download(`${base}-UEFN-setup.md`, new Blob([generateReadme(state.spec)], { type: 'text/markdown' }));
  if (kind === 'zip') {
    setStatus('Building UEFN package…');
    const [thumb, mini] = await Promise.all([thumbnailJpeg(), minimapPng()]);
    const folder = `${base}-uefn`;
    const zip = createZip([
      { name: `${folder}/README.md`, data: generateReadme(state.spec) },
      { name: `${folder}/thumbnail.jpg`, data: new Uint8Array(await thumb.arrayBuffer()) },
      { name: `${folder}/minimap.png`, data: new Uint8Array(await mini.arrayBuffer()) },
      { name: `${folder}/Verse/${id}_layout.verse`, data: generateVerse(state.spec) },
      { name: `${folder}/map-spec.json`, data: specJson() },
    ]);
    download(`${folder}.zip`, new Blob([zip], { type: 'application/zip' }));
    setStatus('UEFN package downloaded. Open README.md inside it for the import steps.', 'success');
  }
}

async function importFile(file) {
  try {
    let json;
    if (/\.zip$/i.test(file.name) || file.type.includes('zip')) {
      const entries = await readZip(await file.arrayBuffer());
      const entry = entries.find((e) => /map-spec\.json$/i.test(e.name)) || entries.find((e) => /\.json$/i.test(e.name));
      if (!entry) throw new Error('No map-spec.json found in that zip.');
      json = JSON.parse(new TextDecoder().decode(entry.data));
    } else {
      json = JSON.parse(await file.text());
    }
    if (!json || typeof json !== 'object' || !Array.isArray(json.pois)) throw new Error('That file is not an Island Forge map.');
    setSpec(json);
    setStatus(`Imported "${state.spec.name}".`, 'success');
  } catch (err) {
    setStatus(`Import failed: ${err.message}`, 'error');
  }
}

// ---------- Wiring ----------

function wire() {
  $('#generate').addEventListener('click', generate);
  $('#reroll').addEventListener('click', reroll);
  $('#provider').addEventListener('change', syncProviderFields);
  $('#prompt').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate();
  });
  $('#prompt').addEventListener('input', (e) => store.set('prompt', e.target.value));
  $$('.tab').forEach((t) =>
    t.addEventListener('click', () => {
      $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
      $$('.tabpane').forEach((p) => p.classList.toggle('active', p.dataset.pane === t.dataset.tab));
    }),
  );
  $$('[data-layer]').forEach((cb) =>
    cb.addEventListener('change', () => {
      state.layers[cb.dataset.layer] = cb.checked;
      renderMap();
    }),
  );
  $$('[data-export]').forEach((b) => b.addEventListener('click', () => exportWhat(b.dataset.export).catch((e) => setStatus(e.message, 'error'))));
  $('#import-file').addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) importFile(f);
    e.target.value = '';
  });
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) importFile(f);
  });
}

async function init() {
  renderModes();
  renderExamples();
  wire();
  $('#prompt').value = store.get('prompt', '') || EXAMPLES[0];
  await loadProviders();
  const last = store.get('lastSpec', null);
  setSpec(last && Array.isArray(last.pois) ? last : generateProcedural($('#prompt').value, state.mode));
}

init();
