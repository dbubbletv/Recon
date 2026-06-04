import type { ActiveEffect, GameState } from '../types';
import { EVENT_TEMPLATES, type EventTemplate } from '../../data/events';
import { MATERIALS } from '../../data/materials';
import { MACHINES_BY_ID } from '../../data/machines';
import { addLog } from '../log';
import { clamp } from '../util';
import { chance, nextRandom, pick, randRange } from '../rng';
import { makeOrder } from './orderSystem';

// EventSystem — occasionally rolls a world event and applies its effect. Time-boxed
// effects live in state.activeEffects and are reverted when they expire.

let effectCounter = 0;
function effectId(): string {
  effectCounter += 1;
  return `eff_${Date.now().toString(36)}_${effectCounter}`;
}

function weightedPick(seed: number, templates: EventTemplate[]): [EventTemplate, number] {
  const total = templates.reduce((s, t) => s + t.weight, 0);
  let [roll, s] = nextRandom(seed);
  roll *= total;
  for (const t of templates) {
    if (roll < t.weight) return [t, s];
    roll -= t.weight;
  }
  return [templates[templates.length - 1], s];
}

/** Expire time-boxed effects and revert their impact (e.g. price spikes). */
export function expireEffects(state: GameState): GameState {
  const expired = state.activeEffects.filter((e) => state.totalHours >= e.expiresHour);
  if (expired.length === 0) return state;

  let priceMultipliers = { ...state.priceMultipliers };
  for (const e of expired) {
    if (e.kind === 'priceSpike' && e.data?.materialId) {
      delete priceMultipliers[e.data.materialId as string];
    }
  }
  let next: GameState = {
    ...state,
    activeEffects: state.activeEffects.filter((e) => state.totalHours < e.expiresHour),
    priceMultipliers,
  };
  for (const e of expired) {
    next = addLog(next, `${e.label} has ended.`, 'info');
  }
  return next;
}

/** Roll for and apply a new event. Called occasionally from the tick loop. */
export function maybeRollEvent(state: GameState): GameState {
  // ~ one roll attempt per in-game day worth of hours, modest base chance.
  let s = state.rngSeed;
  let happen: boolean;
  [happen, s] = chance(s, 0.04);
  if (!happen) return { ...state, rngSeed: s };

  const eligible = EVENT_TEMPLATES.filter((t) => state.reputation >= t.minReputation);
  let template: EventTemplate;
  [template, s] = weightedPick(s, eligible);

  let next: GameState = { ...state, rngSeed: s };
  switch (template.kind) {
    case 'priceSpike':
      next = applyPriceSpike(next, template);
      break;
    case 'breakdown':
      next = applyBreakdown(next, template);
      break;
    case 'rushOrder':
      next = applyRushOrder(next);
      break;
    case 'bulkTender':
      next = applyBulkTender(next);
      break;
    case 'badReview':
      next = applyBadReview(next);
      break;
    case 'competitor':
      next = applyTimedEffect(next, template);
      break;
    case 'seasonalDemand':
      next = applyTimedEffect(next, template);
      break;
    default:
      break;
  }
  return next;
}

function applyPriceSpike(state: GameState, template: EventTemplate): GameState {
  let s = state.rngSeed;
  let mat;
  [mat, s] = pick(s, MATERIALS);
  let mult: number;
  [mult, s] = randRange(s, 1.4, 2.2);
  const effect: ActiveEffect = {
    id: effectId(),
    kind: 'priceSpike',
    label: `Price spike: ${mat.name}`,
    expiresHour: state.totalHours + template.durationHours,
    data: { materialId: mat.id, multiplier: mult },
  };
  let next: GameState = {
    ...state,
    rngSeed: s,
    priceMultipliers: { ...state.priceMultipliers, [mat.id]: mult },
    activeEffects: [...state.activeEffects, effect],
  };
  next = addLog(next, `${mat.name} price has jumped ${Math.round((mult - 1) * 100)}% — supplier shortage.`, 'warn');
  return next;
}

function applyBreakdown(state: GameState, _template: EventTemplate): GameState {
  // Pick a station weighted by its machine's breakdown chance; skip if all idle benches.
  const candidates = state.stations.filter((st) => !st.broken);
  if (candidates.length === 0) return state;
  let s = state.rngSeed;
  let station;
  [station, s] = pick(s, candidates);
  const machine = MACHINES_BY_ID[station.machineId];
  // Only actually break with the machine's own probability — keeps manual benches reliable.
  let breaks: boolean;
  [breaks, s] = chance(s, Math.min(1, (machine?.breakdownChance ?? 0.02) * 6));
  if (!breaks) return { ...state, rngSeed: s };

  let next: GameState = {
    ...state,
    rngSeed: s,
    stations: state.stations.map((st) => (st.id === station.id ? { ...st, broken: true } : st)),
    jobs: state.jobs.map((j) => (j.stationId === station.id && j.status === 'running' ? { ...j, status: 'blocked' } : j)),
  };
  next = addLog(next, `${station.name} has broken down — repair it from Upgrades & Premises to resume.`, 'bad');
  return next;
}

function applyRushOrder(state: GameState): GameState {
  const built = makeOrder(state, 'domestic', state.rngSeed);
  const order = {
    ...built.order,
    customerName: `${built.order.customerName} (RUSH)`,
    deadlineHour: state.totalHours + 36,
    payout: Math.round(built.order.payout * 1.5),
    fussiness: 0.5,
  };
  let next: GameState = {
    ...state,
    rngSeed: built.seed,
    orders: [...state.orders, order],
  };
  next = addLog(next, `Rush order in from ${order.customerName}: £${order.payout}, tight deadline.`, 'info');
  return next;
}

function applyBulkTender(state: GameState): GameState {
  const built = makeOrder(state, 'commercial', state.rngSeed);
  const order = { ...built.order, payout: Math.round(built.order.payout * 1.2) };
  let next: GameState = { ...state, rngSeed: built.seed, orders: [...state.orders, order] };
  next = addLog(next, `Bulk tender from ${order.customerName}: ${order.lines.length} blinds, £${order.payout}.`, 'info');
  return next;
}

function applyBadReview(state: GameState): GameState {
  const hit = clamp(state.reputation * 0.05 + 1, 1, 6);
  let next: GameState = { ...state, reputation: clamp(state.reputation - hit, 0, 100) };
  next = addLog(next, `A customer left a bad review. Reputation −${hit.toFixed(1)}.`, 'bad');
  return next;
}

function applyTimedEffect(state: GameState, template: EventTemplate): GameState {
  // Avoid stacking duplicates of the same kind.
  if (state.activeEffects.some((e) => e.kind === template.kind)) return state;
  const effect: ActiveEffect = {
    id: effectId(),
    kind: template.kind,
    label: template.label,
    expiresHour: state.totalHours + template.durationHours,
  };
  let next: GameState = { ...state, activeEffects: [...state.activeEffects, effect] };
  const tone = template.kind === 'seasonalDemand' ? 'good' : 'warn';
  next = addLog(next, `${template.label}: ${template.description}`, tone);
  return next;
}
