// Writes the map JSON schema + catalogs to /schema for the Python and Ruby clients.
import { writeFileSync, mkdirSync } from 'node:fs';
import { MAP_SCHEMA, MODE_LIST, DEVICES, FEATURE_TYPES } from '../core/src/index.ts';

// The Python and Ruby packages ship their own copy so they work when installed on their own.
const DIRS = ['../schema/', '../python/island_forge/data/', '../ruby/data/'];
const write = (name: string, data: unknown) => {
  for (const dir of DIRS) {
    mkdirSync(new URL(dir, import.meta.url), { recursive: true });
    writeFileSync(new URL(`${dir}${name}`, import.meta.url), JSON.stringify(data, null, 2) + '\n');
  }
};
write('island-map.schema.json', { $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'Island Forge map (AI answer)', ...MAP_SCHEMA });
write('modes.json', MODE_LIST);
write('devices.json', DEVICES);
write('feature-types.json', FEATURE_TYPES);
console.log(`Wrote island-map.schema.json, modes.json, devices.json, feature-types.json to ${DIRS.join(', ')}`);
