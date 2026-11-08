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
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-island-forge-keepalive': '1' };
  if (passcode) headers['x-island-forge-passcode'] = passcode;
  let res: Response;
  try {
    res = await fetch('/api/generate', { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    throw new Error('Lost connection to the Island Forge server. Check it is still running, then try again.');
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* not JSON: an error page from a gateway or proxy in front of the server */
  }
  if (data?.error) throw new Error(data.error);
  if (res.ok && data?.spec) return data.spec;
  if (!data) {
    throw new Error(
      res.ok
        ? 'The server closed the connection before the island was ready. The AI may have taken too long — try again, or pick a faster model.'
        : `The server's gateway answered ${res.status}${res.statusText ? ` ${res.statusText}` : ''} instead of Island Forge — usually the AI took too long or the server restarted. Try again; if it keeps happening, check the server logs.`,
    );
  }
  throw new Error(`Request failed (${res.status})`);
}
