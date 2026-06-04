import { describe, expect, it } from 'vitest';
import { needsForLine, lineValue, lineMaterialCost, buildHours, quantityFor } from './recipes';
import type { OrderLine } from './types';

const roller: OrderLine = {
  blindTypeId: 'roller',
  widthM: 1.2,
  heightM: 1.5,
  fabric: 'standard',
  options: [],
  quantity: 1,
};

describe('quantityFor', () => {
  it('scales vane count by width and spacing', () => {
    const q = quantityFor({ type: 'countPerWidth', spacingMm: 89 }, 1.78, 1);
    expect(q.pieces).toBe(20); // 1.78 / 0.089 = 20
  });

  it('scales linear stock by width', () => {
    const q = quantityFor({ type: 'perWidth' }, 1.2, 2);
    expect(q.metres).toBe(1.2);
  });
});

describe('needsForLine', () => {
  it('includes fabric, tube, bar and components for a roller', () => {
    const needs = needsForLine(roller);
    const ids = needs.map((n) => n.materialId);
    expect(ids).toContain('roller_fabric');
    expect(ids).toContain('tube');
    expect(ids).toContain('bottom_bar');
    expect(ids).toContain('brackets');
    expect(ids).toContain('chain_control');
  });

  it('adds a motor only when motorised', () => {
    const plain = needsForLine(roller).map((n) => n.materialId);
    expect(plain).not.toContain('motor');
    const motorised = needsForLine({ ...roller, options: ['motorised'] }).map((n) => n.materialId);
    expect(motorised).toContain('motor');
  });
});

describe('value & cost', () => {
  it('premium fabric raises both value and cost', () => {
    const stdValue = lineValue(roller);
    const premValue = lineValue({ ...roller, fabric: 'premium' });
    expect(premValue).toBeGreaterThan(stdValue);

    const stdCost = lineMaterialCost(roller);
    const premCost = lineMaterialCost({ ...roller, fabric: 'premium' });
    expect(premCost).toBeGreaterThan(stdCost);
  });

  it('price multipliers raise material cost', () => {
    const base = lineMaterialCost(roller);
    const spiked = lineMaterialCost(roller, { roller_fabric: 2 });
    expect(spiked).toBeGreaterThan(base);
  });

  it('build hours fall as station speed rises', () => {
    const slow = buildHours(roller, 1);
    const fast = buildHours(roller, 2);
    expect(fast).toBeLessThan(slow);
  });
});
