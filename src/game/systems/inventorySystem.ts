import type { GameState, Order } from '../types';
import { MATERIALS_BY_ID } from '../../data/materials';
import { PREMISES_BY_ID } from '../../data/premises';
import { planCuts } from '../cutting';
import { needsForOrderLine } from '../recipes';
import { getModifiers } from '../modifiers';

// InventorySystem — purchasing stock, storage limits, and computing/consuming the
// material a job needs (with the cut-optimisation applied to linear/roll stock).

export function storageUsed(state: GameState): number {
  let used = 0;
  for (const [id, qty] of Object.entries(state.inventory)) {
    const mat = MATERIALS_BY_ID[id];
    if (mat) used += mat.bulk * qty;
  }
  return used;
}

export function storageCapacity(state: GameState): number {
  return PREMISES_BY_ID[state.premisesTierId]?.storage ?? 20;
}

export function currentUnitCost(state: GameState, materialId: string): number {
  const mat = MATERIALS_BY_ID[materialId];
  if (!mat) return 0;
  const mult = state.priceMultipliers[materialId] ?? 1;
  return mat.unitCost * mult;
}

export interface PurchaseResult {
  ok: boolean;
  reason?: string;
  state: GameState;
}

/** Buy `qty` purchasable units of a material, respecting cash and storage. */
export function buyMaterial(state: GameState, materialId: string, qty: number): PurchaseResult {
  const mat = MATERIALS_BY_ID[materialId];
  if (!mat || qty <= 0) return { ok: false, reason: 'Invalid material', state };

  const cost = currentUnitCost(state, materialId) * qty;
  if (cost > state.cash) return { ok: false, reason: 'Not enough cash', state };

  const addedBulk = mat.bulk * qty;
  if (storageUsed(state) + addedBulk > storageCapacity(state)) {
    return { ok: false, reason: 'Not enough storage', state };
  }

  return {
    ok: true,
    state: {
      ...state,
      cash: state.cash - cost,
      inventory: { ...state.inventory, [materialId]: (state.inventory[materialId] ?? 0) + qty },
      stats: { ...state.stats, totalMaterialCost: state.stats.totalMaterialCost + cost },
    },
  };
}

/**
 * The full set of purchasable units an order needs, accounting for cut optimisation
 * on linear/roll stock and waste factor from machines/upgrades.
 */
export function unitsRequiredForOrder(state: GameState, order: Order): Record<string, number> {
  const mods = getModifiers(state);
  const required: Record<string, number> = {};

  // Linear/roll stock via cut planning (batched within the order).
  const cut = planCuts([order], mods.wasteFactor);
  for (const [id, units] of Object.entries(cut.unitsByMaterial)) required[id] = units;

  // Unit/pack components straight from recipe.
  for (const line of order.lines) {
    for (const need of needsForOrderLine(line)) {
      const mat = MATERIALS_BY_ID[need.materialId];
      if (!mat || mat.kind === 'linear' || mat.kind === 'roll') continue;
      required[need.materialId] = (required[need.materialId] ?? 0) + need.units;
    }
  }
  return required;
}

export interface MaterialShortfall {
  materialId: string;
  needed: number;
  have: number;
  short: number;
}

export function shortfallsForOrder(state: GameState, order: Order): MaterialShortfall[] {
  const required = unitsRequiredForOrder(state, order);
  const out: MaterialShortfall[] = [];
  for (const [id, needed] of Object.entries(required)) {
    const have = state.inventory[id] ?? 0;
    if (have < needed) out.push({ materialId: id, needed, have, short: needed - have });
  }
  return out;
}

export function canFulfilOrder(state: GameState, order: Order): boolean {
  return shortfallsForOrder(state, order).length === 0;
}

/** Cost to top up any shortfall for an order (used by the "buy what's needed" button). */
export function shortfallCost(state: GameState, order: Order): number {
  return shortfallsForOrder(state, order).reduce(
    (sum, sf) => sum + currentUnitCost(state, sf.materialId) * sf.short,
    0,
  );
}

/** Consume the materials an order needs from inventory. Returns metres wasted. */
export function consumeForOrder(
  state: GameState,
  order: Order,
): { state: GameState; wasteMetres: number } {
  const required = unitsRequiredForOrder(state, order);
  const inventory = { ...state.inventory };
  for (const [id, units] of Object.entries(required)) {
    inventory[id] = Math.max(0, (inventory[id] ?? 0) - units);
  }
  const mods = getModifiers(state);
  const cut = planCuts([order], mods.wasteFactor);
  return {
    state: {
      ...state,
      inventory,
      stats: { ...state.stats, wasteMetres: state.stats.wasteMetres + cut.totalWasteMetres },
    },
    wasteMetres: cut.totalWasteMetres,
  };
}
