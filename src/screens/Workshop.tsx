import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { Badge, Button, Card, EmptyState, ProgressBar } from '../components/ui';
import { gbp, hoursToDeadline } from '../game/util';
import { describeLine } from '../game/describe';
import { MATERIALS_BY_ID } from '../data/materials';
import { MACHINES_BY_ID } from '../data/machines';
import {
  freeStations,
  freeWorkers,
  jobSpeed,
  manualHoursForOrder,
  orderNeedsFitter,
  stationById,
  workerById,
} from '../game/systems/productionSystem';
import { shortfallsForOrder, shortfallCost } from '../game/systems/inventorySystem';
import type { Order } from '../game/types';

// Workshop — the production floor. Assign accepted orders to a station + worker,
// top up any missing stock, and watch jobs progress to completion.

export function Workshop() {
  const state = useGame((s) => s.state);
  const accepted = state.orders.filter((o) => o.status === 'accepted');
  const runningJobs = state.jobs;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card title="Ready to build" subtitle="Assign a station and worker to start cutting">
        {accepted.length === 0 ? (
          <EmptyState>No accepted orders. Accept work on the Orders screen first.</EmptyState>
        ) : (
          <div className="space-y-3">
            {accepted.map((o) => (
              <BuildPanel key={o.id} order={o} />
            ))}
          </div>
        )}
      </Card>

      <div className="space-y-4">
        <Card title="Jobs in progress">
          {runningJobs.length === 0 ? (
            <EmptyState>No active jobs.</EmptyState>
          ) : (
            <div className="space-y-3">
              {runningJobs.map((job) => {
                const order = state.orders.find((o) => o.id === job.orderId);
                const worker = workerById(state, job.workerId);
                const station = stationById(state, job.stationId);
                const pct = job.totalHours > 0 ? job.hoursDone / job.totalHours : 0;
                const speed = jobSpeed(state, job);
                const hoursLeft = Math.max(0, job.totalHours - job.hoursDone);
                const etaHours = speed > 0 ? Math.ceil(hoursLeft / speed) : Infinity;
                return (
                  <div key={job.id} className="rounded-lg border border-slate-800 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-100">{order?.customerName ?? 'Order'}</span>
                      {job.status === 'blocked' ? (
                        <Badge tone="rose">Blocked (machine broken)</Badge>
                      ) : (
                        <Badge tone="violet">{Math.round(pct * 100)}%</Badge>
                      )}
                    </div>
                    <div className="mt-2">
                      <ProgressBar value={pct} tone={job.status === 'blocked' ? 'amber' : 'blue'} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-slate-400">
                      <span>{station?.name}</span>
                      <span>{worker ? worker.name : 'unstaffed'}</span>
                      <span>{Number.isFinite(etaHours) ? `~${etaHours}h left` : 'stalled'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Workstations">
          <div className="space-y-2">
            {state.stations.map((st) => {
              const machine = MACHINES_BY_ID[st.machineId];
              const busy = state.jobs.some((j) => j.stationId === st.id);
              return (
                <div key={st.id} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium text-slate-100">{st.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{machine?.name}</span>
                  </div>
                  {st.broken ? (
                    <Badge tone="rose">Broken</Badge>
                  ) : busy ? (
                    <Badge tone="violet">Running</Badge>
                  ) : (
                    <Badge tone="green">Idle</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function BuildPanel({ order }: { order: Order }) {
  const state = useGame((s) => s.state);
  const start = useGame((s) => s.startProduction);
  const buyMaterial = useGame((s) => s.buyMaterial);

  const stations = freeStations(state);
  const workers = freeWorkers(state);
  const needsFitter = orderNeedsFitter(order);
  const eligibleWorkers = needsFitter ? workers.filter((w) => w.role === 'fitter') : workers;

  const [stationId, setStationId] = useState<string>(stations[0]?.id ?? '');
  const [workerId, setWorkerId] = useState<string>(eligibleWorkers[0]?.id ?? '');

  const shortfalls = shortfallsForOrder(state, order);
  const cost = shortfallCost(state, order);
  const manualHours = manualHoursForOrder(order);

  const buyAll = () => {
    for (const sf of shortfalls) buyMaterial(sf.materialId, sf.short);
  };

  const chosenStation = stationId || stations[0]?.id || '';
  const canStart = chosenStation && shortfalls.length === 0 && (!needsFitter || !!workerId);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex items-start justify-between">
        <span className="font-medium text-slate-100">{order.customerName}</span>
        <span className="text-xs text-slate-400">{hoursToDeadline(state.totalHours, order.deadlineHour)}</span>
      </div>
      <ul className="mt-1 space-y-0.5">
        {order.lines.map((l, i) => (
          <li key={i} className="text-xs text-slate-300">• {describeLine(l)}</li>
        ))}
      </ul>

      <div className="mt-2 text-xs text-slate-400">
        Approx {manualHours.toFixed(1)}h of work {needsFitter && <span className="text-amber-400">· needs a Fitter</span>}
      </div>

      {shortfalls.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-700/40 bg-amber-900/20 p-2">
          <div className="mb-1 text-xs font-medium text-amber-300">Missing stock — buy before building:</div>
          <ul className="space-y-0.5 text-xs text-amber-200/90">
            {shortfalls.map((sf) => (
              <li key={sf.materialId}>
                {MATERIALS_BY_ID[sf.materialId]?.name}: need {sf.needed}, have {sf.have} (−{sf.short})
              </li>
            ))}
          </ul>
          <Button tone="primary" className="mt-2" onClick={buyAll} disabled={cost > state.cash}>
            Buy needed stock ({gbp(cost)})
          </Button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-400">
          <div className="mb-1">Station</div>
          <select
            value={chosenStation}
            onChange={(e) => setStationId(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
          >
            {stations.length === 0 && <option value="">No free station</option>}
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-400">
          <div className="mb-1">Worker</div>
          <select
            value={workerId}
            onChange={(e) => setWorkerId(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-100"
          >
            <option value="">Unstaffed (slow)</option>
            {eligibleWorkers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} · {w.role} L{w.level}
              </option>
            ))}
          </select>
        </label>

        <Button
          tone="success"
          disabled={!canStart}
          onClick={() => start(order.id, chosenStation, workerId || null)}
          title={
            stations.length === 0
              ? 'No free station'
              : needsFitter && !workerId
                ? 'Assign a Fitter'
                : shortfalls.length > 0
                  ? 'Buy missing stock first'
                  : 'Start production'
          }
        >
          Start build
        </Button>
      </div>
    </div>
  );
}
