import { useEffect, useState } from 'react';
import { MODES } from '../../../core/src/index.ts';
import { loadModels, type ProviderInfo, type Access, type ProviderStatus, type ModelInfo } from '../api.ts';
import { store } from '../storage.ts';
import { ModePicker } from './ModePicker.tsx';

const EXAMPLES: Record<string, string[]> = {
  default: [
    'Frozen volcano island with a neon city in the middle and pirate docks on the coast',
    'Cozy autumn farmland with a haunted swamp and a big castle on a hill',
    'Desert canyon with an abandoned spy base and a hidden jungle temple',
    'Candy-themed party island with a giant cake mountain',
  ],
  'Parkour & Racing': ['Lava temple run with swinging axes and collapsing floors', 'Neon city rooftop race with boost pads and ramps', 'Candy obstacle course with jelly bouncers'],
  'Tycoon & Sim': ['Pizza restaurant tycoon on a sunny beach', 'Space mining tycoon on an asteroid', 'Pet shop simulator in a cozy village'],
  'Survival & Horror': ['Abandoned hospital at night with a stalker', 'Zombie farm siege at dusk', 'Snowy mountain survival with wolves'],
  Objective: ['Medieval castle siege with two keeps', 'Sci-fi lab with three reactors to capture', 'Pirate bay with ships as bases'],
  Combat: ['Japanese garden arena with bridges', 'Rusty junkyard with shipping containers', 'Neon rooftop arena with ziplines'],
  'Party & Social': ['Spooky mansion prop hunt full of furniture', 'Tropical hangout with a dance club and pool', 'Toy store hide and seek'],
};

export interface AiSettings {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  passcode: string;
}

interface Props {
  mode: string;
  setMode: (m: string) => void;
  prompt: string;
  setPrompt: (p: string) => void;
  providers: ProviderInfo[];
  envKeys: ProviderStatus;
  access: Access;
  online: boolean;
  busy: boolean;
  status: { text: string; kind: '' | 'error' | 'success' };
  onGenerate: (ai: AiSettings) => void;
  onReroll: () => void;
}

