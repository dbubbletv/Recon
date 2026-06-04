import type { GameState } from './types';
import { PREMISES_BY_ID } from '../data/premises';
import { getModifiers } from './modifiers';
import { advanceJobs } from './systems/productionSystem';
import { expireOrders, makeOrder, maybeSpawnOrder } from './systems/orderSystem';
import { chargeDailyCosts } from './systems/economySystem';
import { expireEffects, maybeRollEvent } from './systems/eventSystem';
import { evaluateGoals } from './goals';
import { addLog } from './log';
import { chance } from './rng';

// The master tick: 1 tick = 1 in-game hour. Each tick advances jobs, accrues costs,
// maybe spawns orders/events, handles the showroom, and re-checks goals. Pure.

/** Showroom walk-ins: footfall the Sales role converts into orders. */
function processShowroom(state: GameState): GameState {
  const premises = PREMISES_BY_ID[state.premisesTierId];
  if (!premises?.hasShowroom || premises.footfall <= 0) return state;

  const salesStaff = state.staff.filter((s) => s.role === 'sales');
  if (salesStaff.length === 0) return state;

  const mods = getModifiers(state);
  // Footfall per hour, converted by sales proficiency + conversion upgrades.
  const footfallPerHour = premises.footfall / 24;
  const conversion =
    Math.min(0.9, salesStaff.reduce((s, st) => s + st.proficiency, 0) * 0.25 + mods.salesConversion);
  const convertChance = footfallPerHour * conversion;

  let s = state.rngSeed;
  let convert: boolean;
  [convert, s] = chance(s, Math.min(0.5, convertChance));
  if (!convert) return { ...state, rngSeed: s };

  const built = makeOrder({ ...state, rngSeed: s }, 'domestic', s);
  // Walk-in upsell: sales nudge the payout up a touch.
  const order = { ...built.order, customerName: `${built.order.customerName} (walk-in)`, payout: Math.round(built.order.payout * 1.1) };
  let next: GameState = { ...state, rngSeed: built.seed, orders: [...state.orders, order] };
  next = addLog(next, `Walk-in converted by your sales team: ${order.customerName}.`, 'good');
  return next;
}

/** Advance exactly one in-game hour. */
export function tickOnce(state: GameState): GameState {
  if (state.gameOver) return state;

  let next = state;

  // Advance clock.
  const totalHours = next.totalHours + 1;
  const day = Math.floor(totalHours / 24) + 1;
  const hour = totalHours % 24;
  const newDay = day !== next.day;
  next = { ...next, totalHours, day, hour };

  // Production progress.
  next = advanceJobs(next);

  // Orders: spawn + showroom + expiry.
  next = maybeSpawnOrder(next);
  next = processShowroom(next);
  next = expireOrders(next);

  // Events: roll + expire.
  next = maybeRollEvent(next);
  next = expireEffects(next);

  // Daily costs at the start of each new day.
  if (newDay) {
    next = chargeDailyCosts(next);
  }

  // Goals.
  next = evaluateGoals(next);

  return next;
}
