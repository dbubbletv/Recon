import type { GameState } from './types';
import { SAVE_VERSION, createInitialState } from './initialState';

// Persistence — serialise state to JSON in localStorage with manual + autosave slots.
// Note: localStorage is unavailable in some sandboxes; all calls are guarded so the
// game still runs (just without saving) when storage is blocked.

const PREFIX = 'mtm:save:';
export const AUTOSAVE_SLOT = 'autosave';

function storageAvailable(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const k = '__mtm_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export const canPersist = storageAvailable();

export interface SaveMeta {
  slot: string;
  day: number;
  cash: number;
  reputation: number;
  savedAt: number;
}

export function saveGame(slot: string, state: GameState): boolean {
  if (!canPersist) return false;
  try {
    const payload = JSON.stringify({ state, savedAt: Date.now() });
    localStorage.setItem(PREFIX + slot, payload);
    return true;
  } catch {
    return false;
  }
}

export function loadGame(slot: string): GameState | null {
  if (!canPersist) return null;
  try {
    const raw = localStorage.getItem(PREFIX + slot);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state: GameState };
    return migrate(parsed.state);
  } catch {
    return null;
  }
}

export function deleteSave(slot: string): void {
  if (!canPersist) return;
  try {
    localStorage.removeItem(PREFIX + slot);
  } catch {
    /* ignore */
  }
}

export function listSaves(): SaveMeta[] {
  if (!canPersist) return [];
  const metas: SaveMeta[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { state: GameState; savedAt: number };
      metas.push({
        slot: key.slice(PREFIX.length),
        day: parsed.state.day,
        cash: parsed.state.cash,
        reputation: parsed.state.reputation,
        savedAt: parsed.savedAt,
      });
    }
  } catch {
    /* ignore */
  }
  return metas.sort((a, b) => b.savedAt - a.savedAt);
}

/** Bring an older save up to the current schema, filling any missing fields. */
export function migrate(state: GameState): GameState {
  const base = createInitialState();
  // Shallow-merge defaults for any newly-added top-level fields, then keep saved data.
  const merged: GameState = { ...base, ...state, version: SAVE_VERSION };
  // Ensure nested objects exist.
  merged.stats = { ...base.stats, ...state.stats };
  merged.pricing = { ...base.pricing, ...state.pricing };
  merged.inventory = { ...state.inventory };
  return merged;
}
