import type {
  CustomerTier,
  FabricGrade,
  GameState,
  Order,
  OrderLine,
  BlindOption,
} from '../types';
import { BLIND_TYPES, BLIND_TYPES_BY_ID } from '../../data/blindTypes';
import { COMMERCIAL_NAMES, DOMESTIC_NAMES, TRADE_NAMES } from '../../data/names';
import { lineMaterialCost, lineValue } from '../recipes';
import { getModifiers } from '../modifiers';
import { chance, nextRandom, pick, randInt, randRange } from '../rng';

// OrderSystem — spawns orders gated by reputation/tier, builds line items from
// unlocked blind types, and sets payout + deadline. Pure: takes state, returns state.

let orderCounter = 0;
export function nextOrderId(): string {
  orderCounter += 1;
  return `ord_${Date.now().toString(36)}_${orderCounter}`;
}

/** Tier availability gated by reputation. */
function availableTiers(reputation: number): CustomerTier[] {
  const tiers: CustomerTier[] = ['domestic'];
  if (reputation >= 12) tiers.push('trade');
  if (reputation >= 30) tiers.push('commercial');
  return tiers;
}

function unlockedTypes(state: GameState) {
  return BLIND_TYPES.filter((b) => state.unlockedBlindTypes.includes(b.id));
}

interface BuiltLine {
  line: OrderLine;
  seed: number;
}

function buildLine(state: GameState, seed: number): BuiltLine {
  const types = unlockedTypes(state);
  let s = seed;
  let blindType;
  [blindType, s] = pick(s, types.length ? types : [BLIND_TYPES_BY_ID['roller']]);

  let w: number;
  let h: number;
  [w, s] = randRange(s, 0.5, 2.4);
  [h, s] = randRange(s, 0.6, 2.2);
  w = Math.round(w * 20) / 20; // snap to 5 cm
  h = Math.round(h * 20) / 20;

  // Fabric grade weighted by tier later; default standard-ish.
  let gradeRoll: number;
  [gradeRoll, s] = nextRandom(s);
  const fabric: FabricGrade = gradeRoll > 0.85 ? 'luxury' : gradeRoll > 0.55 ? 'premium' : 'standard';

  const options: BlindOption[] = [];
  let optRoll: number;
  [optRoll, s] = nextRandom(s);
  if (optRoll > 0.8 && !blindType.needsFitter) options.push('motorised');
  [optRoll, s] = nextRandom(s);
  if (optRoll > 0.7) options.push('blackout');
  [optRoll, s] = nextRandom(s);
  if (optRoll > 0.75) options.push('childSafe');

  return { line: { blindTypeId: blindType.id, widthM: w, heightM: h, fabric, options, quantity: 1 }, seed: s };
}

export interface SpawnedOrder {
  order: Order;
  seed: number;
}

/** Build a complete order of a given tier. */
export function makeOrder(state: GameState, tier: CustomerTier, seed: number): SpawnedOrder {
  let s = seed;
  let lineCount = 1;
  let names = DOMESTIC_NAMES;
  let deadlineSpan = 96; // hours
  let latePenalty = 0;
  let priceMargin = 1.35; // payout vs cost+value markup

  if (tier === 'trade') {
    [lineCount, s] = randInt(s, 2, 4);
    names = TRADE_NAMES;
    deadlineSpan = 120;
    priceMargin = 1.2; // price-sensitive
  } else if (tier === 'commercial') {
    [lineCount, s] = randInt(s, 5, 10);
    names = COMMERCIAL_NAMES;
    deadlineSpan = 200;
    priceMargin = 1.5; // huge payout
    [latePenalty, s] = randRange(s, 200, 600);
  }

  let customerName: string;
  [customerName, s] = pick(s, names);

  const lines: OrderLine[] = [];
  for (let i = 0; i < lineCount; i++) {
    const built = buildLine(state, s);
    s = built.seed;
    lines.push(built.line);
  }

  // Payout derived from list value with a tier markup, blended with cost floor.
  let value = 0;
  let cost = 0;
  for (const line of lines) {
    const playerMult = state.pricing[line.blindTypeId] ?? 1;
    value += lineValue(line) * playerMult;
    cost += lineMaterialCost(line, state.priceMultipliers);
  }
  const payout = Math.round((value * 0.7 + (cost + value * 0.3) * priceMargin) / 2);

  let deadlineJitter: number;
  [deadlineJitter, s] = randRange(s, 0.8, 1.3);
  const fussiness =
    tier === 'commercial' ? 0.6 : tier === 'trade' ? 0.45 : 0.3;

  const order: Order = {
    id: nextOrderId(),
    customerName,
    tier,
    lines,
    payout,
    deadlineHour: Math.round(state.totalHours + deadlineSpan * deadlineJitter),
    createdHour: state.totalHours,
    latePenalty: Math.round(latePenalty),
    status: 'available',
    fussiness,
  };
  return { order, seed: s };
}

/**
 * Decide whether to spawn an order this tick and, if so, append it. Order arrival
 * rate scales with reputation, marketing upgrades, online store and events.
 */
export function maybeSpawnOrder(state: GameState): GameState {
  const mods = getModifiers(state);
  // Base: an order roughly every ~10 hours at low rep, faster as you grow.
  const repFactor = 1 + state.reputation / 40;
  const onlineFactor = mods.onlineStore ? 1.4 : 1;
  const ratePerHour = 0.1 * repFactor * mods.orderRate * onlineFactor;

  let s = state.rngSeed;
  let roll: boolean;
  [roll, s] = chance(s, Math.min(0.6, ratePerHour));

  // Cap the number of available orders so the board doesn't flood.
  const availableCount = state.orders.filter((o) => o.status === 'available').length;
  const cap = 6 + Math.floor(state.reputation / 12);

  if (!roll || availableCount >= cap) {
    return { ...state, rngSeed: s };
  }

  const tiers = availableTiers(state.reputation);
  let tier: CustomerTier;
  [tier, s] = pick(s, tiers);

  const spawned = makeOrder({ ...state, rngSeed: s }, tier, s);
  return {
    ...state,
    rngSeed: spawned.seed,
    orders: [...state.orders, spawned.order],
    lastOrderHour: state.totalHours,
  };
}

/** Expire available orders that are now past their deadline. */
export function expireOrders(state: GameState): GameState {
  let changed = false;
  const orders = state.orders.map((o) => {
    if (o.status === 'available' && state.totalHours > o.deadlineHour) {
      changed = true;
      return { ...o, status: 'expired' as const };
    }
    return o;
  });
  return changed ? { ...state, orders } : state;
}
