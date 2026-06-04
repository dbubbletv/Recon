import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { Badge, Button, Card, EmptyState } from '../components/ui';
import { gbp } from '../game/util';
import { BLIND_TYPES } from '../data/blindTypes';
import { MACHINES, MACHINES_BY_ID } from '../data/machines';
import { PREMISES_BY_ID, PREMISES_TIERS } from '../data/premises';
import { UPGRADES } from '../data/upgrades';
import type { GameState } from '../game/types';

// Upgrades & Premises — reinvest. Unlock product lines, buy/upgrade machines, repair
// breakdowns, move premises and purchase permanent upgrades.

export function Upgrades() {
  const state = useGame((s) => s.state);
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ProductLines />
      <Machines />
      <Premises />
      <UpgradeList />
      {state.stations.some((s) => s.broken) && <Repairs />}
    </div>
  );
}

function lockReason(state: GameState, rep: number, cost: number): string | null {
  if (state.reputation < rep) return `Reputation ${rep} required`;
  if (state.cash < cost) return 'Not enough cash';
  return null;
}

function ProductLines() {
  const state = useGame((s) => s.state);
  const unlock = useGame((s) => s.unlockBlindType);
  return (
    <Card title="Product lines" subtitle="Each new line opens up higher-value work">
      <div className="space-y-2">
        {BLIND_TYPES.map((b) => {
          const owned = state.unlockedBlindTypes.includes(b.id);
          const reason = lockReason(state, b.unlockReputation, b.unlockCost);
          return (
            <div key={b.id} className="rounded-lg border border-slate-800 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-100">{b.name}</span>
                  <Badge tone="slate">{b.tier}</Badge>
                </div>
                {owned ? (
                  <Badge tone="green">Unlocked</Badge>
                ) : (
                  <Button
                    tone="primary"
                    className="px-2 py-1 text-xs"
                    disabled={!!reason}
                    onClick={() => unlock(b.id)}
                    title={reason ?? 'Unlock'}
                  >
                    {gbp(b.unlockCost)}
                  </Button>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">{b.blurb}</p>
              {!owned && reason && <p className="mt-1 text-xs text-amber-400">{reason}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Machines() {
  const state = useGame((s) => s.state);
  const buyStation = useGame((s) => s.buyStation);
  const upgradeStation = useGame((s) => s.upgradeStation);
  const premises = PREMISES_BY_ID[state.premisesTierId];
  const atMaxStations = state.stations.length >= (premises?.maxStations ?? 1);
  const [targetStation, setTargetStation] = useState('');

  return (
    <Card title="Machines & stations" subtitle={`${state.stations.length}/${premises?.maxStations} stations in use`}>
      <div className="space-y-2">
        {MACHINES.map((m) => {
          const reason = lockReason(state, m.unlockReputation, m.cost);
          return (
            <div key={m.id} className="rounded-lg border border-slate-800 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-100">{m.name}</span>
                <span className="text-xs text-slate-400">{m.cost > 0 ? gbp(m.cost) : 'free'}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{m.blurb}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                <span>×{m.speed} speed</span>
                <span>{Math.round((1 - m.wasteFactor) * 100)}% less waste</span>
                <span>+{Math.round(m.qualityBonus * 100)}% quality</span>
              </div>
              {m.id !== 'manual_bench' && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    tone="primary"
                    className="px-2 py-1 text-xs"
                    disabled={!!reason || atMaxStations}
                    onClick={() => buyStation(m.id)}
                    title={atMaxStations ? 'No room — upgrade premises' : reason ?? 'Buy as a new station'}
                  >
                    New station
                  </Button>
                  <select
                    value={targetStation}
                    onChange={(e) => setTargetStation(e.target.value)}
                    className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100"
                  >
                    <option value="">Upgrade station…</option>
                    {state.stations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({MACHINES_BY_ID[s.machineId]?.name})
                      </option>
                    ))}
                  </select>
                  <Button
                    tone="ghost"
                    className="px-2 py-1 text-xs"
                    disabled={!!reason || !targetStation}
                    onClick={() => targetStation && upgradeStation(targetStation, m.id)}
                  >
                    Upgrade
                  </Button>
                </div>
              )}
              {reason && m.id !== 'manual_bench' && <p className="mt-1 text-xs text-amber-400">{reason}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Premises() {
  const state = useGame((s) => s.state);
  const buy = useGame((s) => s.buyPremises);
  const currentIndex = PREMISES_TIERS.findIndex((p) => p.id === state.premisesTierId);

  return (
    <Card title="Premises" subtitle="More storage, more stations, more footfall — more rent">
      <div className="space-y-2">
        {PREMISES_TIERS.map((p, i) => {
          const owned = i <= currentIndex;
          const reason = lockReason(state, p.unlockReputation, p.cost);
          return (
            <div key={p.id} className="rounded-lg border border-slate-800 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-100">{p.name}</span>
                {owned ? (
                  i === currentIndex ? (
                    <Badge tone="green">Current</Badge>
                  ) : (
                    <Badge tone="slate">Owned</Badge>
                  )
                ) : (
                  <Button
                    tone="primary"
                    className="px-2 py-1 text-xs"
                    disabled={!!reason || i !== currentIndex + 1}
                    onClick={() => buy(p.id)}
                    title={i !== currentIndex + 1 ? 'Upgrade tiers in order' : reason ?? 'Move in'}
                  >
                    {gbp(p.cost)}
                  </Button>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">{p.blurb}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-500">
                <span>{p.storage} storage</span>
                <span>{p.maxStations} stations</span>
                <span>{gbp(p.overhead)}/day</span>
                {p.hasShowroom && <span>showroom · {p.footfall} footfall</span>}
              </div>
              {!owned && reason && i === currentIndex + 1 && <p className="mt-1 text-xs text-amber-400">{reason}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function UpgradeList() {
  const state = useGame((s) => s.state);
  const buy = useGame((s) => s.buyUpgrade);
  return (
    <Card title="Upgrades" subtitle="One-off permanent improvements">
      <div className="space-y-2">
        {UPGRADES.map((u) => {
          const owned = state.purchasedUpgrades.includes(u.id);
          const reason = lockReason(state, u.unlockReputation, u.cost);
          return (
            <div key={u.id} className="rounded-lg border border-slate-800 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-100">{u.name}</span>
                {owned ? (
                  <Badge tone="green">Owned</Badge>
                ) : (
                  <Button
                    tone="primary"
                    className="px-2 py-1 text-xs"
                    disabled={!!reason}
                    onClick={() => buy(u.id)}
                    title={reason ?? 'Buy'}
                  >
                    {gbp(u.cost)}
                  </Button>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">{u.blurb}</p>
              {!owned && reason && <p className="mt-1 text-xs text-amber-400">{reason}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Repairs() {
  const state = useGame((s) => s.state);
  const repair = useGame((s) => s.repairStation);
  const broken = state.stations.filter((s) => s.broken);
  if (broken.length === 0) return <EmptyState>Nothing to repair.</EmptyState>;
  return (
    <Card title="Repairs needed" subtitle="Broken machines stall their jobs">
      <div className="space-y-2">
        {broken.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-rose-800/50 bg-rose-900/20 p-3">
            <span className="text-sm text-slate-100">{s.name} — {MACHINES_BY_ID[s.machineId]?.name}</span>
            <Button tone="danger" className="px-2 py-1 text-xs" disabled={state.cash < 150} onClick={() => repair(s.id)}>
              Repair · {gbp(150)}
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
