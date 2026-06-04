import type { GameState } from '../types';
import { PREMISES_BY_ID } from '../../data/premises';
import { addLog } from '../log';

// EconomySystem — accrues wages and premises overhead, charged once per in-game day.
// Also handles bankruptcy detection.

/** Total daily wage bill across all staff. */
export function dailyWages(state: GameState): number {
  return state.staff.reduce((sum, s) => sum + s.wage, 0);
}

export function dailyOverhead(state: GameState): number {
  return PREMISES_BY_ID[state.premisesTierId]?.overhead ?? 0;
}

/** Charge wages + overhead. Call once when a new day begins. */
export function chargeDailyCosts(state: GameState): GameState {
  const wages = dailyWages(state);
  const overhead = dailyOverhead(state);
  const total = wages + overhead;
  if (total <= 0) return state;

  let next: GameState = {
    ...state,
    cash: state.cash - total,
    stats: {
      ...state.stats,
      totalWageCost: state.stats.totalWageCost + wages,
      totalOverhead: state.stats.totalOverhead + overhead,
    },
  };
  next = addLog(next, `Daily costs: wages £${wages}, overhead £${overhead}.`, 'info');

  if (next.cash < -2000) {
    next = addLog({ ...next, gameOver: true, speed: 0 }, 'You ran out of cash. The shutters come down for the last time.', 'bad');
  } else if (next.cash < 0) {
    next = addLog(next, 'Cash is negative — clear the order book or you risk going under.', 'warn');
  }
  return next;
}
