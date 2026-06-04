import { create } from 'zustand';
import type { GameState, StaffRole } from '../game/types';
import { createInitialState } from '../game/initialState';
import { tickOnce } from '../game/tick';
import * as actions from '../game/actions';
import { startProduction } from '../game/systems/productionSystem';
import { buyMaterial } from '../game/systems/inventorySystem';
import { AUTOSAVE_SLOT, loadGame, saveGame } from '../game/persistence';

// Zustand store wrapping the pure game state + systems. The UI subscribes here;
// all mutations funnel through actions that return new immutable state.

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad' | 'warn';
}

interface GameStore {
  state: GameState;
  toasts: Toast[];
  // lifecycle
  newGame: () => void;
  load: (slot: string) => boolean;
  save: (slot: string) => boolean;
  tick: () => void;
  setSpeed: (speed: GameState['speed']) => void;
  // wrapped actions
  acceptOrder: (orderId: string) => void;
  declineOrder: (orderId: string) => void;
  buyMaterial: (materialId: string, qty: number) => void;
  startProduction: (orderId: string, stationId: string, workerId: string | null) => void;
  unlockBlindType: (id: string) => void;
  hireStaff: (role: StaffRole) => void;
  fireStaff: (id: string) => void;
  trainStaff: (id: string) => void;
  buyStation: (machineId: string) => void;
  upgradeStation: (stationId: string, machineId: string) => void;
  repairStation: (stationId: string) => void;
  buyPremises: (id: string) => void;
  buyUpgrade: (id: string) => void;
  setPricing: (blindTypeId: string, mult: number) => void;
  dismissToast: (id: number) => void;
}

let toastId = 0;

function initial(): GameState {
  const auto = loadGame(AUTOSAVE_SLOT);
  return auto ?? createInitialState();
}

export const useGame = create<GameStore>((set, get) => {
  // Helper that applies an action result and surfaces failures as toasts.
  function apply(result: { ok: boolean; reason?: string; state: GameState }) {
    if (!result.ok && result.reason) {
      toastId += 1;
      const toast: Toast = { id: toastId, text: result.reason, tone: 'warn' };
      set((s) => ({ toasts: [...s.toasts, toast] }));
      return;
    }
    set({ state: result.state });
  }

  return {
    state: initial(),
    toasts: [],

    newGame: () => set({ state: createInitialState() }),

    load: (slot) => {
      const loaded = loadGame(slot);
      if (loaded) {
        set({ state: { ...loaded, speed: 0 } });
        return true;
      }
      return false;
    },

    save: (slot) => saveGame(slot, get().state),

    tick: () => {
      const before = get().state;
      const after = tickOnce(before);
      // Autosave at the top of each new day.
      if (after.day !== before.day) saveGame(AUTOSAVE_SLOT, after);
      // New log entries become toasts (good/bad/warn only, to avoid spam).
      const newCount = after.log.length - before.log.length;
      if (newCount > 0) {
        const fresh = after.log.slice(0, newCount).filter((l) => l.tone !== 'info');
        if (fresh.length) {
          set((s) => ({
            toasts: [
              ...s.toasts,
              ...fresh.map((l) => {
                toastId += 1;
                return { id: toastId, text: l.text, tone: l.tone } as Toast;
              }),
            ].slice(-6),
          }));
        }
      }
      set({ state: after });
    },

    setSpeed: (speed) => set((s) => ({ state: { ...s.state, speed: s.state.gameOver ? 0 : speed } })),

    acceptOrder: (orderId) => apply(actions.acceptOrder(get().state, orderId)),
    declineOrder: (orderId) => apply(actions.declineOrder(get().state, orderId)),
    buyMaterial: (materialId, qty) => apply(buyMaterial(get().state, materialId, qty)),
    startProduction: (orderId, stationId, workerId) =>
      apply(startProduction(get().state, orderId, stationId, workerId)),
    unlockBlindType: (id) => apply(actions.unlockBlindType(get().state, id)),
    hireStaff: (role) => apply(actions.hireStaff(get().state, role)),
    fireStaff: (id) => apply(actions.fireStaff(get().state, id)),
    trainStaff: (id) => apply(actions.trainStaff(get().state, id)),
    buyStation: (machineId) => apply(actions.buyStation(get().state, machineId)),
    upgradeStation: (stationId, machineId) => apply(actions.upgradeStation(get().state, stationId, machineId)),
    repairStation: (stationId) => apply(actions.repairStation(get().state, stationId)),
    buyPremises: (id) => apply(actions.buyPremises(get().state, id)),
    buyUpgrade: (id) => apply(actions.buyUpgrade(get().state, id)),
    setPricing: (blindTypeId, mult) => apply(actions.setPricing(get().state, blindTypeId, mult)),
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  };
});
