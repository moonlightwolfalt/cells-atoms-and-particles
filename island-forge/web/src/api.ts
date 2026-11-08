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

export interface Access {
  public: boolean;
  serverKeys: 'open' | 'passcode' | 'off';
  customBaseUrls: 'any' | 'allowlist' | 'off';
}
export type ProviderStatus = Record<string, { envKey: boolean; available?: boolean }>;
const LOCAL_ACCESS: Access = { public: false, serverKeys: 'open', customBaseUrls: 'any' };

export const OFFLINE: ProviderInfo = { id: 'offline', label: 'Offline generator (no AI, instant)', defaultModel: 'procedural', models: [], needsKey: false };

export async function loadProviders(): Promise<{ providers: ProviderInfo[]; envKeys: ProviderStatus; online: boolean; access: Access }> {
  try {
    const res = await fetch('/api/providers');
    if (!res.ok) throw new Error();
    const data = await res.json();
    return { providers: data.providers, envKeys: data.status || {}, online: true, access: data.access || LOCAL_ACCESS };
  } catch {
    return { providers: [OFFLINE], envKeys: {}, online: false, access: LOCAL_ACCESS };
  }
}

export interface GenerateArgs {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  prompt: string;
  mode: string;
  passcode?: string;
}

export async function generate(args: GenerateArgs, online: boolean): Promise<MapSpec> {
  if (args.provider === 'offline' || !online) return generateProcedural(args.prompt, args.mode);
  const { passcode, ...body } = args;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (passcode) headers['x-island-forge-passcode'] = passcode;
  const res = await fetch('/api/generate', { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data.spec;
}
