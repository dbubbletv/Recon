import type { GameEventKind } from '../game/types';

// Event templates. The EventSystem rolls one of these occasionally and applies
// a time-boxed effect (or an instant impact). Tuning lives here, logic in the system.

export interface EventTemplate {
  kind: GameEventKind;
  label: string;
  /** Relative weight when selecting an event. */
  weight: number;
  /** Minimum reputation before this event can occur. */
  minReputation: number;
  /** Duration in in-game hours for time-boxed effects (0 = instant). */
  durationHours: number;
  description: string;
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    kind: 'priceSpike',
    label: 'Material price spike',
    weight: 5,
    minReputation: 0,
    durationHours: 72,
    description: 'A supplier shortage has pushed up the price of a key material.',
  },
  {
    kind: 'breakdown',
    label: 'Machine breakdown',
    weight: 3,
    minReputation: 0,
    durationHours: 0,
    description: 'A workstation has broken down and needs repairing before it can run.',
  },
  {
    kind: 'rushOrder',
    label: 'Rush order',
    weight: 4,
    minReputation: 5,
    durationHours: 0,
    description: 'A customer needs a blind in a hurry — tight deadline, premium payout.',
  },
  {
    kind: 'bulkTender',
    label: 'Bulk tender',
    weight: 2,
    minReputation: 25,
    durationHours: 0,
    description: 'A commercial client has put a big multi-blind contract out to tender.',
  },
  {
    kind: 'badReview',
    label: 'Bad review',
    weight: 2,
    minReputation: 10,
    durationHours: 0,
    description: 'A disgruntled customer left a poor review. Reputation takes a knock.',
  },
  {
    kind: 'competitor',
    label: 'Competitor undercut',
    weight: 2,
    minReputation: 15,
    durationHours: 96,
    description: 'A rival is undercutting you locally — orders slow for a while.',
  },
  {
    kind: 'seasonalDemand',
    label: 'Seasonal demand',
    weight: 3,
    minReputation: 0,
    durationHours: 120,
    description: 'Seasonal swing — demand for thermal/blackout blinds is surging.',
  },
];
