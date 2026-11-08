import { useCallback, useEffect, useRef, useState } from 'react';
import { MODES, MODE_LIST, DEVICES, VERSE_MODULES, generateProcedural, generateVerseFiles, readZip, type MapSpec } from '../../core/src/index.ts';
import { loadProviders, generate, OFFLINE, type ProviderInfo } from './api.ts';
import { store } from './storage.ts';
import { useIsland, replan } from './useIsland.ts';
import { GeneratorPanel, type AiSettings } from './components/GeneratorPanel.tsx';
import { MapEditor } from './components/MapEditor.tsx';
import { View3D } from './components/View3D.tsx';
import { ThumbnailView, heroFrom } from './components/ThumbnailView.tsx';
import { DevicesPanel } from './components/DevicesPanel.tsx';
import { VersePanel } from './components/VersePanel.tsx';
import { DetailsPanel } from './components/DetailsPanel.tsx';
import { PublishPanel } from './components/PublishPanel.tsx';
import { ExportPanel } from './components/ExportPanel.tsx';
import type { IslandScene } from './render/scene3d.ts';

const TABS = [
  ['map', 'Map editor'],
  ['3d', '3D view'],
  ['image', 'Island image'],
  ['devices', 'Devices'],
  ['verse', 'Verse'],
  ['details', 'Details & rules'],
  ['publish', 'Publish'],
  ['export', 'Export'],
] as const;
type Tab = (typeof TABS)[number][0];

