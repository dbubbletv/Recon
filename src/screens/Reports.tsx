import { useGame } from '../store/gameStore';
import { Card, Stat } from '../components/ui';
import { gbp, metres } from '../game/util';

// Reports/Finances — lifetime totals and operational stats, plus a rough P&L.

export function Reports() {
  const state = useGame((s) => s.state);
  const s = state.stats;
  const grossProfit = s.totalRevenue - s.totalMaterialCost - s.totalWageCost - s.totalOverhead;
  const avgOrder = s.ordersDelivered > 0 ? s.totalRevenue / s.ordersDelivered : 0;
  const defectRate = s.blindsMade > 0 ? (s.remakes / s.blindsMade) * 100 : 0;

  const rows: [string, string][] = [
    ['Revenue', gbp(s.totalRevenue)],
    ['Material cost', `−${gbp(s.totalMaterialCost)}`],
    ['Wages', `−${gbp(s.totalWageCost)}`],
    ['Overhead', `−${gbp(s.totalOverhead)}`],
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card title="Profit & loss" subtitle="Lifetime, since you opened up" className="lg:col-span-1">
        <div className="space-y-1.5 text-sm">
          {rows.map(([label, val]) => (
            <div key={label} className="flex justify-between">
              <span className="text-slate-400">{label}</span>
              <span className="tabular-nums text-slate-200">{val}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-slate-800 pt-2 font-semibold">
            <span className="text-slate-300">Gross profit</span>
            <span className={grossProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{gbp(grossProfit)}</span>
          </div>
        </div>
      </Card>

      <Card title="Operations" className="lg:col-span-2">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Orders delivered" value={s.ordersDelivered} />
          <Stat label="Blinds made" value={s.blindsMade} />
          <Stat label="Avg order value" value={gbp(avgOrder)} />
          <Stat label="Material wasted" value={metres(s.wasteMetres)} hint="lower is better" />
          <Stat label="Remakes" value={s.remakes} hint={`${defectRate.toFixed(1)}% defect rate`} />
          <Stat label="Cash on hand" value={gbp(state.cash)} />
        </div>
      </Card>

      <Card title="Tips" className="lg:col-span-3">
        <ul className="grid grid-cols-1 gap-2 text-sm text-slate-300 sm:grid-cols-2">
          <li>• Batch orders with similar widths — the Inventory cutting view shows the stock you save.</li>
          <li>• Buy stock just before you build to avoid tying up cash and storage.</li>
          <li>• Skilled staff + better machines cut the defect/remake rate that dents reputation.</li>
          <li>• Commercial tenders pay big but punish late delivery — line up materials and stations first.</li>
          <li>• A Fitter is mandatory for motorised and commercial jobs.</li>
          <li>• Reputation gates clients, premises and machines — protect it by delivering on time.</li>
        </ul>
      </Card>
    </div>
  );
}
