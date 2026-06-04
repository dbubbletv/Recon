import { useEffect } from 'react';
import { useGame } from '../store/gameStore';

// Transient notifications surfaced from game-log events (auto-dismiss).

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} text={t.text} tone={t.tone} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  id,
  text,
  tone,
  onDismiss,
}: {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad' | 'warn';
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(id), 4200);
    return () => window.clearTimeout(timer);
  }, [id, onDismiss]);

  const tones: Record<string, string> = {
    info: 'border-slate-700 bg-slate-800',
    good: 'border-emerald-600/50 bg-emerald-900/60',
    bad: 'border-rose-600/50 bg-rose-900/60',
    warn: 'border-amber-600/50 bg-amber-900/50',
  };

  return (
    <div
      className={`pointer-events-auto animate-fade-in cursor-pointer rounded-lg border px-3 py-2 text-sm text-slate-100 shadow-lg ${tones[tone]}`}
      onClick={() => onDismiss(id)}
    >
      {text}
    </div>
  );
}
