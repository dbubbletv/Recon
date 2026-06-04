import { useGame } from '../store/gameStore';
import { Badge, Button, Card, EmptyState } from '../components/ui';
import { gbp, hoursToDeadline } from '../game/util';
import { describeLine, orderSummary, tierLabel } from '../game/describe';
import { lineMaterialCost } from '../game/recipes';
import { shortfallCost } from '../game/systems/inventorySystem';
import type { Order } from '../game/types';

// Orders board — accept domestic/trade/commercial work. Shows an estimated margin so
// the player can judge each job before committing.

const TIER_TONE = { domestic: 'blue', trade: 'violet', commercial: 'amber' } as const;

export function Orders() {
  const state = useGame((s) => s.state);
  const accept = useGame((s) => s.acceptOrder);
  const decline = useGame((s) => s.declineOrder);

  const available = state.orders.filter((o) => o.status === 'available');
  const active = state.orders.filter((o) => o.status === 'accepted' || o.status === 'in_production');

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card title="Available orders" subtitle="Accept work, then build it in the Workshop">
        {available.length === 0 ? (
          <EmptyState>No orders right now. Press play and let footfall build — or invest in marketing.</EmptyState>
        ) : (
          <div className="space-y-3">
            {available.map((o) => (
              <OrderCard key={o.id} order={o} priceMultipliers={state.priceMultipliers}>
                <div className="flex gap-2">
                  <Button tone="success" onClick={() => accept(o.id)}>
                    Accept
                  </Button>
                  <Button tone="ghost" onClick={() => decline(o.id)}>
                    Decline
                  </Button>
                </div>
              </OrderCard>
            ))}
          </div>
        )}
      </Card>

      <Card title="Accepted & in production" subtitle="Build accepted orders from the Workshop">
        {active.length === 0 ? (
          <EmptyState>Nothing accepted yet.</EmptyState>
        ) : (
          <div className="space-y-3">
            {active.map((o) => (
              <OrderCard key={o.id} order={o} priceMultipliers={state.priceMultipliers}>
                <Badge tone={o.status === 'in_production' ? 'violet' : 'amber'}>
                  {o.status === 'in_production' ? 'In production' : 'Awaiting build'}
                </Badge>
              </OrderCard>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function OrderCard({
  order,
  priceMultipliers,
  children,
}: {
  order: Order;
  priceMultipliers: Record<string, number>;
  children: React.ReactNode;
}) {
  const state = useGame((s) => s.state);
  const matCost = order.lines.reduce((sum, l) => sum + lineMaterialCost(l, priceMultipliers), 0);
  const margin = order.payout - matCost;
  const marginPct = order.payout > 0 ? (margin / order.payout) * 100 : 0;
  const toBuy = order.status !== 'available' ? shortfallCost(state, order) : 0;
  const overdueSoon = order.deadlineHour - state.totalHours < 24;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-100">{order.customerName}</span>
            <Badge tone={TIER_TONE[order.tier]}>{tierLabel(order.tier)}</Badge>
          </div>
          <div className="text-xs text-slate-400">{orderSummary(order)}</div>
        </div>
        <div className="text-right">
          <div className="font-semibold text-emerald-400">{gbp(order.payout)}</div>
          <div className={`text-xs ${overdueSoon ? 'text-rose-400' : 'text-slate-500'}`}>
            {hoursToDeadline(state.totalHours, order.deadlineHour)}
          </div>
        </div>
      </div>

      <ul className="mt-2 space-y-0.5">
        {order.lines.map((l, i) => (
          <li key={i} className="text-xs text-slate-300">
            • {describeLine(l)}
          </li>
        ))}
      </ul>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
        <span>Materials ≈ {gbp(matCost)}</span>
        <span className={margin > 0 ? 'text-emerald-400' : 'text-rose-400'}>
          Margin ≈ {gbp(margin)} ({marginPct.toFixed(0)}%)
        </span>
        {order.latePenalty > 0 && <span className="text-amber-400">Late penalty {gbp(order.latePenalty)}</span>}
        {toBuy > 0 && <span className="text-blue-300">Stock to buy ≈ {gbp(toBuy)}</span>}
      </div>

      <div className="mt-3">{children}</div>
    </div>
  );
}
