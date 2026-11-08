import { useEffect, useState } from 'react';
import { MODES } from '../../../core/src/index.ts';
import type { ProviderInfo } from '../api.ts';
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
}

interface Props {
  mode: string;
  setMode: (m: string) => void;
  prompt: string;
  setPrompt: (p: string) => void;
  providers: ProviderInfo[];
  envKeys: Record<string, { envKey: boolean }>;
  online: boolean;
  busy: boolean;
  status: { text: string; kind: '' | 'error' | 'success' };
  onGenerate: (ai: AiSettings) => void;
  onReroll: () => void;
}

export function GeneratorPanel(p: Props) {
  const [providerId, setProviderId] = useState(() => store.get('provider', 'anthropic'));
  const provider = p.providers.find((x) => x.id === providerId) || p.providers[0];
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if (!provider) return;
    store.set('provider', provider.id);
    setModel(store.get(`model:${provider.id}`, '') || provider.defaultModel);
    setBaseUrl(store.get(`baseurl:${provider.id}`, '') || provider.baseUrl || '');
    const saved = store.get(`key:${provider.id}`, '');
    setApiKey(saved);
    setRemember(Boolean(saved));
  }, [provider?.id, p.providers]);

  const examples = EXAMPLES[MODES[p.mode].category] || EXAMPLES.default;

  const submit = () => {
    store.set(`model:${provider.id}`, model);
    if (provider.baseUrl) store.set(`baseurl:${provider.id}`, baseUrl);
    if (remember && apiKey) store.set(`key:${provider.id}`, apiKey);
    else store.del(`key:${provider.id}`);
    p.onGenerate({ provider: provider.id, model, apiKey, baseUrl });
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
            {p.providers.map((x) => (
              <option key={x.id} value={x.id}>{x.label}</option>
            ))}
          </select>
          {provider?.id !== 'offline' && (
            <>
              <input className="input" list="model-list" value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model" />
              <datalist id="model-list">
                {provider?.models.map((m) => <option key={m} value={m} />)}
              </datalist>
            </>
          )}
          {provider?.baseUrl && <input className="input" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} aria-label="Base URL" placeholder="Base URL" />}
          {(provider?.needsKey || provider?.id === 'openai') && (
            <>
              <input className="input" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={provider.keyHint} aria-label="API key" />
              <div className="flex items-center justify-between text-xs text-mute">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember key in this browser
                </label>
                {p.envKeys[provider.id]?.envKey && <span className="text-ok">key set on server</span>}
              </div>
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
      {!p.online && <p className="text-xs text-mute">No server detected — only the offline generator is available. Run <code>npm start</code> to use AI models.</p>}
    </section>
  );
}
