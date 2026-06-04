import type { MachineDef } from '../game/types';

// Machines — manual → semi-auto → automated. Faster + less waste + higher quality,
// at higher cost. Better machines also break down less.

export const MACHINES: MachineDef[] = [
  {
    id: 'manual_bench',
    name: 'Manual workbench',
    speed: 1,
    wasteFactor: 1,
    qualityBonus: 0,
    cost: 0,
    breakdownChance: 0.01,
    unlockReputation: 0,
    blurb: 'A bench, a tape measure and a steady hand. Where everyone starts.',
  },
  {
    id: 'semi_auto_cut',
    name: 'Semi-automatic cutter',
    speed: 1.5,
    wasteFactor: 0.82,
    qualityBonus: 0.05,
    cost: 1400,
    breakdownChance: 0.03,
    unlockReputation: 15,
    blurb: 'Guided cutting head. Faster, tidier cuts, a bit less offcut waste.',
  },
  {
    id: 'auto_cut',
    name: 'Automated cutting cell',
    speed: 2.3,
    wasteFactor: 0.62,
    qualityBonus: 0.1,
    cost: 5200,
    breakdownChance: 0.05,
    unlockReputation: 40,
    blurb: 'CNC cutting + optimised nesting. Minimal waste, factory throughput.',
  },
  {
    id: 'precision_cell',
    name: 'Precision finishing cell',
    speed: 3,
    wasteFactor: 0.5,
    qualityBonus: 0.18,
    cost: 12000,
    breakdownChance: 0.04,
    unlockReputation: 65,
    blurb: 'Top-tier line. Near-zero waste, exhibition-grade finish.',
  },
];

export const MACHINES_BY_ID: Record<string, MachineDef> = Object.fromEntries(
  MACHINES.map((m) => [m.id, m]),
);
