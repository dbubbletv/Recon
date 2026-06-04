import { describe, expect, it } from 'vitest';
import { createInitialState } from './initialState';
import { tickOnce } from './tick';
import { acceptOrder } from './actions';
import { makeOrder } from './systems/orderSystem';
import { startProduction } from './systems/productionSystem';
import { buyMaterial } from './systems/inventorySystem';
import { chargeDailyCosts } from './systems/economySystem';

// End-to-end: prove the core loop — accept → stock → produce → deliver → get paid.

describe('core game loop', () => {
  it('advances the clock one hour per tick', () => {
    const s0 = createInitialState();
    const s1 = tickOnce(s0);
    expect(s1.totalHours).toBe(s0.totalHours + 1);
  });

  it('can take an order from accept to delivered & paid', () => {
    let state = createInitialState();
    state = { ...state, cash: 5000 };

    // Spawn a deterministic domestic order.
    const { order } = makeOrder(state, 'domestic', 12345);
    state = { ...state, orders: [order] };

    // Accept it.
    const accepted = acceptOrder(state, order.id);
    expect(accepted.ok).toBe(true);
    state = accepted.state;

    // Buy plenty of every material the recipe might need.
    for (const id of [
      'roller_fabric', 'roman_fabric', 'roman_lining', 'cellular_fabric',
      'tube', 'bottom_bar', 'headrail_track', 'venetian_rails', 'cellular_headrail',
      'louvre_vane', 'alu_slat', 'wood_slat', 'brackets', 'chain_control',
      'carriers', 'ladder_cord', 'cloth_tape', 'roman_kit', 'motor',
      'blackout_layer', 'childsafe_kit',
    ]) {
      const r = buyMaterial(state, id, 50);
      if (r.ok) state = r.state;
    }

    // Start production on the only station (no worker → slow but valid for a roller).
    const start = startProduction(state, order.id, 'station_1', null);
    expect(start.ok).toBe(true);
    state = start.state;
    expect(state.jobs.length).toBe(1);

    const cashBefore = state.cash;

    // Tick until the job completes and the order is delivered.
    for (let i = 0; i < 500 && state.jobs.length > 0; i++) {
      state = tickOnce(state);
    }

    expect(state.jobs.length).toBe(0);
    const delivered = state.orders.find((o) => o.id === order.id);
    expect(delivered?.status).toBe('delivered');
    expect(state.cash).toBeGreaterThan(cashBefore);
    expect(state.stats.ordersDelivered).toBe(1);
  });

  it('charges wages and overhead on a new day', () => {
    let state = createInitialState();
    state = chargeDailyCosts(state);
    // No staff, just workshop overhead (£12).
    expect(state.cash).toBe(2000 - 12);
  });
});
