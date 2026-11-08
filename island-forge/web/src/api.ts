// Talks to the Island Forge server. Falls back to the offline generator when no server is running
// (e.g. the built app opened from static hosting).
import { generateProcedural, type MapSpec } from '../../core/src/index.ts';

export interface ProviderInfo {
  id: string;
  label: string;
  defaultModel: string;
  models: string[];
  needsKey: boolean;
  keyHint?: string;
  baseUrl?: string;
}

export const OFFLINE: ProviderInfo = { id: 'offline', label: 'Offline generator (no AI, instant)', defaultModel: 'procedural', models: [], needsKey: false };

export async function loadProviders(): Promise<{ providers: ProviderInfo[]; envKeys: Record<string, { envKey: boolean }>; online: boolean }> {
  try {
    const res = await fetch('/api/providers');
    if (!res.ok) throw new Error();
    const data = await res.json();
    return { providers: data.providers, envKeys: data.status || {}, online: true };
  } catch {
    return { providers: [OFFLINE], envKeys: {}, online: false };
  }
}

export interface GenerateArgs {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  prompt: string;
  mode: string;
}

export async function generate(args: GenerateArgs, online: boolean): Promise<MapSpec> {
  if (args.provider === 'offline' || !online) return generateProcedural(args.prompt, args.mode);
  const res = await fetch('/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data.spec;
}
