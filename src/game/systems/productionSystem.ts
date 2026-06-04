import type { GameState, Job, Order, Staff, Station } from '../types';
import { BLIND_TYPES_BY_ID } from '../../data/blindTypes';
import { MACHINES_BY_ID } from '../../data/machines';
import { FABRIC_GRADES_BY_ID } from '../../data/materials';
import { buildHoursForLine } from '../recipes';
import { getModifiers } from '../modifiers';
import { canFulfilOrder, consumeForOrder } from './inventorySystem';
import { addLog } from '../log';
import { clamp } from '../util';
import { chance } from '../rng';

// ProductionSystem — the heart of the game. Start jobs (consuming material),
// advance them each tick by worker × machine speed, then QC → deliver → pay.

let jobCounter = 0;
function nextJobId(): string {
  jobCounter += 1;
  return `job_${Date.now().toString(36)}_${jobCounter}`;
}

export function stationById(state: GameState, id: string | null): Station | undefined {
  return id ? state.stations.find((s) => s.id === id) : undefined;
}

export function workerById(state: GameState, id: string | null): Staff | undefined {
  return id ? state.staff.find((s) => s.id === id) : undefined;
}

/** A station is free if no running/queued job references it. */
export function freeStations(state: GameState): Station[] {
  const busy = new Set(
    state.jobs.filter((j) => j.status === 'running' || j.status === 'queued').map((j) => j.stationId),
  );
  return state.stations.filter((s) => !busy.has(s.id) && !s.broken);
}

export function freeWorkers(state: GameState): Staff[] {
  return state.staff.filter(
    (s) => (s.role === 'cutter' || s.role === 'assembler' || s.role === 'fitter') && !s.assignedJobId,
  );
}

/** Total manual build-hours (speed 1) for an order — the work to be done. */
export function manualHoursForOrder(order: Order): number {
  let total = 0;
  for (const line of order.lines) {
    const def = BLIND_TYPES_BY_ID[line.blindTypeId];
    if (def) total += buildHoursForLine(def, line);
  }
  return total;
}

/** Does the order need a Fitter (motorised lines or commercial)? */
export function orderNeedsFitter(order: Order): boolean {
  if (order.lines.some((l) => l.options.includes('motorised'))) return true;
  return order.lines.some((l) => BLIND_TYPES_BY_ID[l.blindTypeId]?.needsFitter);
}

export interface StartResult {
  ok: boolean;
  reason?: string;
  state: GameState;
}

/** Start producing an accepted order at a station, optionally with a worker. */
export function startProduction(
  state: GameState,
  orderId: string,
  stationId: string,
  workerId: string | null,
): StartResult {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return { ok: false, reason: 'Order not found', state };
  if (order.status !== 'accepted') return { ok: false, reason: 'Order not accepted', state };

  const station = stationById(state, stationId);
  if (!station) return { ok: false, reason: 'No such station', state };
  if (station.broken) return { ok: false, reason: 'Station is broken', state };
  if (!freeStations(state).some((s) => s.id === stationId)) {
    return { ok: false, reason: 'Station is busy', state };
  }

  if (orderNeedsFitter(order)) {
    const fitterAssigned = workerById(state, workerId)?.role === 'fitter';
    const hasFitter = state.staff.some((s) => s.role === 'fitter');
    if (!hasFitter) return { ok: false, reason: 'This job needs a Fitter on staff', state };
    if (!fitterAssigned) return { ok: false, reason: 'Assign a Fitter to this motorised/commercial job', state };
  }

  if (!canFulfilOrder(state, order)) {
    return { ok: false, reason: 'Not enough materials in stock', state };
  }

  // Consume materials now (cut + waste applied).
  const consumed = consumeForOrder(state, order);
  let next = consumed.state;

  const job: Job = {
    id: nextJobId(),
    orderId,
    totalHours: manualHoursForOrder(order),
    hoursDone: 0,
    stationId,
    workerId,
    status: 'running',
    quality: 0,
    hasDefect: false,
    startedHour: state.totalHours,
  };

  next = {
    ...next,
    jobs: [...next.jobs, job],
    orders: next.orders.map((o) => (o.id === orderId ? { ...o, status: 'in_production' } : o)),
    staff: workerId
      ? next.staff.map((s) => (s.id === workerId ? { ...s, assignedJobId: job.id } : s))
      : next.staff,
  };

  next = addLog(next, `Started production: ${order.customerName} (${order.lines.length} blind${order.lines.length > 1 ? 's' : ''}).`, 'info');
  return { ok: true, state: next };
}

/** Effective hours of progress per tick for a job. */
export function jobSpeed(state: GameState, job: Job): number {
  const mods = getModifiers(state);
  const station = stationById(state, job.stationId);
  const machine = station ? MACHINES_BY_ID[station.machineId] : MACHINES_BY_ID['manual_bench'];
  const worker = workerById(state, job.workerId);
  // Worker factor: 0.6 with no worker, 0.5..1.5 with one by proficiency.
  const workerFactor = worker ? 0.5 + worker.proficiency : 0.6;
  return (machine?.speed ?? 1) * workerFactor * mods.buildSpeed;
}