export function GeneratorPanel(p: Props) {
  const [providerId, setProviderId] = useState(() => store.get('provider', 'offline'));
  const provider = p.providers.find((x) => x.id === providerId) || p.providers[0];
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [remember, setRemember] = useState(false);
  const [passcode, setPasscode] = useState(() => store.get('passcode', ''));
  const [liveModels, setLiveModels] = useState<ModelInfo[] | null>(null);
  const [modelsBusy, setModelsBusy] = useState(false);
  const [modelsNote, setModelsNote] = useState('');
  const needsPasscode = p.access.serverKeys === 'passcode' && Boolean(p.envKeys[provider?.id]?.envKey);

  useEffect(() => {
    if (!provider) return;
    store.set('provider', provider.id);
    setModel(store.get(`model:${provider.id}`, '') || provider.defaultModel);
    setBaseUrl(store.get(`baseurl:${provider.id}`, '') || provider.baseUrl || '');
    const saved = store.get(`key:${provider.id}`, '');
    setApiKey(saved);
    setRemember(Boolean(saved));
    setLiveModels(store.get<ModelInfo[] | null>(`liveModels:${provider.id}`, null));
    setModelsNote('');
  }, [provider?.id, p.providers]);

  // OpenRouter's free model list needs no key: load it as soon as OpenRouter is picked.
  useEffect(() => {
    if (provider?.id === 'openrouter' && p.online && !store.get(`liveModels:${provider.id}`, null)) fetchModels();
  }, [provider?.id, p.online]);

  const fetchModels = async () => {
    if (!provider) return;
    setModelsBusy(true);
    setModelsNote('');
    try {
      const models = await loadModels({ provider: provider.id, apiKey, baseUrl: p.access.customBaseUrls === 'off' ? '' : baseUrl, passcode: needsPasscode && !apiKey ? passcode : '' });
      setLiveModels(models);
      store.set(`liveModels:${provider.id}`, models);
      setModelsNote(`${models.length} models available to your key.`);
      if (models.length && !models.some((m) => m.id === model)) setModel(models[0].id);
    } catch (e: any) {
      setModelsNote(e?.message || 'Could not load models.');
    } finally {
      setModelsBusy(false);
    }
  };

  const examples = EXAMPLES[MODES[p.mode].category] || EXAMPLES.default;

  const useFreeGenerator = () => {
    setProviderId('offline');
    store.set('provider', 'offline');
    p.onGenerate({ provider: 'offline', model: 'procedural', apiKey: '', baseUrl: '', passcode: '' });
  };
  const missingKey = p.status.kind === 'error' && /API key|passcode/i.test(p.status.text);

  const submit = () => {
    store.set(`model:${provider.id}`, model);
    if (provider.baseUrl) store.set(`baseurl:${provider.id}`, baseUrl);
    if (remember && apiKey) store.set(`key:${provider.id}`, apiKey);
    else store.del(`key:${provider.id}`);
    if (needsPasscode) store.set('passcode', passcode);
    p.onGenerate({ provider: provider.id, model, apiKey, baseUrl: p.access.customBaseUrls === 'off' ? '' : baseUrl, passcode: needsPasscode && !apiKey ? passcode : '' });
  };

  return (
    <section className="panel min-w-0 space-y-4 p-4" aria-label="Generator">
      <ModePicker value={p.mode} onChange={p.setMode} />

      <div>
        <label className="label" htmlFor="prompt">Describe your island</label>
        <textarea
          id="prompt"
          className="input min-h-28 resize-y"
          rows={4}
          value={p.prompt}
          onChange={(e) => p.setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder="e.g. A frozen volcano island with a neon city in the middle…"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {examples.map((ex) => (
            <button key={ex} type="button" className="chip" title={ex} onClick={() => p.setPrompt(ex)}>
              {ex.length > 40 ? `${ex.slice(0, 38)}…` : ex}
            </button>
          ))}
        </div>
      </div>

      <details className="group" open>
        <summary className="label cursor-pointer list-none">AI model <span className="group-open:hidden">▸</span><span className="hidden group-open:inline">▾</span></summary>
        <div className="space-y-2">
          <select className="input" value={provider?.id} onChange={(e) => setProviderId(e.target.value)} aria-label="AI provider">
            {([
              ['Free — no billing', p.providers.filter((x) => x.free)],
              ['Paid API keys', p.providers.filter((x) => !x.free)],
            ] as const).map(([group, list]) =>
              list.length ? (
                <optgroup key={group} label={group}>
                  {list.map((x) => (
                    <option key={x.id} value={x.id} disabled={p.envKeys[x.id]?.available === false}>{x.label}{p.envKeys[x.id]?.available === false ? ' — not on this server' : ''}</option>
                  ))}
                </optgroup>
              ) : null,
            )}
          </select>
          {provider?.free ? (
            <p className="rounded-lg border border-ok/30 bg-ok/10 p-2 text-xs text-ok">
              {provider.free}{' '}
              {provider.keyUrl && (
                <a className="font-bold underline" href={provider.keyUrl} target="_blank" rel="noreferrer">
                  {provider.id === 'ollama' ? 'Get Ollama' : 'Get a free key'}
                </a>
              )}
            </p>
          ) : (
            provider && <p className="text-xs text-mute">Needs a paid API key from this provider. Don't want to pay? Pick one of the free options above.</p>
          )}
          {provider?.id !== 'offline' && (
            <>
              <div className="flex gap-2">
                <input className="input" list="model-list" value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model" />
                {provider?.liveModels && (
                  <button type="button" className="btn shrink-0 px-2" disabled={modelsBusy} onClick={fetchModels} title="Load every model your key can use">
                    {modelsBusy ? 'Loading…' : liveModels ? 'Refresh models' : 'Load all models'}
                  </button>
                )}
              </div>
              <datalist id="model-list">
                {(liveModels?.map((m) => m.id) || provider?.models || []).map((m) => <option key={m} value={m} />)}
              </datalist>
              {liveModels && liveModels.length > 0 && (
                <select className="input" value={liveModels.some((m) => m.id === model) ? model : ''} onChange={(e) => e.target.value && setModel(e.target.value)} aria-label="All models">
                  <option value="">Pick from {liveModels.length} models…</option>
                  {liveModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.label ? `${m.label} (${m.id})` : m.id}</option>
                  ))}
                </select>
              )}
              {modelsNote && <p className="text-xs text-mute">{modelsNote}</p>}
            </>
          )}
          {provider?.baseUrl && p.access.customBaseUrls !== 'off' && <input className="input" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} aria-label="Base URL" placeholder="Base URL" />}
          {(provider?.needsKey || provider?.id === 'openai') && (
            <>
              <input className="input" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={provider.keyHint} aria-label="API key" />
              <div className="flex items-center justify-between text-xs text-mute">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember key in this browser
                </label>
                {p.envKeys[provider.id]?.envKey && <span className="text-ok">{needsPasscode ? 'shared key on server' : 'key set on server'}</span>}
              </div>
              {needsPasscode && !apiKey && (
                <input className="input" type="password" autoComplete="off" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Server passcode (to use the shared key)" aria-label="Server passcode" />
              )}
            </>
          )}
        </div>
      </details>

      <button type="button" className="btn btn-primary w-full py-4 font-display text-lg uppercase" disabled={p.busy} onClick={submit}>
        {p.busy ? 'Designing…' : 'Generate island'}
      </button>
      <button type="button" className="btn btn-ghost w-full" disabled={p.busy} onClick={p.onReroll}>
        Quick offline reroll
      </button>
      <p role="status" aria-live="polite" className={`min-h-5 text-sm ${p.status.kind === 'error' ? 'text-bad' : p.status.kind === 'success' ? 'text-ok' : 'text-mute'}`}>
        {p.status.text}
      </p>
      {missingKey && provider?.id !== 'offline' && (
        <button type="button" className="btn w-full border-ok/40 bg-ok/15 text-ok" onClick={useFreeGenerator}>
          No key? Make it with the free offline generator instead
        </button>
      )}
      {!p.online && <p className="text-xs text-mute">No server detected — only the offline generator is available. Run <code>npm start</code> to use AI models.</p>}
    </section>
  );
}
