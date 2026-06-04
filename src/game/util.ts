// Small shared helpers.

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function gbp(value: number): string {
  const rounded = Math.round(value);
  return `£${rounded.toLocaleString('en-GB')}`;
}

export function gbpPrecise(value: number): string {
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function metres(value: number): string {
  return `${value.toFixed(2)} m`;
}

/** Format an absolute in-game hour as "Day N, HH:00". */
export function formatClock(totalHours: number): string {
  const day = Math.floor(totalHours / 24) + 1;
  const hour = Math.floor(totalHours % 24);
  return `Day ${day}, ${hour.toString().padStart(2, '0')}:00`;
}

export function hoursToDeadline(totalHours: number, deadlineHour: number): string {
  const remaining = deadlineHour - totalHours;
  if (remaining < 0) return 'overdue';
  if (remaining < 24) return `${Math.round(remaining)}h left`;
  return `${Math.round(remaining / 24)}d left`;
}
