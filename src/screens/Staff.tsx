import { useGame } from '../store/gameStore';
import { Badge, Button, Card, EmptyState, ProgressBar } from '../components/ui';
import { gbp } from '../game/util';
import type { StaffRole } from '../game/types';

// Staff — hire, train and manage your crew. Roles: Cutter (speed + less waste),
// Assembler (assembly speed), Fitter (motorised/commercial), Sales (showroom conversion).

const ROLES: { role: StaffRole; label: string; blurb: string; hire: number; wage: number }[] = [
  { role: 'cutter', label: 'Cutter', blurb: 'Faster cutting, tidier offcuts.', hire: 250, wage: 70 },
  { role: 'assembler', label: 'Assembler', blurb: 'Quicker assembly across all blinds.', hire: 220, wage: 65 },
  { role: 'fitter', label: 'Fitter', blurb: 'Required for motorised & commercial jobs.', hire: 400, wage: 90 },
  { role: 'sales', label: 'Sales', blurb: 'Converts showroom footfall, upsells.', hire: 300, wage: 75 },
];

const ROLE_TONE: Record<StaffRole, 'blue' | 'green' | 'amber' | 'violet'> = {
  cutter: 'blue',
  assembler: 'green',
  fitter: 'amber',
  sales: 'violet',
};

export function Staff() {
  const state = useGame((s) => s.state);
  const hire = useGame((s) => s.hireStaff);
  const fire = useGame((s) => s.fireStaff);
  const train = useGame((s) => s.trainStaff);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card title="Hire" subtitle="Wages are an ongoing daily overhead" className="lg:col-span-1">
        <div className="space-y-2">
          {ROLES.map((r) => (
            <div key={r.role} className="rounded-lg border border-slate-800 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge tone={ROLE_TONE[r.role]}>{r.label}</Badge>
                </div>
                <span className="text-xs text-slate-400">{gbp(r.wage)}/day</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{r.blurb}</p>
              <Button
                tone="primary"
                className="mt-2 w-full"
                disabled={state.cash < r.hire}
                onClick={() => hire(r.role)}
              >
                Hire · {gbp(r.hire)}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Your crew" subtitle={`${state.staff.length} on the books`} className="lg:col-span-2">
        {state.staff.length === 0 ? (
          <EmptyState>No staff yet. You’re doing every job by hand — hire to scale up.</EmptyState>
        ) : (
          <div className="space-y-2">
            {state.staff.map((s) => {
              const trainCost = s.level * 200;
              const xpThreshold = s.level * 120;
              const busy = !!s.assignedJobId;
              return (
                <div key={s.id} className="rounded-lg border border-slate-800 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-100">{s.name}</span>
                      <Badge tone={ROLE_TONE[s.role]}>{s.role}</Badge>
                      <span className="text-xs text-slate-500">Level {s.level}</span>
                      {busy && <Badge tone="violet">On a job</Badge>}
                    </div>
                    <span className="text-xs text-slate-400">{gbp(s.wage)}/day</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="mb-1 flex justify-between text-xs text-slate-500">
                        <span>Proficiency</span>
                        <span>{Math.round(s.proficiency * 100)}%</span>
                      </div>
                      <ProgressBar value={s.proficiency} tone="green" />
                      {s.level < 5 && (
                        <div className="mt-1 text-[11px] text-slate-500">
                          XP {s.xp}/{xpThreshold} to next level
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        tone="ghost"
                        className="px-2 py-1 text-xs"
                        disabled={s.level >= 5 || state.cash < trainCost}
                        onClick={() => train(s.id)}
                        title={s.level >= 5 ? 'Max level' : `Train to level ${s.level + 1}`}
                      >
                        {s.level >= 5 ? 'Maxed' : `Train ${gbp(trainCost)}`}
                      </Button>
                      <Button
                        tone="danger"
                        className="px-2 py-1 text-xs"
                        disabled={busy}
                        onClick={() => fire(s.id)}
                        title={busy ? 'Cannot fire mid-job' : 'Let go'}
                      >
                        Fire
                      </Button>
                    </div>
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
