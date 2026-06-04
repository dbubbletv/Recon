# ♑ Capricorn Blinds — Manufacturing Simulator

A self-contained 2D tycoon game built with plain HTML5 Canvas + JavaScript (no
build step, no dependencies). Run the **Capricorn Blinds** factory: take orders,
cut fabric to size on the precision bench, assemble blinds, ship them out, and
grow the business — one window at a time.

## Play

Just open `index.html` in any modern browser:

```bash
# from the repo root
xdg-open index.html      # Linux
open index.html          # macOS
start index.html         # Windows
```

Or serve it locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## How to play

1. **Take an order** from the Orders panel (left). Each order needs a blind
   type, colour, width and quantity, and has a deadline in days.
2. **Stock fabric** of the matching colour from the **Shop** tab. Each blind
   built consumes one matching fabric roll.
3. **Cut & Build** at the bench. A blade sweeps across the ruler — click
   **CUT** (or press <kbd>Space</kbd>) when it lands inside the green target
   zone. Land in the bright core for a **PERFECT** cut: +25% pay and a
   reputation boost. Miss the zone and the fabric is wasted.
4. **Complete orders** before their deadline to get paid. Missed orders cost
   reputation.
5. **End the day** to advance time. You pay daily rent (which grows over time)
   and new orders arrive. Spend profits in the **Upgrades** tab to cut faster,
   slow the blade, earn more per blind, and unlock more order slots.
6. Keep cash above zero and reputation healthy. Go bankrupt or ruin your
   reputation and it's game over.

## Features

- Animated 2D factory floor: conveyor belt, workbench, shipping truck.
- Skill-based cutting mini-game with perfect-hit bonuses.
- Four blind types (Roller, Venetian, Vertical, Roman) and six fabric colours.
- Economy with rising rent, dynamic order pricing tied to reputation.
- Four upgrade tracks and an endless survival score (days, shipped, revenue).

## Project layout

| File         | Purpose                                            |
|--------------|----------------------------------------------------|
| `index.html` | Page structure and screens (title / game / over).  |
| `style.css`  | Theme, layout and UI styling.                      |
| `game.js`    | All game logic, state machine and canvas rendering.|

No external libraries are used.
