import { describe, expect, it } from 'vitest';
import { packPieces, planCuts, batchingSaving } from './cutting';
import type { Order } from './types';

// The cutting/waste mechanic is the main margin lever, so it gets the most coverage.

function rollerOrder(id: string, widths: number[]): Order {
  return {
    id,
    customerName: 'Test',
    tier: 'domestic',
    lines: widths.map((w) => ({
      blindTypeId: 'roller',
      widthM: w,
      heightM: 1,
      fabric: 'standard' as const,
      options: [],
      quantity: 1,
    })),
    payout: 100,
    deadlineHour: 100,
    createdHour: 0,
    latePenalty: 0,
    status: 'accepted',
    fussiness: 0.2,
  };
}

describe('packPieces (first-fit-decreasing bin packing)', () => {
  it('fits two 1.2m pieces into one 3m bar', () => {
    const { bins } = packPieces([1.2, 1.2], 3);
    expect(bins).toBe(1);
  });

  it('needs two bars for three 1.2m pieces', () => {
    const { bins } = packPieces([1.2, 1.2, 1.2], 3);
    expect(bins).toBe(2);
  });

  it('reports waste as stock minus used length', () => {
    const { bins, waste } = packPieces([1.2], 3);
    expect(bins).toBe(1);
    // ~1.8m waste (minus a tiny kerf).
    expect(waste).toBeGreaterThan(1.7);
    expect(waste).toBeLessThan(1.81);
  });

  it('counts an oversize piece as its own bin', () => {
    const { bins } = packPieces([3.5], 3);
    expect(bins).toBe(1);
  });

  it('packs many pieces tightly', () => {
    // Six 1.0m pieces into 3m bars → 2 bars exactly (kerf nudges it, allow 2-3).
    const { bins } = packPieces([1, 1, 1, 1, 1, 1], 3);
    expect(bins).toBeGreaterThanOrEqual(2);
    expect(bins).toBeLessThanOrEqual(3);
  });
});

describe('planCuts', () => {
  it('aggregates linear stock across an order’s lines', () => {
    const order = rollerOrder('o1', [1.2, 1.2]);
    const result = planCuts([order]);
    // tube + bottom_bar each: two 1.2m pieces → 1 bar each.
    expect(result.unitsByMaterial['tube']).toBe(1);
    expect(result.unitsByMaterial['bottom_bar']).toBe(1);
  });

  it('applies the waste factor to reported waste', () => {
    const order = rollerOrder('o1', [1.2]);
    const full = planCuts([order], 1);
    const half = planCuts([order], 0.5);
    expect(half.totalWasteMetres).toBeCloseTo(full.totalWasteMetres * 0.5, 5);
  });
});

describe('batchingSaving', () => {
  it('shows batching saves stock vs cutting orders separately', () => {
    // Two orders, each a single 1.2m roller. Separately: 2 bars; batched: 1 bar.
    const a = rollerOrder('a', [1.2]);
    const b = rollerOrder('b', [1.2]);
    const saving = batchingSaving([a, b]);
    expect(saving.separateUnits).toBeGreaterThan(saving.batchedUnits);
    expect(saving.unitsSaved).toBeGreaterThan(0);
  });
});
