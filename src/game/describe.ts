import type { Order, OrderLine } from './types';
import { BLIND_TYPES_BY_ID } from '../data/blindTypes';
import { FABRIC_GRADES_BY_ID } from '../data/materials';

// Human-readable descriptions of orders and lines for the UI.

export function describeLine(line: OrderLine): string {
  const def = BLIND_TYPES_BY_ID[line.blindTypeId];
  const grade = FABRIC_GRADES_BY_ID[line.fabric];
  const opts = line.options.length ? ` · ${line.options.map(optLabel).join(', ')}` : '';
  const qty = line.quantity > 1 ? `${line.quantity}× ` : '';
  return `${qty}${def?.name ?? line.blindTypeId} ${line.widthM.toFixed(2)}×${line.heightM.toFixed(2)}m · ${grade?.name}${opts}`;
}

export function optLabel(opt: string): string {
  switch (opt) {
    case 'motorised':
      return 'motorised';
    case 'blackout':
      return 'blackout';
    case 'childSafe':
      return 'child-safe';
    default:
      return opt;
  }
}

export function orderSummary(order: Order): string {
  const count = order.lines.reduce((n, l) => n + l.quantity, 0);
  return `${count} blind${count > 1 ? 's' : ''}`;
}

export function tierLabel(tier: Order['tier']): string {
  return tier === 'domestic' ? 'Domestic' : tier === 'trade' ? 'Trade' : 'Commercial';
}
