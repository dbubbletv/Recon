import type { GameState, LogEntry } from './types';

const MAX_LOG = 120;

/** Append a log entry, keeping only the most recent MAX_LOG. */
export function addLog(state: GameState, text: string, tone: LogEntry['tone'] = 'info'): GameState {
  const entry: LogEntry = {
    hour: Math.floor(state.totalHours % 24),
    day: Math.floor(state.totalHours / 24) + 1,
    text,
    tone,
  };
  const log = [entry, ...state.log].slice(0, MAX_LOG);
  return { ...state, log };
}
