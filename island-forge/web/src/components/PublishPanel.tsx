import { useState } from 'react';
import { publishKit, type MapSpec } from '../../../core/src/index.ts';

export function PublishPanel({ spec, onCommit }: { spec: MapSpec; onCommit: (s: MapSpec, o?: { mergeWithLast?: boolean }) => void }) {
  const [tag, setTag] = useState('');
  const pub = spec.publish;
  const set = (patch: Partial<MapSpec['publish']>) => onCommit({ ...spec, publish: { ...pub, ...patch } }, { mergeWithLast: true });
  const addTag = () => {
    const t = tag.trim().toLowerCase().slice(0, 24);
    if (t && pub.tags.length < 4 && !pub.tags.includes(t)) set({ tags: [...pub.tags, t] });
    setTag('');
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <label className="block text-xs text-mute">Title <span className={pub.title.length > 40 ? 'text-bad' : ''}>({pub.title.length}/40)</span>
          <input className="input" maxLength={40} value={pub.title} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label className="block text-xs text-mute">Description ({pub.description.length}/400)
          <textarea className="input" rows={4} maxLength={400} value={pub.description} onChange={(e) => set({ description: e.target.value })} />
        </label>
        <div>
          <span className="text-xs text-mute">Tags (up to 4)</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {pub.tags.map((t) => (
              <button key={t} className="chip" onClick={() => set({ tags: pub.tags.filter((x) => x !== t) })} aria-label={`Remove tag ${t}`}>{t} ✕</button>
            ))}
          </div>
          {pub.tags.length < 4 && (
            <div className="mt-2 flex gap-2">
              <input className="input" value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} placeholder="Add a tag" />
              <button className="btn" onClick={addTag}>Add</button>
            </div>
          )}
        </div>
        <label className="block text-xs text-mute">Release notes
          <textarea className="input" rows={3} maxLength={400} value={pub.release_notes} onChange={(e) => set({ release_notes: e.target.value })} />
        </label>
      </div>
      <div>
        <h3 className="label">publish.txt preview</h3>
        <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-ink-950 p-3 text-xs">{publishKit(spec)}</pre>
      </div>
    </div>
  );
}
