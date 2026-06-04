# Made to Measure

A single-player, browser-based **blind manufacturer & shop tycoon** simulator. You
start as a one-person operation in a poky workshop and grow into a regional
made-to-measure blind business. The hook is **craft + commerce**: every blind is
custom, cut from fixed-size stock, so the core puzzle is making the right product, on
time, with minimal waste, at a margin.

Built with **Vite + React + TypeScript + Tailwind + Zustand**. UK spelling and £
throughout.

## Quick start

```bash
npm install
npm run dev       # play locally at http://localhost:5173
npm run build     # production build to dist/
npm run test      # run the unit + loop tests
npm run lint      # type-check only
```

## How to play

1. **Orders** — accept domestic / trade / commercial jobs. Each blind has a size
   (W×H), fabric grade, options (motorised / blackout / child-safe), a deadline and a
   payout. The board shows an estimated margin so you can judge each job.
2. **Workshop** — buy any missing stock, then assign an accepted order to a station
   (and ideally a skilled worker) to start the build. Watch jobs progress in real time.
3. **Deliver** on time for cash + reputation. Rushing or low-skill staff risks a
   defect → the customer haggles and your reputation dips.
4. **Inventory & Purchasing** — stock arrives in fixed sizes (a 30 m roll, a 3 m bar,
   a pack). The **cutting & waste view** shows how pieces nest into stock; batching
   similar widths from the same stock minimises offcuts — your main margin lever.
5. **Reinvest** — unlock product lines, faster machines, staff, a showroom, a factory,
   an online store. Reputation gates clients, premises and machines.

The **Workshop** has a **List ↔ 3D Floor** toggle. The 3D floor is a live, orbitable
view (Three.js / react-three-fiber) that reads the same game state — a proper factory
interior with sky + windows, roof beams and hanging lights, and soft shadows:

- **Distinct machines per tier** — a manual bench with a tool board, a semi-auto cutter
  with a sliding cutting head that throws sparks, and enclosed CNC cells with moving
  gantries for the automated/precision lines.
- **Blinds take shape** on each running bench (roller sheets unrolling, venetian slats
  stacking, vertical vanes appearing), with a progress bar floating above.
- **Articulated staff** in role-coloured hard hats work at their bench; idle staff
  wander the break area. A material cart ferries stock to busy benches.
- **Stock shelving** fills with fabric rolls by inventory; a despatch pallet grows with
  lifetime output. **Day/night lighting** follows the in-game clock.
- **Camera presets** — Overview, Top-down, and Follow-job — plus orbit/zoom/pan.
- Click an idle bench to start the next ready order there.

The 3D scene is code-split and only loaded when you open it, so the rest of the app
stays light (main bundle ~71 kB gzipped).

The **speed control** (top right) runs the clock: pause / 1× / 2× / 3×. Progress
autosaves each in-game day (where `localStorage` is available).

## Architecture

The game is a **central immutable state object** mutated only through **pure systems**,
with React subscribing for rendering — logic stays testable and separate from the view.

```
src/
  data/            Content as data — recipes, materials, machines, premises, upgrades, events
    blindTypes.ts  Blind recipes (add a product = add a row)
    materials.ts   Materials/components + fabric grades
    machines.ts    Manual → semi-auto → automated cutting
    premises.ts    Workshop → unit → factory → regional HQ
    upgrades.ts    One-off permanent improvements
    events.ts      World-event templates
    names.ts       Flavour name pools
  game/
    types.ts       The GameState shape — single source of truth
    initialState.ts / goals.ts / persistence.ts
    recipes.ts     Size + options → materials, cost, value, build hours
    cutting.ts     1-D bin-packing for the cut/waste mechanic
    modifiers.ts   Aggregated bonuses from upgrades/machines/events
    rng.ts util.ts log.ts describe.ts
    tick.ts        The master tick (1 tick = 1 in-game hour)
    actions.ts     Player actions (pure state -> state)
    systems/       OrderSystem, ProductionSystem, InventorySystem,
                   EconomySystem, EventSystem — pure functions
  store/
    gameStore.ts   Zustand store wrapping the pure game
  hooks/useGameLoop.ts   setInterval tick driver (speed = ticks/sec)
  components/      TopBar, Sidebar, Toasts, shared UI primitives
  scene/Workshop3D.tsx   Live 3D workshop floor (Three.js / r3f), lazy-loaded
  screens/         Dashboard, Orders, Workshop, Inventory, Showroom, Staff, Upgrades, Reports
```

### Adding content

Everything balance-related lives in `src/data`. A new blind line is one row in
`blindTypes.ts` (materials + scaling rules + economy); a new material, machine,
premises tier, upgrade or event is one row in its respective file. No new code needed.

## Roadmap status

All build-plan phases are implemented:

- **Phase 0 — Setup:** Vite + React + TS, central state, tick loop with speed control, save/load.
- **Phase 1 — MVP:** full take-order → buy → produce → deliver → paid loop.
- **Phase 2 — Depth:** six blind types, inventory/purchasing, the cutting/waste mechanic, pricing, upgrades.
- **Phase 3 — People & place:** staff with skills + levelling, multi-station job queue, showroom footfall + upsell.
- **Phase 4 — Growth:** B2B contracts & tenders, online store, marketing, premises tiers, milestone goals.
- **Phase 5 — Polish:** world events, onboarding + help, autosave/manual slots, activity log, toasts, tests.

## Tests

`npm run test` covers the cutting/bin-packing maths, the recipe engine, and an
end-to-end loop test (accept → stock → produce → deliver → get paid).