function jobQuality(state: GameState, job: Job): number {
  const mods = getModifiers(state);
  const station = stationById(state, job.stationId);
  const machine = station ? MACHINES_BY_ID[station.machineId] : MACHINES_BY_ID['manual_bench'];
  const worker = workerById(state, job.workerId);
  const workerProf = worker ? worker.proficiency : 0.35;
  return clamp(0.45 + workerProf * 0.45 + (machine?.qualityBonus ?? 0) + mods.qualityBonus, 0, 1);
}

/** Advance all running jobs by one tick; complete + deliver finished ones. */
export function advanceJobs(state: GameState): GameState {
  let next = state;
  const completed: Job[] = [];

  const jobs = next.jobs.map((job) => {
    if (job.status !== 'running') return job;
    const station = stationById(next, job.stationId);
    if (station?.broken) return { ...job, status: 'blocked' as const };
    const speed = jobSpeed(next, job);
    const hoursDone = job.hoursDone + speed;
    if (hoursDone >= job.totalHours) {
      const finished: Job = { ...job, hoursDone: job.totalHours, status: 'done', quality: jobQuality(next, job) };
      completed.push(finished);
      return finished;
    }
    return { ...job, hoursDone };
  });
  next = { ...next, jobs };

  for (const job of completed) {
    next = deliverJob(next, job);
  }
  return next;
}

/** QC + deliver a finished job: roll defects, pay out, move reputation, grant XP. */
function deliverJob(state: GameState, job: Job): GameState {
  const order = state.orders.find((o) => o.id === job.orderId);
  if (!order) return state;

  // Defect/mismeasure roll: worse quality and fussier fabric/customer → higher risk.
  const avgFussiness =
    order.lines.reduce((s, l) => s + FABRIC_GRADES_BY_ID[l.fabric].fussiness, 0) /
    Math.max(1, order.lines.length);
  const skillFloor =
    order.lines.reduce((s, l) => s + (BLIND_TYPES_BY_ID[l.blindTypeId]?.skillFloor ?? 0), 0) /
    Math.max(1, order.lines.length);
  const defectChance = clamp(skillFloor + avgFussiness * 0.25 - job.quality, 0, 0.6);

  let s = state.rngSeed;
  let defect: boolean;
  [defect, s] = chance(s, defectChance);

  const late = state.totalHours > order.deadlineHour;
  let payout = order.payout;
  let repDelta = 0;
  const tierWeight = order.tier === 'commercial' ? 3 : order.tier === 'trade' ? 1.6 : 1;

  if (late) {
    payout -= order.latePenalty;
    repDelta -= 2 * tierWeight;
  } else {
    repDelta += (1 + job.quality) * tierWeight;
  }

  let remakes = state.stats.remakes;
  if (defect) {
    // Customer haggles; reputation suffers; counts as a remake.
    payout = Math.round(payout * 0.82);
    repDelta -= 2.5 * tierWeight;
    remakes += 1;
  }

  // Premium fabric, well delivered, delights the customer a touch more.
  if (!defect && !late && avgFussiness > 0.4) repDelta += 0.5 * tierWeight;

  payout = Math.max(0, Math.round(payout));
  const newRep = clamp(state.reputation + repDelta, 0, 100);

  // Worker XP / levelling.
  const staff = state.staff.map((st) => {
    if (st.id !== job.workerId) return st;
    const xp = st.xp + Math.round(job.totalHours * 4);
    let level = st.level;
    let nextXp = xp;
    const threshold = level * 120;
    if (xp >= threshold && level < 5) {
      level += 1;
      nextXp = xp - threshold;
    }
    return { ...st, xp: nextXp, level, proficiency: proficiencyFor(st.role, level), assignedJobId: null };
  });

  const blinds = order.lines.reduce((n, l) => n + l.quantity, 0);

  let next: GameState = {
    ...state,
    rngSeed: s,
    cash: state.cash + payout,
    reputation: newRep,
    staff,
    orders: state.orders.map((o) => (o.id === order.id ? { ...o, status: 'delivered' as const } : o)),
    jobs: state.jobs.filter((j) => j.id !== job.id),
    stats: {
      ...state.stats,
      totalRevenue: state.stats.totalRevenue + payout,
      ordersDelivered: state.stats.ordersDelivered + 1,
      blindsMade: state.stats.blindsMade + blinds,
      remakes,
    },
  };

  const tone = defect ? 'warn' : late ? 'bad' : 'good';
  const note = defect ? ' (a defect slipped through — customer haggled)' : late ? ' (late — penalty applied)' : '';
  next = addLog(next, `Delivered ${order.customerName}: +£${payout}${note}. Reputation ${repDelta >= 0 ? '+' : ''}${repDelta.toFixed(1)}.`, tone);
  return next;
}

export function proficiencyFor(role: Staff['role'], level: number): number {
  // 0..1 proficiency: levels 1..5 map to ~0.3..0.95, with role nuance.
  const base = 0.25 + (level - 1) * 0.16;
  const roleBonus = role === 'fitter' ? 0.05 : 0;
  return clamp(base + roleBonus, 0, 1);
}