export default function App() {
  const island = useIsland();
  const { spec } = island;
  const [mode, setModeState] = useState(() => (MODES[store.get('mode', 'reload')] ? store.get('mode', 'reload') : 'reload'));
  const [prompt, setPromptState] = useState(() => store.get('prompt', 'Frozen volcano island with a neon city in the middle and pirate docks on the coast'));
  const [providers, setProviders] = useState<ProviderInfo[]>([OFFLINE]);
  const [envKeys, setEnvKeys] = useState<Record<string, { envKey: boolean }>>({});
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatusState] = useState<{ text: string; kind: '' | 'error' | 'success' }>({ text: '', kind: '' });
  const [tab, setTab] = useState<Tab>(() => store.get('tab', 'map') as Tab);
  const [visited3d, setVisited3d] = useState(tab === '3d');
  const [useHero, setUseHero] = useState(false);
  const sceneRef = useRef<IslandScene | null>(null);
  const [, force] = useState(0);

  const setStatus = useCallback((text: string, kind: '' | 'error' | 'success' = '') => setStatusState({ text, kind }), []);
  const setMode = (m: string) => {
    setModeState(m);
    store.set('mode', m);
  };
  const setPrompt = (p: string) => {
    setPromptState(p);
    store.set('prompt', p);
  };

  useEffect(() => {
    loadProviders().then((r) => {
      setProviders(r.providers);
      setEnvKeys(r.envKeys);
      setOnline(r.online);
    });
    if (!island.spec) island.replace(generateProcedural(prompt, mode));
  }, []);

  useEffect(() => {
    store.set('tab', tab);
    if (tab === '3d') setVisited3d(true);
  }, [tab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) island.redo();
        else island.undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        island.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [island.undo, island.redo]);

  const onGenerate = async (ai: AiSettings) => {
    setBusy(true);
    const started = performance.now();
    const label = providers.find((p) => p.id === ai.provider)?.label.replace(/ —.*/, '') || ai.provider;
    if (ai.provider !== 'offline' && online) setStatus(`Asking ${label} (${ai.model}) to design your ${MODES[mode].label} island…`);
    try {
      const next = await generate({ ...ai, prompt, mode }, online);
      island.replace(next);
      const secs = ((performance.now() - started) / 1000).toFixed(1);
      setStatus(
        ai.provider === 'offline' || !online
          ? 'Generated offline. Pick an AI provider for richer, prompt-aware layouts.'
          : `Done in ${secs}s — ${next.pois.length} locations, ${next.features.length} features, ${next.devices.length} devices.`,
        'success',
      );
    } catch (e: any) {
      setStatus(e?.message || 'Generation failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const onReroll = () => {
    island.replace(generateProcedural(prompt, mode, (Math.random() * 2 ** 32) >>> 0));
    setStatus('New offline layout.', 'success');
  };

  const importFile = async (file: File) => {
    try {
      let json: any;
      if (/\.zip$/i.test(file.name) || file.type.includes('zip')) {
        const entries = await readZip(await file.arrayBuffer());
        const entry = entries.find((e) => /map-spec\.json$/i.test(e.name)) || entries.find((e) => /\.json$/i.test(e.name));
        if (!entry) throw new Error('No map-spec.json found in that zip.');
        json = JSON.parse(new TextDecoder().decode(entry.data));
      } else json = JSON.parse(await file.text());
      if (!json || typeof json !== 'object' || !Array.isArray(json.pois)) throw new Error('That file is not an Island Forge map.');
      island.replace(json);
      if (MODES[json.mode]) setMode(json.mode);
      setStatus(`Imported "${json.name || 'island'}".`, 'success');
    } catch (e: any) {
      setStatus(`Import failed: ${e.message}`, 'error');
    }
  };

  useEffect(() => {
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f) importFile(f);
    };
    document.addEventListener('dragover', over);
    document.addEventListener('drop', drop);
    return () => {
      document.removeEventListener('dragover', over);
      document.removeEventListener('drop', drop);
    };
  }, []);

  const commit = (s: MapSpec, o?: { replanDevices?: boolean; mergeWithLast?: boolean }) => island.commit(s, o);
  const hero = () => (useHero ? heroFrom(sceneRef.current) : undefined);
  const mode3 = spec ? MODES[spec.mode] : null;

  return (
    <div className="mx-auto max-w-[1700px]">
      <header className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span aria-hidden className="h-11 w-11 rounded-xl bg-gradient-to-br from-sky to-violet-600 shadow-[inset_0_-10px_0_#3fbf5a]" />
          <div>
            <h1 className="font-display text-2xl uppercase leading-none">Island Forge</h1>
            <p className="text-xs text-mute">
              {MODE_LIST.length} island types · {DEVICES.length} UEFN devices · {Object.keys(VERSE_MODULES).length} Verse modules
            </p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button className="btn" disabled={!island.canUndo} onClick={island.undo} title="Undo (Ctrl+Z)">↶ Undo</button>
          <button className="btn" disabled={!island.canRedo} onClick={island.redo} title="Redo (Ctrl+Shift+Z)">↷ Redo</button>
          <label className="btn cursor-pointer">
            Import .json / .zip
            <input type="file" hidden accept=".json,.zip,application/json,application/zip" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
          </label>
        </div>
      </header>

      <main className="grid grid-cols-1 items-start gap-5 px-4 pb-6 sm:px-6 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <GeneratorPanel
          mode={mode}
          setMode={setMode}
          prompt={prompt}
          setPrompt={setPrompt}
          providers={providers}
          envKeys={envKeys}
          online={online}
          busy={busy}
          status={status}
          onGenerate={onGenerate}
          onReroll={onReroll}
        />

        <section className="panel min-w-0 p-4" aria-label="Island">
          {spec && mode3 && (
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-display text-xl uppercase">{spec.name}</h2>
              <span className="rounded-full bg-sun px-2 py-0.5 text-xs font-extrabold text-sun-ink">{mode3.label}</span>
              <span className="text-sm text-mute">
                {spec.pois.length} locations · {spec.features.length} features · {spec.devices.filter((d) => d.enabled).length} devices · {generateVerseFiles(spec).length} Verse files
              </span>
            </div>
          )}
          <div className="mb-4 flex flex-wrap gap-1.5" role="tablist">
            {TABS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'tab-on' : ''}`} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>

          {!spec && <p className="py-20 text-center text-mute">Generate an island to get started.</p>}
          {spec && (
            <>
              {tab === 'map' && <MapEditor spec={spec} onCommit={commit} />}
              {visited3d && (
                <div className={tab === '3d' ? '' : 'hidden'}>
                  <View3D spec={spec} sceneRef={sceneRef} />
                </div>
              )}
              {tab === 'image' && <ThumbnailView spec={spec} scene={sceneRef.current} useHero={useHero} setUseHero={(v) => { setUseHero(v); force((n) => n + 1); }} />}
              {tab === 'devices' && <DevicesPanel spec={spec} onCommit={(s) => commit(s)} onReplan={() => commit(replan({ ...spec }))} />}
              {tab === 'verse' && <VersePanel spec={spec} />}
              {tab === 'details' && <DetailsPanel spec={spec} onCommit={commit} />}
              {tab === 'publish' && <PublishPanel spec={spec} onCommit={commit} />}
              {tab === 'export' && <ExportPanel spec={spec} hero={hero} onStatus={setStatus} />}
            </>
          )}
        </section>
      </main>
      <footer className="px-4 pb-6 text-center text-xs text-mute">Not affiliated with or endorsed by Epic Games. Fortnite and UEFN are trademarks of Epic Games, Inc.</footer>
    </div>
  );
}
