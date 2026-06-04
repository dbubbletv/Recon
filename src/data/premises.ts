import type { PremisesTierDef } from '../game/types';

// Premises tiers — from a poky workshop to a regional operation with a showroom,
// a factory and a second site. More storage, more stations, more footfall, more rent.

export const PREMISES_TIERS: PremisesTierDef[] = [
  {
    id: 'workshop',
    name: 'Poky workshop',
    storage: 20,
    maxStations: 1,
    overhead: 12,
    hasShowroom: false,
    footfall: 0,
    cost: 0,
    unlockReputation: 0,
    blurb: 'One bench, a kettle and a roller shutter. The dream starts here.',
  },
  {
    id: 'unit',
    name: 'Trade unit + showroom',
    storage: 60,
    maxStations: 3,
    overhead: 45,
    hasShowroom: true,
    footfall: 4,
    cost: 3500,
    unlockReputation: 18,
    blurb: 'A proper unit with a small showroom. Walk-ins start arriving.',
  },
  {
    id: 'factory',
    name: 'Factory floor',
    storage: 160,
    maxStations: 6,
    overhead: 120,
    hasShowroom: true,
    footfall: 9,
    cost: 14000,
    unlockReputation: 45,
    blurb: 'Room to run several lines at once and stockpile material.',
  },
  {
    id: 'regional',
    name: 'Regional HQ + second site',
    storage: 400,
    maxStations: 10,
    overhead: 300,
    hasShowroom: true,
    footfall: 18,
    cost: 45000,
    unlockReputation: 70,
    blurb: 'Two sites, a flagship showroom and serious throughput.',
  },
];

export const PREMISES_BY_ID: Record<string, PremisesTierDef> = Object.fromEntries(
  PREMISES_TIERS.map((p) => [p.id, p]),
);
