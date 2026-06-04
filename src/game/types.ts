// Core domain types for Made to Measure.
// Everything the game knows about lives in GameState — the single source of truth.

export type MaterialKind = 'roll' | 'linear' | 'pack' | 'unit';

/** A purchasable material/component. Stock arrives in fixed sizes. */
export interface MaterialDef {
  id: string;
  name: string;
  kind: MaterialKind;
  /** Price per purchasable unit (a roll, a bar, a pack, a single item). */
  unitCost: number;
  /** For 'roll'/'linear' stock, the length (in metres) a single unit provides. */
  stockLength?: number;
  /** For 'pack', how many pieces a pack contains. */
  packSize?: number;
  /** Storage space one purchased unit consumes. */
  bulk: number;
  /** Short description for tooltips/UI. */
  blurb: string;
}

/** How much of a material a recipe consumes, and how it scales with blind size. */
export type RequirementScaling =
  | { type: 'fixed'; qty: number } // qty pieces regardless of size
  | { type: 'perWidth' } // metres = width
  | { type: 'perHeight' } // metres = height
  | { type: 'perArea' } // m² = width * height
  | { type: 'countPerWidth'; spacingMm: number } // e.g. vertical vanes
  | { type: 'countPerHeight'; spacingMm: number }; // e.g. venetian slats

export interface RecipeRequirement {
  materialId: string;
  scaling: RequirementScaling;
  /** Optional: only required when this option is selected on the order. */
  requiresOption?: BlindOption;
}

export type BlindTier = 'starter' | 'early' | 'mid' | 'premium';

/** A blind product line. Adding a product = adding one of these (data, not code). */
export interface BlindTypeDef {
  id: string;
  name: string;
  tier: BlindTier;
  /** Materials + scaling rules. */
  requirements: RecipeRequirement[];
  /** Base hours to build a 1m x 1m blind on a manual station. */
  baseBuildHours: number;
  /** Extra hours scaling with area (m²). */
  hoursPerSqm: number;
  /** Skill required to avoid defects; higher = fussier. 0..1 */
  skillFloor: number;
  /** Base sale value for a 1m x 1m blind (before options/fabric premium). */
  baseValue: number;
  /** Value added per m². */
  valuePerSqm: number;
  /** The signature manufacturing step, shown in UI flavour. */
  notableStep: string;
  /** Reputation needed before this line can be unlocked/sold. */
  unlockReputation: number;
  /** One-off cost to unlock the product line. */
  unlockCost: number;
  /** Requires a Fitter on staff to produce (motorised/commercial). */
  needsFitter?: boolean;
  blurb: string;
}

export type BlindOption = 'motorised' | 'blackout' | 'childSafe';

export type FabricGrade = 'standard' | 'premium' | 'luxury';

export interface FabricGradeDef {
  id: FabricGrade;
  name: string;
  /** Multiplier on material cost for fabric/face materials. */
  costMultiplier: number;
  /** Multiplier on sale value. */
  valueMultiplier: number;
  /** Higher = customer is fussier (lower defect tolerance). */
  fussiness: number;
}

export type CustomerTier = 'domestic' | 'trade' | 'commercial';

/** A single blind line item within an order. */
export interface OrderLine {
  blindTypeId: string;
  widthM: number;
  heightM: number;
  fabric: FabricGrade;
  options: BlindOption[];
  quantity: number;
}

export type OrderStatus = 'available' | 'accepted' | 'in_production' | 'delivered' | 'expired' | 'failed';

export interface Order {
  id: string;
  customerName: string;
  tier: CustomerTier;
  lines: OrderLine[];
  /** Total agreed payout for the whole order. */
  payout: number;
  /** In-game hour (absolute) by which it must be delivered. */
  deadlineHour: number;
  /** When the order appeared (absolute hour). */
  createdHour: number;
  /** Penalty applied if delivered late (commercial). */
  latePenalty: number;
  status: OrderStatus;
  /** How patient the customer is about quality. 0..1, higher = fussier. */
  fussiness: number;
}

export type JobStatus = 'queued' | 'running' | 'awaiting_qc' | 'done' | 'blocked';

/** A production job: one order being manufactured at a station. */
export interface Job {
  id: string;
  orderId: string;
  /** Total build hours required (sum of all lines). */
  totalHours: number;
  /** Hours of work completed. */
  hoursDone: number;
  stationId: string | null;
  workerId: string | null;
  status: JobStatus;
  /** Quality score accrued during build, 0..1. */
  quality: number;
  /** Whether a defect/mismeasure was rolled (needs remake or causes rep hit). */
  hasDefect: boolean;
  startedHour: number | null;
}

