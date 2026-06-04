import { useEffect, useRef } from 'react';
import { useGame } from '../store/gameStore';

// Drives the tick loop. Speed controls ticks-per-second:
//   1× = 1 tick/sec, 2× = 2/sec, 3× = 4/sec. 0 = paused.
const TICKS_PER_SECOND: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 4 };

export function useGameLoop(): void {
  const speed = useGame((s) => s.state.speed);
  const gameOver = useGame((s) => s.state.gameOver);
  const tick = useGame((s) => s.tick);
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    if (speed === 0 || gameOver) return;
    const tps = TICKS_PER_SECOND[speed] ?? 1;
    const interval = 1000 / tps;
    const id = window.setInterval(() => tickRef.current(), interval);
    return () => window.clearInterval(id);
  }, [speed, gameOver]);
}
