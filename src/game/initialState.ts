import type { GameState, Goal } from './types';
import { BLIND_TYPES } from '../data/blindTypes';

export const SAVE_VERSION = 1;

export const INITIAL_GOALS: Goal[] = [
  { id: 'first_delivery', label: 'Deliver your first order', done: false },
  { id: 'rep_15', label: 'Reach reputation 15 (unlock trade clients)', done: false },
  { id: 'hire_first', label: 'Hire your first member of staff', done: false },
  { id: 'second_line', label: 'Unlock a second product line', done: false },
  { id: 'showroom', label: 'Open a showroom (Trade unit premises)', done: false },
  { id: 'rep_30', label: 'Reach reputation 30 (unlock commercial tenders)', done: false },
  { id: 'cash_10k', label: 'Bank £10,000 cash', done: false },
  { id: 'all_lines', label: 'Unlock every product line', done: false },
  { id: 'factory', label: 'Move into a factory', done: false },
  { id: 'rep_70', label: 'Reach reputation 70 — a regional name', done: false },
];

export function createInitialState(): GameState {
  return {
    version: SAVE_VERSION,
    cash: 2000,
    reputation: 2,
    day: 1,
    hour: 9,
    totalHours: 9, // start at 09:00 on day 1
    speed: 0,
    inventory: {
      // A little starter stock so the very first order can go straight into production.
      roller_fabric: 1,
      tube: 2,
      bottom_bar: 2,
      brackets: 6,
      chain_control: 6,
    },
    orders: [],
    jobs: [],
    staff: [],
    stations: [{ id: 'station_1', machineId: 'manual_bench', name: 'Bench 1', broken: false }],
    premisesTierId: 'workshop',
    unlockedBlindTypes: ['roller'],
    purchasedUpgrades: [],
    activeEffects: [],
    priceMultipliers: {},
    log: [
      {
        hour: 9,
        day: 1,
        text: 'Welcome to Made to Measure. Press play, take an order, buy stock, and start cutting.',
        tone: 'info',
      },
    ],
    stats: {
      totalRevenue: 0,
      totalMaterialCost: 0,
      totalWageCost: 0,
      totalOverhead: 0,
      ordersDelivered: 0,
      ordersFailed: 0,
      blindsMade: 0,
      wasteMetres: 0,
      remakes: 0,
    },
    goals: INITIAL_GOALS.map((g) => ({ ...g })),
    pricing: Object.fromEntries(BLIND_TYPES.map((b) => [b.id, 1])),
    onlineStore: false,
    rngSeed: Math.floor(Math.random() * 2 ** 31),
    lastOrderHour: 0,
    gameOver: false,
  };
}
