/* ============================================================
   Capricorn Blinds — Manufacturing Simulator
   A self-contained 2D tycoon game (HTML5 canvas + DOM UI).
   ============================================================ */
(function () {
  "use strict";

  /* ---------------- Data tables ---------------- */
  const COLORS = {
    white: { name: "White",     hex: "#f4f4f0" },
    beige: { name: "Beige",     hex: "#d9c4a3" },
    grey:  { name: "Slate Grey", hex: "#8a93a3" },
    navy:  { name: "Navy Blue", hex: "#2f4a8a" },
    forest:{ name: "Forest",    hex: "#2f7d52" },
    crimson:{ name: "Crimson",  hex: "#b23a4a" },
  };
  const COLOR_KEYS = Object.keys(COLORS);

  // Blind types: each has a base value and a build-difficulty (cut-zone scaling).
  const TYPES = {
    roller:   { name: "Roller Blind",   base: 22, difficulty: 1.0 },
    venetian: { name: "Venetian Blind", base: 30, difficulty: 0.82 },
    vertical: { name: "Vertical Blind", base: 36, difficulty: 0.7 },
    roman:    { name: "Roman Blind",    base: 46, difficulty: 0.6 },
  };
  const TYPE_KEYS = Object.keys(TYPES);

  const FABRIC_COST = 14;       // cost to buy one unit of fabric
  const DAILY_RENT_BASE = 60;   // base rent per day
  const START_CASH = 320;
  const BANKRUPT_LIMIT = -150;  // cash below this = game over

  /* ---------------- Game state ---------------- */
  let state = null;

  function newState() {
    return {
      cash: START_CASH,
      day: 1,
      reputation: 50,
      shipped: 0,
      revenue: 0,
      orders: [],
      inventory: { white: 4, beige: 3, grey: 2, navy: 0, forest: 0, crimson: 0 },
      activeOrderId: null,
      nextOrderId: 1,
      upgrades: {
        cutZone:   { level: 0, max: 5, cost: 120, name: "Laser Guide",
                     desc: "Widens the cut target zone for easier perfect cuts." },
        bladeSpeed:{ level: 0, max: 5, cost: 110, name: "Servo Brake",
                     desc: "Slows the blade sweep so you can time cuts better." },
        bonus:     { level: 0, max: 5, cost: 160, name: "Premium Finish",
                     desc: "Increases payout per blind shipped." },
        slots:     { level: 0, max: 3, cost: 200, name: "Sales Office",
                     desc: "Allows more simultaneous orders on the board." },
      },
      // production / cut mini-game
      building: false,
      cut: null,        // {pos, dir, speed, zoneStart, zoneEnd, target}
      blind: null,      // visual blind being built {color, width, progress}
      anim: { t: 0, ship: [] }, // shipping animation particles
      over: false,
    };
  }

  /* ---------------- Derived helpers ---------------- */
  function maxOrders() { return 3 + state.upgrades.slots.level; }
  function dailyRent() { return DAILY_RENT_BASE + (state.day - 1) * 8; }

  function cutZoneWidth() {
    // base 0.12 of track, +0.03 per upgrade level, scaled by type difficulty
    return 0.12 + state.upgrades.cutZone.level * 0.035;
  }
  function bladeSpeed() {
    return 0.024 - state.upgrades.bladeSpeed.level * 0.0028; // fraction of track per frame
  }
  function bonusMult() {
    return 1 + state.upgrades.bonus.level * 0.12;
  }

  function getActiveOrder() {
    return state.orders.find(o => o.id === state.activeOrderId) || null;
  }

  /* ---------------- Order generation ---------------- */
  function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  function makeOrder() {
    const typeKey = rand(TYPE_KEYS);
    const colorKey = rand(COLOR_KEYS);
    const type = TYPES[typeKey];
    const qty = randInt(2, 5);
    const width = randInt(60, 220); // cm — used as cut target
    const repBonus = Math.max(0, Math.floor((state.reputation - 50) / 20));
    const unitPay = Math.round(
      (type.base + width * 0.18 + randInt(0, 8)) * (1 + repBonus * 0.05)
    );
    return {
      id: state.nextOrderId++,
      typeKey, colorKey,
      typeName: type.name,
      colorName: COLORS[colorKey].name,
      colorHex: COLORS[colorKey].hex,
      width,
      qtyNeeded: qty,
      qtyDone: 0,
      pay: unitPay * qty,
      unitPay,
      deadline: randInt(2, 4), // days remaining
    };
  }

  function refillOrders() {
    const target = maxOrders();
    let guard = 0;
    while (state.orders.length < target && guard < 50) {
      state.orders.push(makeOrder());
      guard++;
    }
  }

  /* ---------------- Logging ---------------- */
  function log(msg, cls) {
    const el = document.getElementById("log");
    const line = document.createElement("div");
    line.className = "log-line" + (cls ? " " + cls : "");
    line.textContent = "Day " + state.day + " — " + msg;
    el.prepend(line);
    while (el.children.length > 40) el.removeChild(el.lastChild);
  }

  /* ---------------- Economy ---------------- */
  function addCash(n) {
    state.cash += n;
    if (n > 0) state.revenue += n;
  }

  function changeRep(n) {
    state.reputation = Math.max(0, Math.min(100, state.reputation + n));
  }

  /* ============================================================
     PRODUCTION & CUT MINI-GAME
     ============================================================ */
  function canBuildActive() {
    const o = getActiveOrder();
    if (!o) return false;
    if (state.building) return false;
    if (o.qtyDone >= o.qtyNeeded) return false;
    return state.inventory[o.colorKey] > 0;
  }

  function startBuild() {
    const o = getActiveOrder();
    if (!canBuildActive()) return;

    const diff = TYPES[o.typeKey].difficulty;
    const zoneW = Math.max(0.05, cutZoneWidth() * diff);
    const zoneStart = 0.15 + Math.random() * (0.85 - 0.15 - zoneW);

    state.building = true;
    state.blind = { color: o.colorHex, width: o.width, progress: 0 };
    state.cut = {
      pos: 0.02,
      dir: 1,
      speed: bladeSpeed(),
      zoneStart: zoneStart,
      zoneEnd: zoneStart + zoneW,
      done: false,
    };
    updateProductionUI();
  }

  function performCut() {
    if (!state.building || !state.cut || state.cut.done) return;
    const c = state.cut;
    const o = getActiveOrder();
    c.done = true;

    const inZone = c.pos >= c.zoneStart && c.pos <= c.zoneEnd;
    const center = (c.zoneStart + c.zoneEnd) / 2;
    const half = (c.zoneEnd - c.zoneStart) / 2;
    const accuracy = inZone ? 1 - Math.abs(c.pos - center) / half : 0; // 0..1
    const perfect = inZone && accuracy > 0.75;

    // Consume one fabric unit
    state.inventory[o.colorKey]--;

    if (!inZone) {
      // Wasted fabric — bad cut
      log("Botched cut on " + o.typeName + "! Fabric wasted.", "bad");
      changeRep(-1);
      finishBuild(false);
      return;
    }

    // Successful unit
    o.qtyDone++;
    let pay = o.unitPay * bonusMult();
    let bonusTxt = "";
    if (perfect) {
      pay *= 1.25;
      changeRep(+1);
      bonusTxt = " ✦ PERFECT cut! +25% bonus";
    }
    pay = Math.round(pay);
    addCash(pay);
    state.shipped++;
    spawnShip(o.colorHex);

    log("Shipped a " + COLORS[o.colorKey].name + " " + o.typeName +
        " (+$" + pay + ")" + bonusTxt, perfect ? "good" : "info");

    if (o.qtyDone >= o.qtyNeeded) {
      completeOrder(o);
    }
    finishBuild(true);
  }

  function finishBuild(success) {
    state.building = false;
    state.cut = null;
    state.blind = null;
    updateProductionUI();
    renderInventory();
    renderOrders();
    renderStats();
  }

  function completeOrder(o) {
    changeRep(+3);
    log("✓ Order #" + o.id + " complete! " + o.colorName + " " + o.typeName +
        " x" + o.qtyNeeded + ". Customer delighted.", "good");
    state.orders = state.orders.filter(x => x.id !== o.id);
    if (state.activeOrderId === o.id) state.activeOrderId = null;
  }

  function spawnShip(hex) {
    state.anim.ship.push({ x: 360, y: 250, vx: 2.4 + Math.random(), color: hex, life: 1 });
  }

  /* ============================================================
     DAY CYCLE
     ============================================================ */
  function endDay() {
    if (state.over) return;
    if (state.building) { log("Finish the current blind before ending the day.", "bad"); return; }

    // Pay rent
    const rent = dailyRent();
    addCash(-rent);
    log("Paid daily rent: -$" + rent, "info");

    // Advance deadlines, expire orders
    const expired = [];
    state.orders.forEach(o => {
      o.deadline--;
      if (o.deadline <= 0) expired.push(o);
    });
    expired.forEach(o => {
      changeRep(-6);
      log("✗ Order #" + o.id + " (" + o.colorName + " " + o.typeName +
          ") expired! Reputation hit.", "bad");
    });
    state.orders = state.orders.filter(o => o.deadline > 0);
    if (getActiveOrder() === null) state.activeOrderId = null;

    state.day++;
    refillOrders();

    log("☀ A new day begins. " + state.orders.length + " orders on the board.", "info");

    checkGameOver();
    renderAll();
  }

  function checkGameOver() {
    if (state.cash < BANKRUPT_LIMIT) {
      gameOver("Bankrupt!",
        "Capricorn Blinds ran out of money. The factory closes its doors.");
      return true;
    }
    if (state.reputation <= 0) {
      gameOver("Reputation Ruined",
        "Word spread about missed orders. No customers remain.");
      return true;
    }
    return false;
  }

  function gameOver(title, msg) {
    state.over = true;
    document.getElementById("goTitle").textContent = title;
    document.getElementById("goMessage").textContent = msg;
    document.getElementById("goStats").innerHTML =
      "<div>Days survived: <b>" + state.day + "</b></div>" +
      "<div>Blinds shipped: <b>" + state.shipped + "</b></div>" +
      "<div>Total revenue: <b>$" + Math.round(state.revenue) + "</b></div>" +
      "<div>Final reputation: <b>" + state.reputation + "</b></div>";
    show("gameOverScreen");
  }

  /* ============================================================
     SHOP & UPGRADES
     ============================================================ */
  function buyFabric(colorKey) {
    if (state.cash < FABRIC_COST) { log("Not enough cash for fabric.", "bad"); return; }
    addCash(-FABRIC_COST);
    state.inventory[colorKey]++;
    renderShop();
    renderInventory();
    renderStats();
    updateProductionUI();
  }

  function buyUpgrade(key) {
    const u = state.upgrades[key];
    if (u.level >= u.max) return;
    if (state.cash < u.cost) { log("Not enough cash for " + u.name + ".", "bad"); return; }
    addCash(-u.cost);
    u.level++;
    log("Upgraded " + u.name + " to level " + u.level + ".", "good");
    u.cost = Math.round(u.cost * 1.6);
    if (key === "slots") refillOrders();
    renderUpgrades();
    renderStats();
    renderOrders();
  }

  /* ============================================================
     RENDERING — DOM UI
     ============================================================ */
  function renderStats() {
    document.getElementById("statCash").textContent = "$" + Math.round(state.cash);
    document.getElementById("statCash").style.color = state.cash < 0 ? "var(--red)" : "var(--green)";
    document.getElementById("statDay").textContent = state.day;
    document.getElementById("statRep").textContent = state.reputation;
    document.getElementById("statShipped").textContent = state.shipped;
  }

  function renderOrders() {
    const list = document.getElementById("ordersList");
    list.innerHTML = "";
    if (state.orders.length === 0) {
      const e = document.createElement("div");
      e.className = "item-sub";
      e.textContent = "No orders right now. End the day to get more.";
      list.appendChild(e);
      return;
    }
    state.orders.forEach(o => {
      const div = document.createElement("div");
      div.className = "order" +
        (o.id === state.activeOrderId ? " active" : "") +
        (o.deadline <= 1 ? " urgent" : "");
      const pct = Math.round((o.qtyDone / o.qtyNeeded) * 100);
      div.innerHTML =
        '<div class="order-top">' +
          '<span class="order-type">' + o.typeName + '</span>' +
          '<span class="order-pay">$' + o.pay + '</span>' +
        '</div>' +
        '<div class="order-row"><span class="swatch" style="background:' + o.colorHex + '"></span>' +
          o.colorName + ' · ' + o.width + 'cm · x' + o.qtyNeeded + '</div>' +
        '<div class="order-row deadline ' + (o.deadline <= 1 ? 'warn' : '') + '">' +
          '⏱ ' + o.deadline + ' day' + (o.deadline === 1 ? '' : 's') + ' left · ' +
          o.qtyDone + '/' + o.qtyNeeded + ' built</div>' +
        '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>';
      div.addEventListener("click", () => {
        if (state.building) return;
        state.activeOrderId = o.id;
        renderOrders();
        updateProductionUI();
      });
      list.appendChild(div);
    });
  }

  function renderInventory() {
    const c = document.getElementById("tab-inventory");
    c.innerHTML = "";
    COLOR_KEYS.forEach(k => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML =
        '<div class="item-left"><span class="swatch" style="background:' + COLORS[k].hex + '"></span>' +
        '<div><div class="item-name">' + COLORS[k].name + '</div>' +
        '<div class="item-sub">fabric rolls</div></div></div>' +
        '<div class="item-qty">' + state.inventory[k] + '</div>';
      c.appendChild(div);
    });
  }

  function renderShop() {
    const c = document.getElementById("tab-shop");
    c.innerHTML = "";
    const note = document.createElement("div");
    note.className = "item-sub";
    note.style.marginBottom = "2px";
    note.textContent = "Buy fabric rolls — $" + FABRIC_COST + " each. One roll per blind.";
    c.appendChild(note);
    COLOR_KEYS.forEach(k => {
      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML =
        '<div class="item-left"><span class="swatch" style="background:' + COLORS[k].hex + '"></span>' +
        '<div><div class="item-name">' + COLORS[k].name + '</div>' +
        '<div class="item-sub">In stock: ' + state.inventory[k] + '</div></div></div>';
      const btn = document.createElement("button");
      btn.className = "btn btn-primary buy-btn";
      btn.textContent = "Buy $" + FABRIC_COST;
      btn.disabled = state.cash < FABRIC_COST;
      btn.addEventListener("click", () => buyFabric(k));
      div.appendChild(btn);
      c.appendChild(div);
    });
  }

  function renderUpgrades() {
    const c = document.getElementById("tab-upgrades");
    c.innerHTML = "";
    Object.keys(state.upgrades).forEach(k => {
      const u = state.upgrades[k];
      const div = document.createElement("div");
      div.className = "item";
      div.style.alignItems = "flex-start";
      div.style.flexDirection = "column";
      div.style.gap = "8px";
      const maxed = u.level >= u.max;
      div.innerHTML =
        '<div style="width:100%"><div class="item-name">' + u.name +
          ' <span class="item-sub">(Lv ' + u.level + '/' + u.max + ')</span></div>' +
        '<div class="upg-desc">' + u.desc + '</div></div>';
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.width = "100%";
      row.style.justifyContent = "flex-end";
      if (maxed) {
        const m = document.createElement("span");
        m.className = "maxed";
        m.textContent = "MAX LEVEL";
        row.appendChild(m);
      } else {
        const btn = document.createElement("button");
        btn.className = "btn btn-accent buy-btn";
        btn.textContent = "Upgrade $" + u.cost;
        btn.disabled = state.cash < u.cost;
        btn.addEventListener("click", () => buyUpgrade(k));
        row.appendChild(btn);
      }
      div.appendChild(row);
      c.appendChild(div);
    });
  }

  function updateProductionUI() {
    const info = document.getElementById("activeOrderInfo");
    const buildBtn = document.getElementById("buildBtn");
    const cutBtn = document.getElementById("cutBtn");
    const o = getActiveOrder();

    if (state.building) {
      buildBtn.classList.add("hidden");
      cutBtn.classList.remove("hidden");
      info.innerHTML = "Watch the blade — <b>CUT</b> inside the green zone! " +
        "(click CUT or press <b>Space</b>)";
      return;
    }
    buildBtn.classList.remove("hidden");
    cutBtn.classList.add("hidden");

    if (!o) {
      info.innerHTML = "Select an order to begin production.";
      buildBtn.disabled = true;
      return;
    }
    const haveFabric = state.inventory[o.colorKey] > 0;
    info.innerHTML =
      "<b>" + o.colorName + " " + o.typeName + "</b> · " + o.width + "cm · " +
      o.qtyDone + "/" + o.qtyNeeded + " built · pays <b>$" + o.unitPay + "</b>/unit." +
      (haveFabric ? "" : ' <span style="color:var(--red)">No ' + o.colorName + ' fabric — buy some in the Shop.</span>');
    buildBtn.disabled = !canBuildActive();
  }

  function renderAll() {
    renderStats();
    renderOrders();
    renderInventory();
    renderShop();
    renderUpgrades();
    updateProductionUI();
  }

  /* ============================================================
     RENDERING — CANVAS FACTORY SCENE
     ============================================================ */
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const CW = canvas.width, CH = canvas.height;

  function drawScene() {
    ctx.clearRect(0, 0, CW, CH);

    // background gradient floor/wall
    const g = ctx.createLinearGradient(0, 0, 0, CH);
    g.addColorStop(0, "#13203a");
    g.addColorStop(0.62, "#172a47");
    g.addColorStop(0.63, "#0f1a2e");
    g.addColorStop(1, "#0a1320");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CW, CH);

    // wall window decoration (factory window showing a blind)
    drawFactoryWindow(40, 30, 150, 150);
    drawFactoryWindow(CW - 190, 30, 150, 150);

    // banner
    ctx.fillStyle = "rgba(255,209,102,0.92)";
    ctx.font = "bold 22px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CAPRICORN BLINDS — FACTORY FLOOR", CW / 2, 40);
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.fillStyle = "rgba(159,179,212,0.8)";
    ctx.fillText("Daily Rent: $" + dailyRent() + "   ·   Orders open: " +
      state.orders.length + "/" + maxOrders(), CW / 2, 60);

    // conveyor belt
    drawConveyor();

    // workbench + active blind
    drawWorkbench();

    // shipping animation
    drawShipping();

    // cut mini-game overlay
    if (state.building && state.cut) drawCutGame();
    else drawIdleBench();
  }

  function drawFactoryWindow(x, y, w, h) {
    ctx.fillStyle = "#0a1426";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#314a73";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    // a little decorative blind in the window
    ctx.fillStyle = "rgba(120,140,180,0.25)";
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(x + 6, y + 10 + i * 18, w - 12, 9);
    }
  }

  function drawConveyor() {
    const beltY = 300, beltH = 26;
    ctx.fillStyle = "#202f4a";
    ctx.fillRect(60, beltY, CW - 120, beltH);
    ctx.fillStyle = "#2c3f63";
    const off = (state.anim.t * 1.6) % 24;
    for (let x = 60 - 24 + off; x < CW - 60; x += 24) {
      ctx.fillRect(x, beltY, 12, beltH);
    }
    ctx.strokeStyle = "#3a5588";
    ctx.lineWidth = 2;
    ctx.strokeRect(60, beltY, CW - 120, beltH);

    // rollers
    ctx.fillStyle = "#46608f";
    for (let i = 0; i <= 1; i++) {
      const cx = i === 0 ? 72 : CW - 72;
      ctx.beginPath();
      ctx.arc(cx, beltY + beltH / 2, 9, 0, Math.PI * 2);
      ctx.fill();
    }

    // truck at the end
    ctx.fillStyle = "#3a4a66";
    ctx.fillRect(CW - 110, 245, 56, 40);
    ctx.fillStyle = "#566a8e";
    ctx.fillRect(CW - 118, 262, 14, 23);
    ctx.fillStyle = "#1a2740";
    ctx.beginPath(); ctx.arc(CW - 98, 290, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(CW - 66, 290, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,209,102,0.9)";
    ctx.font = "9px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText("SHIP", CW - 82, 268);
  }

  function drawWorkbench() {
    const bx = 150, by = 215, bw = 200, bh = 70;
    // bench legs
    ctx.fillStyle = "#22324d";
    ctx.fillRect(bx + 8, by + bh, 10, 22);
    ctx.fillRect(bx + bw - 18, by + bh, 10, 22);
    // bench top
    ctx.fillStyle = "#33486e";
    ctx.fillRect(bx, by + bh - 10, bw, 12);
  }

  function drawIdleBench() {
    const o = getActiveOrder();
    ctx.textAlign = "center";
    if (!o) {
      ctx.fillStyle = "rgba(159,179,212,0.7)";
      ctx.font = "14px Segoe UI";
      ctx.fillText("Pick an order from the left to start cutting.", CW / 2, 150);
      return;
    }
    // preview blind on bench
    drawBlindPreview(CW / 2 - 70, 150, 140, 70, o.colorHex, o.typeKey, 1);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "13px Segoe UI";
    ctx.fillText("Ready: " + o.colorName + " " + o.typeName, CW / 2, 138);
    ctx.fillStyle = "rgba(159,179,212,0.8)";
    ctx.font = "12px Segoe UI";
    ctx.fillText('Press "Cut & Build" to manufacture a unit', CW / 2, 240);
  }

  function drawBlindPreview(x, y, w, h, hex, typeKey, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    // headrail
    ctx.fillStyle = "#cfd8e6";
    ctx.fillRect(x - 4, y - 8, w + 8, 8);
    // body
    ctx.fillStyle = hex;
    ctx.fillRect(x, y, w, h);
    // slats / texture by type
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1;
    if (typeKey === "venetian" || typeKey === "roman") {
      for (let yy = y + 8; yy < y + h; yy += 9) {
        ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
      }
    } else if (typeKey === "vertical") {
      for (let xx = x + 8; xx < x + w; xx += 11) {
        ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); ctx.stroke();
      }
    } else {
      // roller — subtle highlight
      const grad = ctx.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, "rgba(255,255,255,0.12)");
      grad.addColorStop(0.5, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
    }
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.strokeRect(x, y, w, h);
    // pull cord
    ctx.strokeStyle = "rgba(220,220,220,0.6)";
    ctx.beginPath(); ctx.moveTo(x + w + 2, y); ctx.lineTo(x + w + 2, y + h + 10); ctx.stroke();
    ctx.restore();
  }

  function drawCutGame() {
    const c = state.cut;
    const o = getActiveOrder();
    const trackX = 120, trackW = CW - 240, trackY = 165, trackH = 22;

    // The fabric being cut (visual)
    drawBlindPreview(CW / 2 - 70, 195, 140, 60, o.colorHex, o.typeKey, 1);

    // instruction
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "13px Segoe UI";
    ctx.fillText("Cut to " + o.width + "cm — hit the GREEN zone!", CW / 2, 130);

    // ruler track
    ctx.fillStyle = "#0c1626";
    ctx.fillRect(trackX, trackY, trackW, trackH);
    ctx.strokeStyle = "#3a5588";
    ctx.lineWidth = 2;
    ctx.strokeRect(trackX, trackY, trackW, trackH);
    // ruler ticks
    ctx.strokeStyle = "rgba(159,179,212,0.4)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const tx = trackX + (trackW * i) / 10;
      ctx.beginPath(); ctx.moveTo(tx, trackY); ctx.lineTo(tx, trackY + 6); ctx.stroke();
    }

    // target zone (green)
    const zx = trackX + trackW * c.zoneStart;
    const zw = trackW * (c.zoneEnd - c.zoneStart);
    const zgrad = ctx.createLinearGradient(zx, 0, zx + zw, 0);
    zgrad.addColorStop(0, "rgba(58,208,122,0.35)");
    zgrad.addColorStop(0.5, "rgba(58,208,122,0.85)");
    zgrad.addColorStop(1, "rgba(58,208,122,0.35)");
    ctx.fillStyle = zgrad;
    ctx.fillRect(zx, trackY + 2, zw, trackH - 4);
    // perfect core
    const coreC = (c.zoneStart + c.zoneEnd) / 2;
    const coreHalf = (c.zoneEnd - c.zoneStart) / 2 * 0.25;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(trackX + trackW * (coreC - coreHalf), trackY + 2,
                 trackW * coreHalf * 2, trackH - 4);

    // blade indicator
    const bx = trackX + trackW * c.pos;
    ctx.fillStyle = "#ffb23e";
    ctx.beginPath();
    ctx.moveTo(bx, trackY - 12);
    ctx.lineTo(bx - 8, trackY - 26);
    ctx.lineTo(bx + 8, trackY - 26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#ffb23e";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bx, trackY - 12);
    ctx.lineTo(bx, trackY + trackH + 12);
    ctx.stroke();
  }

  function drawShipping() {
    for (let i = state.anim.ship.length - 1; i >= 0; i--) {
      const s = state.anim.ship[i];
      s.x += s.vx;
      drawBlindPreview(s.x, s.y - 18, 30, 20, s.color, "roller", Math.max(0, s.life));
      if (s.x > CW - 110) {
        s.life -= 0.08;
        if (s.life <= 0) state.anim.ship.splice(i, 1);
      }
    }
  }

  /* ============================================================
     MAIN LOOP
     ============================================================ */
  function tick() {
    if (state && !state.over) {
      state.anim.t++;
      // advance blade
      if (state.building && state.cut && !state.cut.done) {
        const c = state.cut;
        c.pos += c.dir * c.speed;
        if (c.pos >= 0.98) { c.pos = 0.98; c.dir = -1; }
        if (c.pos <= 0.02) { c.pos = 0.02; c.dir = 1; }
      }
      drawScene();
    }
    requestAnimationFrame(tick);
  }

  /* ============================================================
     SCREEN MANAGEMENT & EVENTS
     ============================================================ */
  function show(id) {
    ["titleScreen", "gameScreen", "gameOverScreen"].forEach(s => {
      document.getElementById(s).classList.toggle("hidden", s !== id);
    });
  }

  function startGame() {
    state = newState();
    refillOrders();
    show("gameScreen");
    log("Welcome to Capricorn Blinds! Take an order and start cutting.", "good");
    renderAll();
  }

  function wireEvents() {
    document.getElementById("startBtn").addEventListener("click", startGame);
    document.getElementById("restartBtn").addEventListener("click", startGame);
    document.getElementById("howBtn").addEventListener("click",
      () => document.getElementById("howModal").classList.remove("hidden"));
    document.getElementById("closeHowBtn").addEventListener("click",
      () => document.getElementById("howModal").classList.add("hidden"));

    document.getElementById("buildBtn").addEventListener("click", startBuild);
    document.getElementById("cutBtn").addEventListener("click", performCut);
    document.getElementById("nextDayBtn").addEventListener("click", endDay);

    // tabs
    document.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        ["inventory", "shop", "upgrades"].forEach(name => {
          document.getElementById("tab-" + name)
            .classList.toggle("hidden", name !== tab.dataset.tab);
        });
      });
    });

    // keyboard: Space = cut, Enter = build
    document.addEventListener("keydown", (e) => {
      if (document.getElementById("gameScreen").classList.contains("hidden")) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (state.building) performCut();
        else if (canBuildActive()) startBuild();
      }
    });

    // click on canvas during cut also triggers a cut
    canvas.addEventListener("click", () => {
      if (state && state.building) performCut();
    });
  }

  /* ---------------- Boot ---------------- */
  wireEvents();
  requestAnimationFrame(tick);
})();
