import type { Order, OrderLine } from './types';
import { BLIND_TYPES_BY_ID } from '../data/blindTypes';
import { MATERIALS_BY_ID } from '../data/materials';
import { quantityFor } from './recipes';

// The cutting/waste mechanic — the core optimisation puzzle.
//
// Linear & roll stock comes in fixed lengths (a 3 m bar, a 30 m roll). A blind
// needs a piece cut to the customer's size; the remainder is offcut/waste unless
// another piece fits in it. Batching orders of similar widths from the same stock
// minimises waste — that's the main margin lever.
//
// We model each stock material as a 1-D bin-packing problem (first-fit-decreasing),
// which rewards batching wide and narrow cuts intelligently.

export interface CutPlan {
  materialId: string;
  /** Lengths (m) we need to cut. */
  pieces: number[];
  /** Stock unit length (m). */
  stockLength: number;
  /** Number of stock units consumed. */
  unitsUsed: number;
  /** Total metres of usable cuts. */
  usedMetres: number;
  /** Total metres of stock consumed (unitsUsed * stockLength). */
  stockMetres: number;
  /** Wasted metres (stockMetres - usedMetres). */
  wasteMetres: number;
}

export interface BatchCutResult {
  plans: CutPlan[];
  totalWasteMetres: number;
  /** Stock units required per material id. */
  unitsByMaterial: Record<string, number>;
}

/**
 * First-fit-decreasing bin packing. Given piece lengths and a bin (stock) size,
 * returns how many bins are used and the wasted length. A small kerf accounts for
 * the saw blade width per cut.
 */
export function packPieces(pieces: number[], stockLength: number, kerf = 0.003): {
  bins: number;
  waste: number;
} {
  const usable = pieces.filter((p) => p > 0 && p <= stockLength);
  // Any piece longer than stock can't be cut from a single unit — clamp & count as a full unit.
  const oversize = pieces.filter((p) => p > stockLength).length;
  const sorted = [...usable].sort((a, b) => b - a);
  const remaining: number[] = [];
  for (const piece of sorted) {
    const size = piece + kerf;
    let placed = false;
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i] >= size) {
        remaining[i] -= size;
        placed = true;
        break;
      }
    }
    if (!placed) remaining.push(stockLength - size);
  }
  const bins = remaining.length + oversize;
  const used = usable.reduce((s, p) => s + p, 0);
  const waste = bins * stockLength - used;
  return { bins, waste: Math.max(0, waste) };
}

/**
 * Collect every linear/roll piece an order's lines require, grouped by material,
 * then pack each material's pieces into stock units. A waste-reduction factor
 * (from machines/upgrades) shrinks effective waste by improving nesting.
 */
export function planCuts(orders: Order[], wasteFactor = 1): BatchCutResult {
  const piecesByMaterial: Record<string, number[]> = {};

  const addLine = (line: OrderLine) => {
    const def = BLIND_TYPES_BY_ID[line.blindTypeId];
    if (!def) return;
    for (const req of def.requirements) {
      if (req.requiresOption && !line.options.includes(req.requiresOption)) continue;
      const mat = MATERIALS_BY_ID[req.materialId];
      if (!mat || (mat.kind !== 'linear' && mat.kind !== 'roll')) continue;
      const q = quantityFor(req.scaling, line.widthM, line.heightM);
      if (q.metres == null) continue;
      const list = (piecesByMaterial[req.materialId] ??= []);
      for (let i = 0; i < line.quantity; i++) list.push(q.metres);
    }
  };

  for (const order of orders) for (const line of order.lines) addLine(line);

  const plans: CutPlan[] = [];
  const unitsByMaterial: Record<string, number> = {};
  let totalWaste = 0;

  for (const [materialId, pieces] of Object.entries(piecesByMaterial)) {
    const mat = MATERIALS_BY_ID[materialId];
    const stockLength = mat.stockLength ?? 1;
    const { bins, waste } = packPieces(pieces, stockLength);
    const effectiveWaste = waste * wasteFactor;
    const used = pieces.reduce((s, p) => s + p, 0);
    plans.push({
      materialId,
      pieces,
      stockLength,
      unitsUsed: bins,
      usedMetres: used,
      stockMetres: bins * stockLength,
      wasteMetres: effectiveWaste,
    });
    unitsByMaterial[materialId] = bins;
    totalWaste += effectiveWaste;
  }

  return { plans, totalWasteMetres: totalWaste, unitsByMaterial };
}

/**
 * Compare batched vs one-at-a-time cutting to quantify the batching saving —
 * used by the Inventory/cutting view to teach the mechanic.
 */
export function batchingSaving(orders: Order[], wasteFactor = 1): {
  batchedUnits: number;
  separateUnits: number;
  unitsSaved: number;
} {
  const batched = planCuts(orders, wasteFactor);
  let separateUnits = 0;
  for (const order of orders) {
    const single = planCuts([order], wasteFactor);
    separateUnits += Object.values(single.unitsByMaterial).reduce((s, n) => s + n, 0);
  }
  const batchedUnits = Object.values(batched.unitsByMaterial).reduce((s, n) => s + n, 0);
  return { batchedUnits, separateUnits, unitsSaved: Math.max(0, separateUnits - batchedUnits) };
}
