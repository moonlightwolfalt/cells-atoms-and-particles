import { CATALOG, catalogEntry, type CatalogKind } from '../../../core/src/index.ts';

/** Chips for a list of catalog ids, plus a grouped dropdown to add more. */
export function IdPicker({ kind, value, onChange, label, max = 40 }: { kind: CatalogKind; value: string[]; onChange: (ids: string[]) => void; label: string; max?: number }) {
  const groups = [...new Set(CATALOG[kind].map((e) => e.category))];
  return (
    <div>
      <span className="text-xs text-mute">{label}</span>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {value.map((id) => (
          <button key={id} type="button" className="chip" onClick={() => onChange(value.filter((x) => x !== id))} aria-label={`Remove ${catalogEntry(id)?.name || id}`}>
            {catalogEntry(id)?.name || id} ✕
          </button>
        ))}
        {value.length === 0 && <span className="text-xs text-mute/70">none</span>}
      </div>
      {value.length < max && (
        <select className="input mt-1.5 py-1" value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])} aria-label={`Add to ${label}`}>
          <option value="">+ Add…</option>
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {CATALOG[kind].filter((e) => e.category === g && !value.includes(e.id)).map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
    </div>
  );
}
