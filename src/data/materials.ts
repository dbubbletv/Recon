import type { MaterialDef, FabricGradeDef } from '../game/types';

// Materials & components. Stock arrives in fixed sizes — rolls, bars, packs, units.
// Cash-vs-stockpile and just-in-time-vs-bulk are real decisions, so bulk + cost matter.

export const MATERIALS: MaterialDef[] = [
  // --- Fabrics (rolls) ---
  {
    id: 'roller_fabric',
    name: 'Roller fabric roll',
    kind: 'roll',
    unitCost: 60,
    stockLength: 30, // 30 m roll, 1.8 m wide
    bulk: 4,
    blurb: '30 m × 1.8 m roll. Cut to the customer’s width; offcuts are waste.',
  },
  {
    id: 'roman_fabric',
    name: 'Roman face fabric roll',
    kind: 'roll',
    unitCost: 95,
    stockLength: 25,
    bulk: 4,
    blurb: 'Heavier decorative face fabric for Roman blinds.',
  },
  {
    id: 'roman_lining',
    name: 'Roman lining roll',
    kind: 'roll',
    unitCost: 40,
    stockLength: 30,
    bulk: 3,
    blurb: 'Backing lining — paired with face fabric on every Roman.',
  },
  {
    id: 'cellular_fabric',
    name: 'Cellular fabric roll',
    kind: 'roll',
    unitCost: 110,
    stockLength: 25,
    bulk: 4,
    blurb: 'Honeycomb thermal fabric. The energy-saving selling point.',
  },
  // --- Linear stock (bars, tubes, tracks, rails) ---
  {
    id: 'tube',
    name: 'Roller tube (3 m)',
    kind: 'linear',
    unitCost: 6,
    stockLength: 3,
    bulk: 1,
    blurb: 'Aluminium tube the fabric bonds to. Cut to width.',
  },
  {
    id: 'bottom_bar',
    name: 'Bottom bar (3 m)',
    kind: 'linear',
    unitCost: 8,
    stockLength: 3,
    bulk: 1,
    blurb: 'Weighted bottom bar. Cut to width.',
  },
  {
    id: 'headrail_track',
    name: 'Vertical headrail track (6 m)',
    kind: 'linear',
    unitCost: 18,
    stockLength: 6,
    bulk: 1,
    blurb: 'Track that the vertical louvre carriers run along.',
  },
  {
    id: 'venetian_rails',
    name: 'Venetian head/bottom rail (6 m)',
    kind: 'linear',
    unitCost: 16,
    stockLength: 6,
    bulk: 1,
    blurb: 'Paired head and bottom rails for Venetian blinds.',
  },
  {
    id: 'cellular_headrail',
    name: 'Cellular headrail (6 m)',
    kind: 'linear',
    unitCost: 14,
    stockLength: 6,
    bulk: 1,
    blurb: 'Slim headrail for cellular blinds.',
  },
  // --- Vanes / slats (counted per width or height) ---
  {
    id: 'louvre_vane',
    name: 'Louvre vane',
    kind: 'unit',
    unitCost: 1.2,
    bulk: 0.1,
    blurb: 'Fabric vertical vane. Count = width ÷ 89 mm spacing.',
  },
  {
    id: 'alu_slat',
    name: 'Aluminium 25 mm slat',
    kind: 'unit',
    unitCost: 0.35,
    bulk: 0.05,
    blurb: 'Slat for aluminium Venetians. Count = height ÷ spacing.',
  },
  {
    id: 'wood_slat',
    name: 'Basswood 50 mm slat',
    kind: 'unit',
    unitCost: 0.9,
    bulk: 0.08,
    blurb: 'Premium wooden slat. Count = height ÷ spacing.',
  },
  // --- Components (packs / units) ---
  {
    id: 'brackets',
    name: 'Bracket pair',
    kind: 'pack',
    unitCost: 1.5,
    packSize: 1,
    bulk: 0.1,
    blurb: 'Wall/ceiling fixing brackets. One pair per blind.',
  },
  {
    id: 'chain_control',
    name: 'Chain control',
    kind: 'unit',
    unitCost: 2,
    bulk: 0.1,
    blurb: 'Side-chain mechanism. One per non-motorised blind.',
  },
  {
    id: 'carriers',
    name: 'Vane carrier pack (10)',
    kind: 'pack',
    unitCost: 6,
    packSize: 10,
    bulk: 0.2,
    blurb: 'Carriers + weights for vertical vanes.',
  },
  {
    id: 'ladder_cord',
    name: 'Ladder + lift cord set',
    kind: 'unit',
    unitCost: 3.5,
    bulk: 0.1,
    blurb: 'Tilt ladder and lift cord for Venetians.',
  },
  {
    id: 'cloth_tape',
    name: 'Decorative cloth tape',
    kind: 'unit',
    unitCost: 4,
    bulk: 0.1,
    blurb: 'Cloth tapes for wooden Venetians — the premium look.',
  },
  {
    id: 'roman_kit',
    name: 'Roman rings + cords + battens',
    kind: 'unit',
    unitCost: 7,
    bulk: 0.15,
    blurb: 'Rings, cords and battens for a Roman blind.',
  },
  {
    id: 'motor',
    name: 'Tubular motor',
    kind: 'unit',
    unitCost: 45,
    bulk: 0.3,
    blurb: 'Motor + remote/hub for motorised blinds. Needs a Fitter.',
  },
  {
    id: 'blackout_layer',
    name: 'Blackout backing',
    kind: 'unit',
    unitCost: 8,
    bulk: 0.2,
    blurb: 'Adds a blackout layer when the option is selected.',
  },
  {
    id: 'childsafe_kit',
    name: 'Child-safe device',
    kind: 'unit',
    unitCost: 2.5,
    bulk: 0.05,
    blurb: 'Breakaway/cleat kit for child safety compliance.',
  },
];

export const MATERIALS_BY_ID: Record<string, MaterialDef> = Object.fromEntries(
  MATERIALS.map((m) => [m.id, m]),
);

export const FABRIC_GRADES: FabricGradeDef[] = [
  { id: 'standard', name: 'Standard', costMultiplier: 1, valueMultiplier: 1, fussiness: 0.2 },
  { id: 'premium', name: 'Premium', costMultiplier: 1.6, valueMultiplier: 1.5, fussiness: 0.45 },
  { id: 'luxury', name: 'Luxury', costMultiplier: 2.6, valueMultiplier: 2.3, fussiness: 0.7 },
];

export const FABRIC_GRADES_BY_ID: Record<string, FabricGradeDef> = Object.fromEntries(
  FABRIC_GRADES.map((f) => [f.id, f]),
);

/** Material ids that count as "fabric" (subject to fabric-grade cost/value multipliers). */
export const FABRIC_MATERIAL_IDS = new Set([
  'roller_fabric',
  'roman_fabric',
  'cellular_fabric',
  'louvre_vane',
  'wood_slat',
]);
