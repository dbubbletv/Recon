import { useGame } from '../store/gameStore';
import { Badge, Card, EmptyState, Stat } from '../components/ui';
import { BLIND_TYPES_BY_ID } from '../data/blindTypes';
import { PREMISES_BY_ID } from '../data/premises';
import { getModifiers } from '../game/modifiers';

// Showroom — set your pricing (a multiplier vs list), and see walk-in footfall and how
// well your sales team convert it. Higher prices = more margin but slower conversion.

export function Showroom() {
  const state = useGame((s) => s.state);
  const setPricing = useGame((s) => s.setPricing);

  const premises = PREMISES_BY_ID[state.premisesTierId];
  const salesStaff = state.staff.filter((s) => s.role === 'sales');
  const mods = getModifiers(state);
  const conversion = Math.min(0.9, salesStaff.reduce((s, st) => s + st.proficiency, 0) * 0.25 + mods.salesConversion);

  if (!premises?.hasShowroom) {
    return (
      <Card title="Showroom">
        <EmptyState>
          You don’t have a showroom yet. Move into a Trade unit (Upgrades & Premises) to display samples and
          start converting walk-in footfall.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card title="Showroom" subtitle="Walk-in footfall the Sales role converts" className="lg:col-span-1">
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Footfall" value={`${premises.footfall}/day`} />
          <Stat label="Sales staff" value={salesStaff.length} />
          <Stat label="Conversion" value={`${Math.round(conversion * 100)}%`} />
          <Stat label="Online store" value={state.onlineStore ? 'On' : 'Off'} />
        </div>
        {salesStaff.length === 0 && (
          <p className="mt-3 text-xs text-amber-300">
            Hire a Sales person (Staff screen) to convert footfall into orders.
          </p>
        )}
      </Card>

      <Card title="Pricing" subtitle="Multiplier on list price per product line" className="lg:col-span-2">
        <div className="space-y-3">
          {state.unlockedBlindTypes.map((id) => {
            const def = BLIND_TYPES_BY_ID[id];
            const mult = state.pricing[id] ?? 1;
            return (
              <div key={id} className="flex items-center gap-3">
                <div className="w-40 shrink-0">
                  <div className="text-sm font-medium text-slate-100">{def?.name}</div>
                  <div className="text-xs text-slate-500">list ×{mult.toFixed(2)}</div>
                </div>
                <input
                  type="range"
                  min={0.7}
                  max={1.6}
                  step={0.05}
                  value={mult}
                  onChange={(e) => setPricing(id, parseFloat(e.target.value))}
                  className="flex-1"
                />
                <Badge tone={mult > 1.15 ? 'amber' : mult < 0.9 ? 'blue' : 'green'}>
                  {mult > 1.15 ? 'Premium' : mult < 0.9 ? 'Budget' : 'Market'}
                </Badge>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Higher prices raise payouts but make customers fussier and rarer; lower prices win volume at thinner
          margins.
        </p>
      </Card>
    </div>
  );
}