export type StaffRole = 'cutter' | 'assembler' | 'fitter' | 'sales';

export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  /** Skill level 1..5. */
  level: number;
  /** Skill as a 0..1 proficiency derived from level + role. */
  proficiency: number;
  /** Daily wage. */
  wage: number;
  /** XP toward next level. */
  xp: number;
  /** Currently assigned job, if any. */
  assignedJobId: string | null;
}

export interface MachineDef {
  id: string;
  name: string;
  /** Speed multiplier applied to build time (>1 = faster). */
  speed: number;
  /** Waste multiplier (<1 = less waste). */
  wasteFactor: number;
  /** Quality bonus added to builds. */
  qualityBonus: number;
  cost: number;
  /** Chance per day of breaking down (0..1). */
  breakdownChance: number;
  /** Reputation required to buy. */
  unlockReputation: number;
  blurb: string;
}

/** An owned workstation in the workshop. */
export interface Station {
  id: string;
  machineId: string;
  name: string;
  /** Whether currently broken (needs repair). */
  broken: boolean;
}

export interface PremisesTierDef {
  id: string;
  name: string;
  /** Storage capacity (bulk units). */
  storage: number;
  /** Max workstations. */
  maxStations: number;
  /** Daily overhead (rent + utilities). */
  overhead: number;
  /** Whether a showroom is available at this tier. */
  hasShowroom: boolean;
  /** Walk-in footfall per day base. */
  footfall: number;
  cost: number;
  unlockReputation: number;
  blurb: string;
}

export interface UpgradeDef {
  id: string;
  name: string;
  cost: number;
  unlockReputation: number;
  /** Free-form effects resolved by the economy/production systems. */
  effect: UpgradeEffect;
  blurb: string;
}

export type UpgradeEffect =
  | { kind: 'wasteReduction'; amount: number }
  | { kind: 'buildSpeed'; amount: number }
  | { kind: 'qualityBonus'; amount: number }
  | { kind: 'marketing'; orderRateBonus: number }
  | { kind: 'salesConversion'; amount: number }
  | { kind: 'onlineStore' };

export type GameEventKind =
  | 'priceSpike'
  | 'breakdown'
  | 'rushOrder'
  | 'bulkTender'
  | 'badReview'
  | 'competitor'
  | 'seasonalDemand'
  | 'walkIn';

export interface ActiveEffect {
  id: string;
  kind: GameEventKind;
  label: string;
  /** Absolute hour the effect expires. */
  expiresHour: number;
  /** Optional data the systems read (e.g. material id, multiplier). */
  data?: Record<string, number | string>;
}

export interface LogEntry {
  hour: number;
  day: number;
  text: string;
  tone: 'info' | 'good' | 'bad' | 'warn';
}

export interface Inventory {
  [materialId: string]: number; // quantity of purchasable units in stock
}

export interface Stats {
  totalRevenue: number;
  totalMaterialCost: number;
  totalWageCost: number;
  totalOverhead: number;
  ordersDelivered: number;
  ordersFailed: number;
  blindsMade: number;
  wasteMetres: number;
  remakes: number;
}

export interface Goal {
  id: string;
  label: string;
  done: boolean;
}

export interface GameState {
  /** Schema version for save migrations. */
  version: number;
  cash: number;
  reputation: number; // 0..100
  day: number;
  hour: number; // 0..23 within a day
  totalHours: number; // absolute hours elapsed since start
  speed: 0 | 1 | 2 | 3; // 0 = paused
  inventory: Inventory;
  orders: Order[];
  jobs: Job[];
  staff: Staff[];
  stations: Station[];
  premisesTierId: string;
  unlockedBlindTypes: string[];
  purchasedUpgrades: string[];
  activeEffects: ActiveEffect[];
  /** Per-material price multiplier currently in effect (from events). */
  priceMultipliers: { [materialId: string]: number };
  log: LogEntry[];
  stats: Stats;
  goals: Goal[];
  /** Default prices the player sets per blind type (multiplier vs base). 1 = list. */
  pricing: { [blindTypeId: string]: number };
  /** Online store enabled. */
  onlineStore: boolean;
  /** Pseudo-random seed counter for deterministic-ish rolls. */
  rngSeed: number;
  /** Last hour an order was spawned. */
  lastOrderHour: number;
  gameOver: boolean;
}
