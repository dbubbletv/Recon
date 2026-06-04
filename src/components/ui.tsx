import type { ReactNode } from 'react';

// Small shared presentational primitives, kept deliberately plain.

export function Card({
  children,
  className = '',
  title,
  subtitle,
  right,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/60 ${className}`}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-100">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

type ButtonTone = 'primary' | 'ghost' | 'danger' | 'success';

const TONE_CLASSES: Record<ButtonTone, string> = {
  primary: 'bg-brand-600 hover:bg-brand-500 text-white',
  ghost: 'bg-slate-800 hover:bg-slate-700 text-slate-100',
  danger: 'bg-rose-600/90 hover:bg-rose-500 text-white',
  success: 'bg-emerald-600 hover:bg-emerald-500 text-white',
};

export function Button({
  children,
  onClick,
  tone = 'primary',
  disabled,
  className = '',
  title,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: ButtonTone;
  disabled?: boolean;
  className?: string;
  title?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = 'slate',
}: {
  children: ReactNode;
  tone?: 'slate' | 'blue' | 'green' | 'amber' | 'rose' | 'violet';
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-800 text-slate-300',
    blue: 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30',
    green: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
    amber: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
    rose: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30',
    violet: 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30',
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-slate-100">{value}</div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function ProgressBar({ value, tone = 'blue' }: { value: number; tone?: 'blue' | 'green' | 'amber' }) {
  const colors: Record<string, string> = {
    blue: 'bg-brand-500',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
      <div
        className={`h-full rounded-full transition-all ${colors[tone]}`}
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }}
      />
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-800 px-6 py-10 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}
