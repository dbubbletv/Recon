import type { GameState, UpgradeEffect } from './types';
import { UPGRADES_BY_ID } from '../data/upgrades';
import { MACHINES_BY_ID } from '../data/machines';

// Derived, aggregated modifiers from upgrades + machines + events. Pure helpers
// so systems and UI share one source of truth for "what bonuses are active".

export interface Modifiers {
  /** Multiplier on material waste (<1 = less waste). */
  wasteFactor: number;
  /** Multiplier on build speed (>1 = faster). */
  buildSpeed: number;
  /** Additive quality bonus. */
  qualityBonus: number;
  /** Multiplier on order arrival rate. */
  orderRate: number;
  /** Showroom conversion bonus (additive). */
  salesConversion: number;
  onlineStore: boolean;
}

function effectFor(id: string): UpgradeEffect | null {
  return UPGRADES_BY_ID[id]?.effect ?? null;
}

export function getModifiers(state: GameState): Modifiers {
  const mods: Modifiers = {
    wasteFactor: 1,
    buildSpeed: 1,
    qualityBonus: 0,
    orderRate: 1,
    salesConversion: 0,
    onlineStore: state.onlineStore,
  };

  for (const id of state.purchasedUpgrades) {
    const e = effectFor(id);
    if (!e) continue;
    switch (e.kind) {
      case 'wasteReduction':
        mods.wasteFactor *= 1 - e.amount;
        break;
      case 'buildSpeed':
        mods.buildSpeed *= 1 + e.amount;
        break;
      case 'qualityBonus':
        mods.qualityBonus += e.amount;
        break;
      case 'marketing':
        mods.orderRate *= 1 + e.orderRateBonus;
        break;
      case 'salesConversion':
        mods.salesConversion += e.amount;
        break;
      case 'onlineStore':
        mods.onlineStore = true;
        break;
    }
  }

  // Competitor events suppress the order rate while active.
  for (const eff of state.activeEffects) {
    if (eff.kind === 'competitor') mods.orderRate *= 0.6;
    if (eff.kind === 'seasonalDemand') mods.orderRate *= 1.35;
  }

  return mods;
}

/** Best (highest-speed) usable station's machine — the player's headline capability. */
export function bestMachine(state: GameState) {
  let best = MACHINES_BY_ID['manual_bench'];
  for (const station of state.stations) {
    const m = MACHINES_BY_ID[station.machineId];
    if (m && m.speed > best.speed) best = m;
  }
  return best;
}
