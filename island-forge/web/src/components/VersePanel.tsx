import { useMemo, useState } from 'react';
import { generateVerseFiles, type MapSpec } from '../../../core/src/index.ts';
import { download } from '../storage.ts';

// Minimal Verse syntax colouring (single pass so inserted markup is never re-matched).
const TOKENS = /("[^"]*")|\b(using|class|struct|if|else|then|for|loop|break|set|var|return|spawn|not|and|or|option|array|map|false|true)\b|(@editable|&lt;[a-z_]+&gt;)|\b(\d+(?:\.\d+)?)\b/g;

function highlight(code: string) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return code.split('\n').map((line) => {
    const hash = line.indexOf('#');
    const inString = hash >= 0 && (line.slice(0, hash).match(/"/g) || []).length % 2 === 1;
    const codePart = hash >= 0 && !inString ? line.slice(0, hash) : line;
    const comment = hash >= 0 && !inString ? line.slice(hash) : '';
    let html = esc(codePart).replace(TOKENS, (m, str, kw, attr, numb) =>
      str ? `<span class="text-amber-300">${m}</span>` : kw ? `<span class="text-pink-400">${m}</span>` : attr ? `<span class="text-sky-300">${m}</span>` : numb ? `<span class="text-emerald-300">${m}</span>` : m,
    );
    if (comment) html += `<span class="text-white/40">${esc(comment)}</span>`;
    return html;
  }).join('\n');
}

export function VersePanel({ spec }: { spec: MapSpec }) {
  const files = useMemo(() => generateVerseFiles(spec), [spec]);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const file = files[Math.min(active, files.length - 1)];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(file.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
      <ul className="space-y-1">
        {files.map((f, i) => (
          <li key={f.path}>
            <button className={`w-full rounded-xl border p-2 text-left ${i === active ? 'border-sun bg-sun/10' : 'border-white/10 hover:bg-white/5'}`} onClick={() => setActive(i)}>
              <span className="block text-sm font-bold">{f.title}</span>
              <span className="block truncate font-mono text-[11px] text-mute">{f.path}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <code className="text-sm text-sky-300">{file.device}</code>
          <button className="btn ml-auto py-1" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
          <button className="btn py-1" onClick={() => download(file.path, file.code, 'text/plain')}>Download .verse</button>
        </div>
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-mute">
          {file.setup.map((s) => <li key={s}>{s}</li>)}
        </ol>
        <pre className="max-h-[560px] overflow-auto rounded-xl border border-white/10 bg-ink-950 p-3 text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: highlight(file.code) }} />
      </div>
    </div>
  );
}
