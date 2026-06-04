import { useGame } from '../store/gameStore';
import { formatClock, gbp } from '../game/util';
import { dailyOverhead, dailyWages } from '../game/systems/economySystem';
import { canPersist } from '../game/persistence';

// Top status bar: cash, reputation, the clock, and the speed control (the tycoon pacing).

const SPEEDS: { label: string; value: 0 | 1 | 2 | 3 }[] = [
  { label: '⏸', value: 0 },
  { label: '1×', value: 1 },
  { label: '2×', value: 2 },
  { label: '3×', value: 3 },
];

export function TopBar() {
  const state = useGame((s) => s.state);
  const setSpeed = useGame((s) => s.setSpeed);
  const save = useGame((s) => s.save);

  const repColor =
    state.reputation >= 60 ? 'text-emerald-400' : state.reputation >= 25 ? 'text-blue-400' : 'text-slate-200';
  const cashColor = state.cash < 0 ? 'text-rose-400' : 'text-emerald-400';
  const dailyCost = dailyWages(state) + dailyOverhead(state);

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-slate-800 bg-slate-900/80 px-4 py-2.5 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="text-lg">🪟</span>
        <span className="font-semibold tracking-tight">Made to Measure</span>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wide text-slate-500">Cash</span>
        <span className={`text-base font-semibold tabular-nums ${cashColor}`}>{gbp(state.cash)}</span>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wide text-slate-500">Rep</span>
        <span className={`text-base font-semibold tabular-nums ${repColor}`}>{state.reputation.toFixed(0)}</span>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wide text-slate-500">Daily costs</span>
        <span className="text-sm font-medium tabular-nums text-slate-300">{gbp(dailyCost)}/day</span>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-xs uppercase tracking-wide text-slate-500">Clock</span>
        <span className="text-sm font-medium tabular-nums text-slate-200">{formatClock(state.totalHours)}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {canPersist && (
          <button
            onClick={() => save('manual')}
            className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            title="Save to the manual slot"
          >
            💾 Save
          </button>
        )}
        <div className="flex items-center overflow-hidden rounded-lg border border-slate-700">
          {SPEEDS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSpeed(s.value)}
              disabled={state.gameOver}
              className={`px-3 py-1 text-sm font-medium transition-colors disabled:opacity-40 ${
                state.speed === s.value ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
