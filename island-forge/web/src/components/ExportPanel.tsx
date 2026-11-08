import { useState } from 'react';
import { buildPackageZip, generateReadme, devicesCsv, publishKit, heightmapPng, biomePaintPng, generateVerseFiles, slug, type MapSpec } from '../../../core/src/index.ts';
import { renderMinimap, canvasBlob, thumbnailJpeg } from '../render/map2d.ts';
import { download } from '../storage.ts';

export function ExportPanel({ spec, hero, onStatus }: { spec: MapSpec; hero: () => CanvasImageSource | undefined; onStatus: (t: string, k?: '' | 'error' | 'success') => void }) {
  const [busy, setBusy] = useState('');
  const base = slug(spec);
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e: any) {
      onStatus(e?.message || 'Export failed', 'error');
    } finally {
      setBusy('');
    }
  };
  const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

  const items: { key: string; title: string; desc: string; primary?: boolean; fn: () => Promise<void> }[] = [
    {
      key: 'zip', primary: true, title: 'UEFN package (.zip)', desc: 'Everything below in one zip, with a step-by-step import guide.',
      fn: async () => {
        const [thumb, mini] = await Promise.all([thumbnailJpeg(spec, hero()), canvasBlob(renderMinimap(spec, 1024), 'image/png')]);
        download(`${base}-uefn.zip`, await buildPackageZip(spec, { thumbnailJpg: await bytes(thumb), minimapPng: await bytes(mini) }), 'application/zip');
        onStatus('UEFN package downloaded. Open README.md inside it for the import steps.', 'success');
      },
    },
    { key: 'thumb', title: 'Island image (.jpg)', desc: '1920×1080 thumbnail for publishing, under 1 MB.', fn: async () => download(`${base}-thumbnail.jpg`, await thumbnailJpeg(spec, hero())) },
    { key: 'mini', title: 'Minimap (.png)', desc: '1024×1024 layout with grid and labels.', fn: async () => download(`${base}-minimap.png`, await canvasBlob(renderMinimap(spec, 1024), 'image/png')) },
    { key: 'height', title: 'Heightmap (.png, 16-bit)', desc: '1009×1009 grayscale for Landscape import or sculpt reference.', fn: async () => download(`${base}-heightmap-1009.png`, await heightmapPng(spec, 1009), 'image/png') },
    { key: 'paint', title: 'Biome paint guide (.png)', desc: 'Which landscape material goes where.', fn: async () => download(`${base}-biome-paint.png`, await biomePaintPng(spec, 512), 'image/png') },
    {
      key: 'verse', title: 'All Verse files', desc: `${generateVerseFiles(spec).length} .verse devices for this mode.`,
      fn: async () => generateVerseFiles(spec).forEach((f, i) => setTimeout(() => download(f.path, f.code, 'text/plain'), i * 250)),
    },
    { key: 'csv', title: 'Device list (.csv)', desc: 'Every device with coordinates and settings — opens in Sheets/Excel.', fn: async () => download(`${base}-devices.csv`, devicesCsv(spec), 'text/csv') },
    { key: 'readme', title: 'Setup guide (.md)', desc: 'The import guide on its own.', fn: async () => download(`${base}-UEFN-setup.md`, generateReadme(spec), 'text/markdown') },
    { key: 'publish', title: 'Publish kit (.txt)', desc: 'Title, description, tags, release notes.', fn: async () => download(`${base}-publish.txt`, publishKit(spec), 'text/plain') },
    { key: 'json', title: 'Map spec (.json)', desc: 'Re-import any time, or use from Python, Ruby and the mobile app.', fn: async () => download(`${base}.island.json`, JSON.stringify(spec, null, 2), 'application/json') },
  ];

  return (
    <div>
      <p className="mb-4 max-w-3xl text-sm text-mute">
        UEFN has no public file format for injecting a finished level, so the package gives you everything around it: terrain heightmap, layout markers (Verse), every device with coordinates and settings, game-mode Verse logic, images and the publish text.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((it) => (
          <button key={it.key} className={`rounded-2xl border p-4 text-left transition hover:brightness-110 disabled:opacity-60 ${it.primary ? 'border-sun bg-sun text-sun-ink' : 'border-white/10 bg-ink-950/50'}`} disabled={!!busy} onClick={() => run(it.key, it.fn)}>
            <span className="block font-extrabold">{busy === it.key ? 'Working…' : it.title}</span>
            <span className={`block text-sm ${it.primary ? 'text-sun-ink/80' : 'text-mute'}`}>{it.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
