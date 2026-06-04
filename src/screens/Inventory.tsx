import { useGame } from '../store/gameStore';
import { Badge, Button, Card, ProgressBar } from '../components/ui';
import { gbp, metres } from '../game/util';
import { MATERIALS, MATERIALS_BY_ID } from '../data/materials';
import {
  currentUnitCost,
  storageCapacity,
  storageUsed,
} from '../game/systems/inventorySystem';
import { planCuts, batchingSaving } from '../game/cutting';
import { getModifiers } from '../game/modifiers';

// Inventory & Purchasing — buy stock in fixed-size units, watch storage fill up, and
// see the cutting/waste view that makes the batching mechanic legible.

const KIND_LABEL: Record<string, string> = {
  roll: 'roll',
  linear: 'bar',
  pack: 'pack',
  unit: 'each',
};

export function Inventory() {
  const state = useGame((s) => s.state);
  const buy = useGame((s) => s.buyMaterial);

  const used = storageUsed(state);
  const cap = storageCapacity(state);

  // Cutting view: what would be cut for all accepted + in-production work.
  const workOrders = state.orders.filter((o) => o.status === 'accepted' || o.status === 'in_production');
  const mods = getModifiers(state);
  const cut = planCuts(workOrders, mods.wasteFactor);
  const saving = batchingSaving(workOrders, mods.wasteFactor);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card title="Purchasing" subtitle="Stock arrives in fixed sizes — bulk is cheaper per unit but ties up cash & storage" className="xl:col-span-2">
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-xs text-slate-400">
            <span>Storage</span>
            <span className={used > cap * 0.9 ? 'text-amber-400' : ''}>
              {used.toFixed(1)} / {cap} units
            </span>
          </div>
          <ProgressBar value={cap > 0 ? used / cap : 0} tone={used > cap * 0.9 ? 'amber' : 'blue'} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-2">Material</th>
                <th className="px-2">In stock</th>
                <th className="px-2">Unit cost</th>
                <th className="px-2 text-right">Buy</th>
              </tr>
            </thead>
            <tbody>
              {MATERIALS.map((m) => {
                const have = state.inventory[m.id] ?? 0;
                const price = currentUnitCost(state, m.id);
                const spiked = (state.priceMultipliers[m.id] ?? 1) > 1;
                const sizeNote =
                  m.kind === 'roll' || m.kind === 'linear'
                    ? `${m.stockLength}m ${KIND_LABEL[m.kind]}`
                    : m.kind === 'pack'
                      ? `pack of ${m.packSize}`
                      : 'each';
                return (
                  <tr key={m.id} className="border-b border-slate-800/60">
                    <td className="py-2 pr-2">
                      <div className="font-medium text-slate-100">{m.name}</div>
                      <div className="text-xs text-slate-500">{sizeNote}</div>
                    </td>
                    <td className="px-2 tabular-nums text-slate-200">{have}</td>
                    <td className="px-2 tabular-nums">
                      <span className={spiked ? 'text-amber-400' : 'text-slate-300'}>{gbp(price)}</span>
                      {spiked && <span className="ml-1 text-xs text-amber-400">▲</span>}
                    </td>
                    <td className="px-2">
                      <div className="flex justify-end gap-1">
                        <Button tone="ghost" className="px-2 py-1 text-xs" onClick={() => buy(m.id, 1)}>
                          +1
                        </Button>
                        <Button tone="ghost" className="px-2 py-1 text-xs" onClick={() => buy(m.id, 5)}>
                          +5
                        </Button>
                        <Button tone="primary" className="px-2 py-1 text-xs" onClick={() => buy(m.id, 20)}>
                          Bulk 20
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Cutting & waste view" subtitle="Live plan for accepted work — batch similar widths to cut waste">
        {workOrders.length === 0 ? (
          <p className="text-sm text-slate-500">
            Accept some orders to see how their pieces nest into stock. Batching similar widths from the same
            stock minimises offcut waste — your main margin lever.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Stock units needed (batched)</span>
                <span className="font-semibold text-slate-100">{saving.batchedUnits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">If cut one order at a time</span>
                <span className="text-slate-300">{saving.separateUnits}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-slate-800 pt-1">
                <span className="text-emerald-400">Saved by batching</span>
                <span className="font-semibold text-emerald-400">{saving.unitsSaved} units</span>
              </div>
            </div>

            {cut.plans.map((plan) => {
              const mat = MATERIALS_BY_ID[plan.materialId];
              const efficiency = plan.stockMetres > 0 ? plan.usedMetres / plan.stockMetres : 0;
              return (
                <div key={plan.materialId} className="rounded-lg border border-slate-800 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-100">{mat?.name}</span>
                    <Badge tone={efficiency > 0.8 ? 'green' : efficiency > 0.6 ? 'amber' : 'rose'}>
                      {Math.round(efficiency * 100)}% used
                    </Badge>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={efficiency} tone={efficiency > 0.8 ? 'green' : 'amber'} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-slate-400">
                    <span>{plan.unitsUsed} × {plan.stockLength}m</span>
                    <span>used {metres(plan.usedMetres)}</span>
                    <span className="text-rose-300">waste {metres(plan.wasteMetres)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
