// Island state with undo/redo. Layout and rule edits re-plan devices: planned values are
// refreshed, on/off toggles and extra settings are kept, and devices added by hand stay.
import { useCallback, useState } from 'react';
import { normalizeSpec, planDevices, type MapSpec } from '../../core/src/index.ts';
import { store } from './storage.ts';

export function replan(spec: MapSpec): MapSpec {
  const old = new Map(spec.devices.map((d) => [d.id + '|' + d.device, d]));
  const devices = planDevices(spec).map((d) => {
    const prev = old.get(d.id + '|' + d.device);
    return prev ? { ...d, enabled: prev.enabled, label: prev.label, settings: { ...prev.settings, ...d.settings } } : d;
  });
  const custom = spec.devices.filter((d) => d.id.includes('-custom-'));
  return { ...spec, devices: [...devices, ...custom] };
}

export function useIsland() {
  const [history, setHistory] = useState<{ past: MapSpec[]; present: MapSpec | null; future: MapSpec[] }>(() => {
    const last = store.get<MapSpec | null>('lastSpec', null);
    let present: MapSpec | null = null;
    try {
      present = last && Array.isArray(last.pois) ? normalizeSpec(last, last.mode) : null;
    } catch {
      present = null;
    }
    return { past: [], present, future: [] };
  });

  const commit = useCallback((next: MapSpec, opts: { replanDevices?: boolean; mergeWithLast?: boolean } = {}) => {
    const spec = opts.replanDevices ? replan(next) : next;
    store.set('lastSpec', spec);
    setHistory((h) => ({
      past: opts.mergeWithLast || !h.present ? h.past : [...h.past.slice(-49), h.present],
      present: spec,
      future: [],
    }));
  }, []);

  const replace = useCallback((spec: MapSpec) => {
    const s = normalizeSpec(spec, spec.mode);
    store.set('lastSpec', s);
    setHistory((h) => ({ past: h.present ? [...h.past.slice(-49), h.present] : h.past, present: s, future: [] }));
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.past.length || !h.present) return h;
      const prev = h.past[h.past.length - 1];
      store.set('lastSpec', prev);
      return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future] };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (!h.future.length || !h.present) return h;
      const next = h.future[0];
      store.set('lastSpec', next);
      return { past: [...h.past, h.present], present: next, future: h.future.slice(1) };
    });
  }, []);

  return { spec: history.present, commit, replace, undo, redo, canUndo: history.past.length > 0, canRedo: history.future.length > 0 };
}
