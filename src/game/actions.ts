import type { GameState, Staff, StaffRole } from './types';
import { BLIND_TYPES_BY_ID } from '../data/blindTypes';
import { MACHINES_BY_ID } from '../data/machines';
import { PREMISES_BY_ID, PREMISES_TIERS } from '../data/premises';
import { UPGRADES_BY_ID } from '../data/upgrades';
import { STAFF_FIRST, STAFF_LAST } from '../data/names';
import { proficiencyFor } from './systems/productionSystem';
import { addLog } from './log';
import { pick } from './rng';

// Player-driven actions. Each is a pure (state) => state transform; the store wraps
// them. They validate affordability/prerequisites and log the outcome.

export interface ActionResult {
  ok: boolean;
  reason?: string;
  state: GameState;
}

function fail(state: GameState, reason: string): ActionResult {
  return { ok: false, reason, state };
}

export function acceptOrder(state: GameState, orderId: string): ActionResult {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return fail(state, 'Order not found');
  if (order.status !== 'available') return fail(state, 'Order is no longer available');
  const next = {
    ...state,
    orders: state.orders.map((o) => (o.id === orderId ? { ...o, status: 'accepted' as const } : o)),
  };
  return { ok: true, state: addLog(next, `Accepted order from ${order.customerName}.`, 'info') };
}

export function declineOrder(state: GameState, orderId: string): ActionResult {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return fail(state, 'Order not found');
  return {
    ok: true,
    state: { ...state, orders: state.orders.filter((o) => o.id !== orderId) },
  };
}

export function unlockBlindType(state: GameState, blindTypeId: string): ActionResult {
  const def = BLIND_TYPES_BY_ID[blindTypeId];
  if (!def) return fail(state, 'Unknown product');
  if (state.unlockedBlindTypes.includes(blindTypeId)) return fail(state, 'Already unlocked');
  if (state.reputation < def.unlockReputation) return fail(state, `Needs reputation ${def.unlockReputation}`);
  if (state.cash < def.unlockCost) return fail(state, 'Not enough cash');
  const next: GameState = {
    ...state,
    cash: state.cash - def.unlockCost,
    unlockedBlindTypes: [...state.unlockedBlindTypes, blindTypeId],
    pricing: { ...state.pricing, [blindTypeId]: state.pricing[blindTypeId] ?? 1 },
  };
  return { ok: true, state: addLog(next, `Unlocked new product line: ${def.name}.`, 'good') };
}

const ROLE_WAGES: Record<StaffRole, number> = {
  cutter: 70,
  assembler: 65,
  fitter: 90,
  sales: 75,
};

const HIRE_COST: Record<StaffRole, number> = {
  cutter: 250,
  assembler: 220,
  fitter: 400,
  sales: 300,
};

let staffCounter = 0;
function staffId(): string {
  staffCounter += 1;
  return `staff_${Date.now().toString(36)}_${staffCounter}`;
}

export function hireStaff(state: GameState, role: StaffRole): ActionResult {
  const cost = HIRE_COST[role];
  if (state.cash < cost) return fail(state, 'Not enough cash to hire');

  let s = state.rngSeed;
  let first;
  let last;
  [first, s] = pick(s, STAFF_FIRST);
  [last, s] = pick(s, STAFF_LAST);

  const member: Staff = {
    id: staffId(),
    name: `${first} ${last}`,
    role,
    level: 1,
    proficiency: proficiencyFor(role, 1),
    wage: ROLE_WAGES[role],
    xp: 0,
    assignedJobId: null,
  };
  const next: GameState = {
    ...state,
    rngSeed: s,
    cash: state.cash - cost,
    staff: [...state.staff, member],
  };
  return { ok: true, state: addLog(next, `Hired ${member.name} as a ${role}.`, 'good') };
}

export function fireStaff(state: GameState, staffId: string): ActionResult {
  const member = state.staff.find((s) => s.id === staffId);
  if (!member) return fail(state, 'No such staff');
  if (member.assignedJobId) return fail(state, 'Cannot fire someone mid-job');
  const next: GameState = { ...state, staff: state.staff.filter((s) => s.id !== staffId) };
  return { ok: true, state: addLog(next, `Let ${member.name} go.`, 'info') };
}

/** Pay to train a staff member up a level (instant). */
export function trainStaff(state: GameState, staffId: string): ActionResult {
  const member = state.staff.find((s) => s.id === staffId);
  if (!member) return fail(state, 'No such staff');
  if (member.level >= 5) return fail(state, 'Already at max level');
  const cost = member.level * 200;
  if (state.cash < cost) return fail(state, 'Not enough cash to train');
  const level = member.level + 1;
  const next: GameState = {
    ...state,
    cash: state.cash - cost,
    staff: state.staff.map((s) =>
      s.id === staffId
        ? { ...s, level, proficiency: proficiencyFor(s.role, level), wage: s.wage + 10 }
        : s,
    ),
  };
  return { ok: true, state: addLog(next, `Trained ${member.name} to level ${level}.`, 'good') };
}

