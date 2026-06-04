import { useGame } from '../store/gameStore';
import { PREMISES_BY_ID } from '../data/premises';

// Left navigation. Badges flag things needing attention (available orders, idle
// accepted orders ready to build, broken machines).

export type ScreenId =
  | 'dashboard'
  | 'orders'
  | 'workshop'
  | 'inventory'
  | 'showroom'
  | 'staff'
  | 'upgrades'
  | 'reports';

const NAV: { id: ScreenId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'orders', label: 'Orders', icon: '📋' },
  { id: 'workshop', label: 'Workshop', icon: '🛠️' },
  { id: 'inventory', label: 'Inventory', icon: '📦' },
  { id: 'showroom', label: 'Showroom', icon: '🏬' },
  { id: 'staff', label: 'Staff', icon: '👷' },
  { id: 'upgrades', label: 'Upgrades', icon: '⬆️' },
  { id: 'reports', label: 'Reports', icon: '📈' },
];

export function Sidebar({ active, onNavigate }: { active: ScreenId; onNavigate: (id: ScreenId) => void }) {
  const state = useGame((s) => s.state);

  const counts: Partial<Record<ScreenId, number>> = {
    orders: state.orders.filter((o) => o.status === 'available').length,
    workshop:
      state.orders.filter((o) => o.status === 'accepted').length +
      state.stations.filter((s) => s.broken).length,
  };

  const showShowroom = PREMISES_BY_ID[state.premisesTierId]?.hasShowroom;

  return (
    <nav className="flex w-44 flex-shrink-0 flex-col gap-0.5 border-r border-slate-800 bg-slate-900/40 p-2">
      {NAV.filter((n) => n.id !== 'showroom' || showShowroom).map((n) => {
        const isActive = active === n.id;
        const count = counts[n.id] ?? 0;
        return (
          <button
            key={n.id}
            onClick={() => onNavigate(n.id)}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? 'bg-brand-600/20 text-brand-50 ring-1 ring-brand-600/40' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span className="text-base">{n.icon}</span>
            <span>{n.label}</span>
            {count > 0 && (
              <span className="ml-auto rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-slate-900">
                {count}
              </span>
            )}
          </button>
        );
      })}
      <div className="mt-auto px-3 py-2 text-[11px] leading-tight text-slate-600">
        {PREMISES_BY_ID[state.premisesTierId]?.name}
      </div>
    </nav>
  );
}
