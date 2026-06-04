import type { UpgradeDef } from '../game/types';

// Upgrades — one-off purchases with permanent effects, resolved by the systems.

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'sharp_blades',
    name: 'Tungsten cutting blades',
    cost: 450,
    unlockReputation: 5,
    effect: { kind: 'wasteReduction', amount: 0.08 },
    blurb: 'Cleaner cuts, fewer ruined offcuts. −8% material waste.',
  },
  {
    id: 'jigs',
    name: 'Assembly jigs',
    cost: 700,
    unlockReputation: 12,
    effect: { kind: 'buildSpeed', amount: 0.15 },
    blurb: 'Pre-set jigs speed assembly. +15% build speed.',
  },
  {
    id: 'qc_station',
    name: 'Dedicated QC station',
    cost: 900,
    unlockReputation: 18,
    effect: { kind: 'qualityBonus', amount: 0.1 },
    blurb: 'Catch defects before they ship. +10% finish quality.',
  },
  {
    id: 'local_ads',
    name: 'Local advertising',
    cost: 600,
    unlockReputation: 10,
    effect: { kind: 'marketing', orderRateBonus: 0.3 },
    blurb: 'Leaflets and local press. +30% order arrival rate.',
  },
  {
    id: 'sales_training',
    name: 'Sales training',
    cost: 800,
    unlockReputation: 20,
    effect: { kind: 'salesConversion', amount: 0.2 },
    blurb: 'Your sales team upsell harder. +20% showroom conversion.',
  },
  {
    id: 'cutting_optimiser',
    name: 'Cut-nesting software',
    cost: 1500,
    unlockReputation: 28,
    effect: { kind: 'wasteReduction', amount: 0.12 },
    blurb: 'Software nests cuts to minimise offcuts. −12% material waste.',
  },
  {
    id: 'online_store',
    name: 'Online store',
    cost: 2500,
    unlockReputation: 38,
    effect: { kind: 'onlineStore' },
    blurb: 'Sell made-to-measure online. Steady stream of extra orders.',
  },
];

export const UPGRADES_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
);
