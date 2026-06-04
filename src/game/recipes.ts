import type {
  BlindTypeDef,
  OrderLine,
  RecipeRequirement,
  RequirementScaling,
} from './types';
import { BLIND_TYPES_BY_ID } from '../data/blindTypes';
import { MATERIALS_BY_ID, FABRIC_GRADES_BY_ID, FABRIC_MATERIAL_IDS } from '../data/materials';

// Turns a blind type + size + options into concrete material requirements,
// material cost and sale value. This is the "recipe engine".

export interface MaterialNeed {
  materialId: string;
  /** Number of purchasable units required (rolls, bars, packs, pieces). */
  units: number;
  /** For linear/roll stock: linear metres of material actually consumed. */
  metres?: number;
  /** For unit/pack: number of pieces required. */
  pieces?: number;
}

const SPACING_DEFAULT_MM = 89;

/** How many pieces / metres a single requirement needs for one blind of this size. */
export function quantityFor(scaling: RequirementScaling, widthM: number, heightM: number): {
  metres?: number;
  pieces?: number;
} {
  switch (scaling.type) {
    case 'fixed':
      return { pieces: scaling.qty };
    case 'perWidth':
      return { metres: widthM };
    case 'perHeight':
      return { metres: heightM };
    case 'perArea':
      return { metres: widthM * heightM };
    case 'countPerWidth': {
      const spacing = (scaling.spacingMm || SPACING_DEFAULT_MM) / 1000;
      return { pieces: Math.max(1, Math.ceil(widthM / spacing)) };
    }
    case 'countPerHeight': {
      const spacing = (scaling.spacingMm || SPACING_DEFAULT_MM) / 1000;
      return { pieces: Math.max(1, Math.ceil(heightM / spacing)) };
    }
  }
}

function requirementApplies(req: RecipeRequirement, line: OrderLine): boolean {
  if (!req.requiresOption) return true;
  return line.options.includes(req.requiresOption);
}

/**
 * Material needs for a single line (qty 1). Linear/roll materials report metres;
 * unit/pack materials report pieces and the equivalent purchasable units.
 */
export function needsForLine(line: OrderLine): MaterialNeed[] {
  const def = BLIND_TYPES_BY_ID[line.blindTypeId];
  if (!def) return [];
  const needs: MaterialNeed[] = [];
  for (const req of def.requirements) {
    if (!requirementApplies(req, line)) continue;
    const mat = MATERIALS_BY_ID[req.materialId];
    if (!mat) continue;
    const q = quantityFor(req.scaling, line.widthM, line.heightM);
    if (q.metres != null) {
      // Linear/roll stock: track metres; units computed at the batch/cut level.
      needs.push({ materialId: req.materialId, metres: q.metres, units: 0 });
    } else if (q.pieces != null) {
      const packSize = mat.packSize ?? 1;
      const units = Math.ceil(q.pieces / packSize);
      needs.push({ materialId: req.materialId, pieces: q.pieces, units });
    }
  }
  return needs;
}

/** Aggregate per-line needs across quantity (without cut optimisation). */
export function needsForOrderLine(line: OrderLine): MaterialNeed[] {
  const single = needsForLine(line);
  return single.map((n) => ({
    materialId: n.materialId,
    units: n.units * line.quantity,
    metres: n.metres != null ? n.metres * line.quantity : undefined,
    pieces: n.pieces != null ? n.pieces * line.quantity : undefined,
  }));
}

/** Build hours for one blind of a given size on a manual station (multiplier 1). */
export function buildHoursForLine(def: BlindTypeDef, line: OrderLine): number {
  const area = line.widthM * line.heightM;
  const optionHours =
    (line.options.includes('motorised') ? 0.6 : 0) +
    (line.options.includes('blackout') ? 0.2 : 0);
  return (def.baseBuildHours + def.hoursPerSqm * area + optionHours) * line.quantity;
}

/** Total build hours for an order line at a given station speed. */
export function buildHours(line: OrderLine, speedMultiplier: number): number {
  const def = BLIND_TYPES_BY_ID[line.blindTypeId];
  if (!def) return 0;
  return buildHoursForLine(def, line) / Math.max(0.1, speedMultiplier);
}

/** Sale value of one line at list price (before player pricing multiplier). */
export function lineValue(line: OrderLine): number {
  const def = BLIND_TYPES_BY_ID[line.blindTypeId];
  if (!def) return 0;
  const grade = FABRIC_GRADES_BY_ID[line.fabric];
  const area = line.widthM * line.heightM;
  let value = (def.baseValue + def.valuePerSqm * area) * grade.valueMultiplier;
  if (line.options.includes('motorised')) value += 80;
  if (line.options.includes('blackout')) value += 18;
  if (line.options.includes('childSafe')) value += 6;
  return value * line.quantity;
}

/** Raw material cost of a line at current prices (no waste, no optimisation). */
export function lineMaterialCost(
  line: OrderLine,
  priceMultipliers: Record<string, number> = {},
): number {
  const grade = FABRIC_GRADES_BY_ID[line.fabric];
  let cost = 0;
  for (const need of needsForOrderLine(line)) {
    const mat = MATERIALS_BY_ID[need.materialId];
    if (!mat) continue;
    const priceMult = priceMultipliers[need.materialId] ?? 1;
    const fabricMult = FABRIC_MATERIAL_IDS.has(need.materialId) ? grade.costMultiplier : 1;
    if (need.metres != null) {
      // Approximate: cost per metre = unitCost / stockLength.
      const perMetre = mat.unitCost / (mat.stockLength ?? 1);
      cost += need.metres * perMetre * priceMult * fabricMult;
    } else {
      cost += need.units * mat.unitCost * priceMult * fabricMult;
    }
  }
  return cost;
}
