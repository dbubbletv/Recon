import type { GameState } from './types';
import { BLIND_TYPES } from '../data/blindTypes';
import { PREMISES_BY_ID } from '../data/premises';
import { addLog } from './log';

// Milestone goals layered over the endless sandbox. Re-evaluated each tick; newly
// completed goals are logged with a celebratory note.

type GoalCheck = (state: GameState) => boolean;

const CHECKS: Record<string, GoalCheck> = {
  first_delivery: (s) => s.stats.ordersDelivered >= 1,
  rep_15: (s) => s.reputation >= 15,
  hire_first: (s) => s.staff.length >= 1,
  second_line: (s) => s.unlockedBlindTypes.length >= 2,
  showroom: (s) => PREMISES_BY_ID[s.premisesTierId]?.hasShowroom === true,
  rep_30: (s) => s.reputation >= 30,
  cash_10k: (s) => s.cash >= 10000,
  all_lines: (s) => s.unlockedBlindTypes.length >= BLIND_TYPES.length,
  factory: (s) => s.premisesTierId === 'factory' || s.premisesTierId === 'regional',
  rep_70: (s) => s.reputation >= 70,
};

export function evaluateGoals(state: GameState): GameState {
  let next = state;
  let changed = false;
  const goals = state.goals.map((g) => {
    if (g.done) return g;
    const check = CHECKS[g.id];
    if (check && check(state)) {
      changed = true;
      next = addLog(next, `🎯 Milestone: ${g.label}.`, 'good');
      return { ...g, done: true };
    }
    return g;
  });
  return changed ? { ...next, goals } : state;
}
