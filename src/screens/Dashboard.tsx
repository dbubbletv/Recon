import { useGame } from '../store/gameStore';
import { Badge, Card, ProgressBar, Stat } from '../components/ui';
import { gbp } from '../game/util';
import { dailyOverhead, dailyWages } from '../game/systems/economySystem';
import type { ScreenId } from '../components/Sidebar';

// Dashboard — at-a-glance health: cash, reputation, alerts, goals and the live activity log.

export function Dashboard({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const state = useGame((s) => s.state);

  const available = state.orders.filter((o) => o.status === 'available').length;
  const accepted = state.orders.filter((o) => o.status === 'accepted').length;
  const inProduction = state.jobs.filter((j) => j.status === 'running').length;
  const broken = state.stations.filter((s) => s.broken).length;
  const goalsDone = state.goals.filter((g) => g.done).length;

  const alerts: { text: string; tone: 'amber' | 'rose' | 'blue'; go: ScreenId }[] = [];
  if (broken) alerts.push({ text: `${broken} machine${broken > 1 ? 's' : ''} broken — needs repair`, tone: 'rose', go: 'upgrades' });
  if (accepted) alerts.push({ text: `${accepted} accepted order${accepted > 1 ? 's' : ''} ready to start`, tone: 'amber', go: 'workshop' });
  if (available) alerts.push({ text: `${available} new order${available > 1 ? 's' : ''} on the board`, tone: 'blue', go: 'orders' });
  if (state.cash < 0) alerts.push({ text: 'Cash is negative — deliver work fast', tone: 'rose', go: 'orders' });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card title="Business health" className="lg:col-span-2">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Cash" value={<span className={state.cash < 0 ? 'text-rose-400' : ''}>{gbp(state.cash)}</span>} />
          <Stat label="Reputation" value={state.reputation.toFixed(0)} hint={repTier(state.reputation)} />
          <Stat label="Daily costs" value={gbp(dailyWages(state) + dailyOverhead(state))} hint={`${state.staff.length} staff`} />
          <Stat label="Delivered" value={state.stats.ordersDelivered} hint={`${state.stats.blindsMade} blinds`} />
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-slate-400">
            <span>Reputation progress</span>
            <span>{state.reputation.toFixed(0)} / 100</span>
          </div>
          <ProgressBar value={state.reputation / 100} tone="green" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <Badge tone="blue">{available} available</Badge>
          <Badge tone="amber">{accepted} accepted</Badge>
          <Badge tone="violet">{inProduction} in production</Badge>
        </div>
      </Card>

      <Card title="Alerts" subtitle="Things wanting your attention">
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500">All quiet. Press play and keep the orders flowing.</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a, i) => (
              <li key={i}>
                <button
                  onClick={() => onNavigate(a.go)}
                  className="flex w-full items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-left text-sm hover:bg-slate-800"
                >
                  <Badge tone={a.tone}>!</Badge>
                  <span className="text-slate-200">{a.text}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Milestones" subtitle={`${goalsDone} / ${state.goals.length} complete`} className="lg:col-span-1">
        <ul className="space-y-1.5">
          {state.goals.map((g) => (
            <li key={g.id} className="flex items-center gap-2 text-sm">
              <span className={g.done ? 'text-emerald-400' : 'text-slate-600'}>{g.done ? '✓' : '○'}</span>
              <span className={g.done ? 'text-slate-400 line-through' : 'text-slate-200'}>{g.label}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Activity log" className="lg:col-span-2">
        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {state.log.map((entry, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <span className="shrink-0 tabular-nums text-slate-600">
                D{entry.day} {entry.hour.toString().padStart(2, '0')}:00
              </span>
              <span className={logTone(entry.tone)}>{entry.text}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function repTier(rep: number): string {
  if (rep >= 70) return 'Regional name';
  if (rep >= 45) return 'Established';
  if (rep >= 30) return 'Trusted';
  if (rep >= 12) return 'Known locally';
  return 'New on the scene';
}

function logTone(tone: string): string {
  switch (tone) {
    case 'good':
      return 'text-emerald-300';
    case 'bad':
      return 'text-rose-300';
    case 'warn':
      return 'text-amber-300';
    default:
      return 'text-slate-300';
  }
}
