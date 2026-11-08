import { useMemo, useState } from 'react';
import { MODE_LIST, MODE_CATEGORIES, MODES } from '../../../core/src/index.ts';

const CATEGORY_ICON: Record<string, string> = {
  'Battle Royale': '🪂',
  Combat: '⚔️',
  Objective: '🚩',
  'Party & Social': '🎉',
  'Parkour & Racing': '🏁',
  'Survival & Horror': '🧟',
  'Tycoon & Sim': '💰',
};

export function ModePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const current = MODES[value];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MODE_LIST.filter((m) => !q || [m.label, m.category, m.blurb, ...m.tags].join(' ').toLowerCase().includes(q));
  }, [query]);

  return (
    <div>
      <span className="label">Island type</span>
      <button type="button" className="panel flex w-full items-center gap-3 p-3 text-left hover:brightness-110" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="text-2xl" aria-hidden>{CATEGORY_ICON[current.category]}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm uppercase">{current.label}</span>
          <span className="block truncate text-xs text-mute">{current.blurb}</span>
        </span>
        <span className="text-xs text-mute">{open ? 'Close' : `${MODE_LIST.length} types ▾`}</span>
      </button>
      {open && (
        <div className="mt-2 max-h-[420px] overflow-y-auto rounded-2xl border border-white/10 bg-ink-950/80 p-3">
          <input className="input mb-3" placeholder="Search: racing, horror, tycoon…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          {MODE_CATEGORIES.map((cat) => {
            const list = filtered.filter((m) => m.category === cat);
            if (!list.length) return null;
            return (
              <div key={cat} className="mb-3">
                <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-mute">
                  {CATEGORY_ICON[cat]} {cat}
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {list.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onChange(m.id);
                        setOpen(false);
                      }}
                      className={`rounded-xl border p-2 text-left transition ${m.id === value ? 'border-sun bg-sun text-sun-ink' : 'border-white/10 bg-ink-800 hover:bg-ink-700'}`}
                    >
                      <span className="block text-sm font-extrabold">{m.label}</span>
                      <span className={`block text-[11px] leading-snug ${m.id === value ? 'text-sun-ink/80' : 'text-mute'}`}>
                        {m.rules.max_players}p · {m.rules.team_count ? `${m.rules.team_count} teams` : m.rules.team_size > 1 ? `squads of ${m.rules.team_size}` : 'solo'} · {m.layout}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {!filtered.length && <p className="text-sm text-mute">No island type matches “{query}”.</p>}
        </div>
      )}
    </div>
  );
}