let stationCounter = 1;
function newStationId(): string {
  stationCounter += 1;
  return `station_${stationCounter}_${Date.now().toString(36)}`;
}

/** Buy a new workstation with the given machine (respecting premises max stations). */
export function buyStation(state: GameState, machineId: string): ActionResult {
  const machine = MACHINES_BY_ID[machineId];
  if (!machine) return fail(state, 'Unknown machine');
  if (state.reputation < machine.unlockReputation) return fail(state, `Needs reputation ${machine.unlockReputation}`);
  if (state.cash < machine.cost) return fail(state, 'Not enough cash');
  const maxStations = PREMISES_BY_ID[state.premisesTierId]?.maxStations ?? 1;
  if (state.stations.length >= maxStations) return fail(state, 'No room — upgrade premises for more stations');

  const count = state.stations.length + 1;
  const next: GameState = {
    ...state,
    cash: state.cash - machine.cost,
    stations: [
      ...state.stations,
      { id: newStationId(), machineId, name: `${machine.name.split(' ')[0]} ${count}`, broken: false },
    ],
  };
  return { ok: true, state: addLog(next, `Installed a ${machine.name} (Bench ${count}).`, 'good') };
}

/** Upgrade an existing station's machine. */
export function upgradeStation(state: GameState, stationId: string, machineId: string): ActionResult {
  const station = state.stations.find((s) => s.id === stationId);
  const machine = MACHINES_BY_ID[machineId];
  if (!station || !machine) return fail(state, 'Invalid station/machine');
  if (state.reputation < machine.unlockReputation) return fail(state, `Needs reputation ${machine.unlockReputation}`);
  if (state.cash < machine.cost) return fail(state, 'Not enough cash');
  const next: GameState = {
    ...state,
    cash: state.cash - machine.cost,
    stations: state.stations.map((s) => (s.id === stationId ? { ...s, machineId, broken: false } : s)),
  };
  return { ok: true, state: addLog(next, `Upgraded ${station.name} to a ${machine.name}.`, 'good') };
}

export function repairStation(state: GameState, stationId: string): ActionResult {
  const station = state.stations.find((s) => s.id === stationId);
  if (!station) return fail(state, 'No such station');
  if (!station.broken) return fail(state, 'Not broken');
  const cost = 150;
  if (state.cash < cost) return fail(state, 'Not enough cash to repair');
  const next: GameState = {
    ...state,
    cash: state.cash - cost,
    stations: state.stations.map((s) => (s.id === stationId ? { ...s, broken: false } : s)),
    // Un-block any jobs that were blocked on this station.
    jobs: state.jobs.map((j) => (j.stationId === stationId && j.status === 'blocked' ? { ...j, status: 'running' } : j)),
  };
  return { ok: true, state: addLog(next, `Repaired ${station.name} (−£${cost}).`, 'info') };
}

export function buyPremises(state: GameState, premisesId: string): ActionResult {
  const tier = PREMISES_BY_ID[premisesId];
  if (!tier) return fail(state, 'Unknown premises');
  const currentIndex = PREMISES_TIERS.findIndex((p) => p.id === state.premisesTierId);
  const targetIndex = PREMISES_TIERS.findIndex((p) => p.id === premisesId);
  if (targetIndex <= currentIndex) return fail(state, 'Already at or above this tier');
  if (state.reputation < tier.unlockReputation) return fail(state, `Needs reputation ${tier.unlockReputation}`);
  if (state.cash < tier.cost) return fail(state, 'Not enough cash');
  const next: GameState = { ...state, cash: state.cash - tier.cost, premisesTierId: premisesId };
  return { ok: true, state: addLog(next, `Moved into: ${tier.name}.`, 'good') };
}

export function buyUpgrade(state: GameState, upgradeId: string): ActionResult {
  const up = UPGRADES_BY_ID[upgradeId];
  if (!up) return fail(state, 'Unknown upgrade');
  if (state.purchasedUpgrades.includes(upgradeId)) return fail(state, 'Already purchased');
  if (state.reputation < up.unlockReputation) return fail(state, `Needs reputation ${up.unlockReputation}`);
  if (state.cash < up.cost) return fail(state, 'Not enough cash');
  const onlineStore = up.effect.kind === 'onlineStore' ? true : state.onlineStore;
  const next: GameState = {
    ...state,
    cash: state.cash - up.cost,
    purchasedUpgrades: [...state.purchasedUpgrades, upgradeId],
    onlineStore,
  };
  return { ok: true, state: addLog(next, `Purchased upgrade: ${up.name}.`, 'good') };
}

export function setPricing(state: GameState, blindTypeId: string, multiplier: number): ActionResult {
  const clamped = Math.max(0.7, Math.min(1.6, multiplier));
  return {
    ok: true,
    state: { ...state, pricing: { ...state.pricing, [blindTypeId]: clamped } },
  };
}
