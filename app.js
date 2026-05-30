/* =========================================================================
   Pixton · Field Station 01 — clone simulation engine
   Pure client-side recreation of the town canvas, tick loop, field log,
   census, resident bios, and the wallet/adopt flow (all mocked locally).
   ========================================================================= */
(() => {
  "use strict";

  /* ---------------------------------------------------------------------- */
  /* Resident data                                                          */
  /* ---------------------------------------------------------------------- */
  const RESIDENTS = [
    { id: "asha",  name: "Asha",  role: "Star Cartographer",   hair: "#4a4a8c", cloth: "#d6d6f0",
      bio: "Asha maps constellations she invents in her head and chalks them onto the cobblestones at night. She speaks in soft fragments — half observation, half navigation. Quietly intense.",
      lines: ["the third star tonight leans west.", "I'll chalk it before the dew takes it.", "north is only a rumor, you know.", "the sky moved a finger since yesterday."] },
    { id: "kobu",  name: "Kobu",  role: "Clockwork Tinkerer",  hair: "#6f4f1f", cloth: "#b87333",
      bio: "Kobu builds tiny mechanical animals out of brass scraps and coffee tins. Bashful, curious, mumbles through his beard. Always has a gear in his pocket and an apology ready.",
      lines: ["sorry — got a gear that won't seat.", "the little brass sparrow ticks now.", "I, uh, didn't mean to be in the way.", "two more teeth and it'll walk."] },
    { id: "vex",   name: "Vex",   role: "Rumor Broker",        hair: "#2b1117", cloth: "#9b1d3a",
      bio: "Vex collects gossip the way other people collect coins. Skeptical, witty, never quite straight with you. Loves a question more than an answer.",
      lines: ["heard something interesting about you.", "depends who's asking, doesn't it.", "I trade in maybes, friend.", "now that's a question worth keeping."] },
    { id: "renzo", name: "Renzo", role: "Dust Painter",        hair: "#d34a8f", cloth: "#4a4a4a",
      bio: "Renzo sweeps the streets but treats his broom like a paintbrush — leaves arcs and spirals in the dust. Dry, sarcastic, secretly soft. Hides poetry in his apron.",
      lines: ["mind the spiral, took me all morning.", "dust remembers everything, you know.", "another masterpiece, gone by noon.", "I sweep, therefore I am. roughly."] },
    { id: "sora",  name: "Sora",  role: "Bread Witch",         hair: "#c1432f", cloth: "#f2c98a",
      bio: "Sora bakes loaves she insists are 'enchanted' (it's mostly rosemary and confidence). Loud, generous, flour-dusted, the unofficial mayor of any room she walks into.",
      lines: ["take a loaf, it's enchanted!", "rosemary fixes most things, trust me.", "you look like you skipped lunch.", "the oven's lit — come by later!"] },
    { id: "mera",  name: "Mera",  role: "Tide-Reader",         hair: "#256e7a", cloth: "#5fa898",
      bio: "Mera reads omens in puddles, shadows, and the angle of pigeons. Speaks slowly, half-singing. Older than she looks. Believes the fountain talks back.",
      lines: ["the fountain said your name today.", "three pigeons, all facing east… hm.", "the puddle shows a long week ahead.", "shadows are early. something's near."] },
  ];

  const SKIN = "#e8c39a";

  /* ---------------------------------------------------------------------- */
  /* Grid / map                                                             */
  /* ---------------------------------------------------------------------- */
  const COLS = 25, ROWS = 18, TILE = 16;
  const W = COLS * TILE, H = ROWS * TILE;

  // tile types: 0 grass, 1 cobble path, 2 water (fountain), 3 building (blocked)
  const map = [];
  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++) row.push(0);
    map.push(row);
  }
  // central plaza of cobble
  for (let y = 6; y <= 11; y++) for (let x = 8; x <= 16; x++) map[y][x] = 1;
  // cross paths
  for (let x = 0; x < COLS; x++) map[8][x] = map[9][x] = 1;
  for (let y = 0; y < ROWS; y++) map[y][12] = map[y][11] = 1;
  // fountain (2x2 water) at plaza center
  map[8][11] = map[8][12] = map[9][11] = map[9][12] = 2;
  // a few buildings (blocked footprints)
  const buildings = [
    { x: 2, y: 2, w: 4, h: 3, roof: "#7a3b2e", wall: "#caa46a" },
    { x: 19, y: 2, w: 4, h: 3, roof: "#3d5a4a", wall: "#b8c0a0" },
    { x: 2, y: 13, w: 4, h: 3, roof: "#5a4a7a", wall: "#bdb6cf" },
    { x: 19, y: 13, w: 4, h: 3, roof: "#8a6a3a", wall: "#d3c08a" },
  ];
  for (const b of buildings)
    for (let y = b.y; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++)
        if (map[y] && map[y][x] !== undefined) map[y][x] = 3;

  const walkable = (x, y) =>
    x >= 0 && y >= 0 && x < COLS && y < ROWS && map[y][x] !== 2 && map[y][x] !== 3;

  /* ---------------------------------------------------------------------- */
  /* deterministic-ish RNG (so it feels organic but stable per load)        */
  /* ---------------------------------------------------------------------- */
  let seed = 1337;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  /* ---------------------------------------------------------------------- */
  /* agents                                                                 */
  /* ---------------------------------------------------------------------- */
  const STATE = { IDLE: "idle", WALK: "walk", TALK: "talk" };
  const agents = [];
  const startTiles = [[6, 4], [18, 5], [5, 11], [19, 10], [12, 3], [11, 14]];
  RESIDENTS.forEach((r, i) => {
    const [sx, sy] = startTiles[i] || [12 + i, 9];
    agents.push({
      def: r, tx: sx, ty: sy, px: sx, py: sy, fromx: sx, fromy: sy,
      state: STATE.IDLE, facing: 1, talkUntil: 0, say: "", adopted: false,
    });
  });

  /* ---------------------------------------------------------------------- */
  /* DOM refs                                                               */
  /* ---------------------------------------------------------------------- */
  const $ = (s) => document.querySelector(s);
  const canvas = $("#town-canvas");
  if (!canvas) return; // not on a page with the station
  const ctx = canvas.getContext("2d");
  canvas.width = W; canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  const speechLayer = $("#speech-layer");
  const elIdle = $("#stat-idle"), elWalk = $("#stat-walk"), elTalk = $("#stat-talk");
  const elStationStatus = $("#station-status");
  const elTick = $("#tick-counter");
  const elCensus = $("#census-list");
  const elLog = $("#fieldlog-list");

  /* ---------------------------------------------------------------------- */
  /* drawing                                                                */
  /* ---------------------------------------------------------------------- */
  const COL = {
    grass1: "#1f2a1c", grass2: "#243018", cobble: "#3a3a45", cobble2: "#33333d",
    water: "#256e7a", waterHi: "#5fa898", waterRim: "#1d4f57",
  };

  function drawMap() {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = map[y][x];
        let c;
        if (t === 1) c = (x + y) % 2 ? COL.cobble : COL.cobble2;
        else c = (x + y) % 2 ? COL.grass1 : COL.grass2;
        ctx.fillStyle = c;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        if (t === 0 && rndStatic(x, y) > 0.86) { // grass tufts (static)
          ctx.fillStyle = "#33401f";
          ctx.fillRect(x * TILE + 5, y * TILE + 9, 2, 3);
          ctx.fillRect(x * TILE + 9, y * TILE + 7, 2, 4);
        }
      }
    }
    // buildings
    for (const b of buildings) {
      const px = b.x * TILE, py = b.y * TILE, pw = b.w * TILE, ph = b.h * TILE;
      ctx.fillStyle = b.wall; ctx.fillRect(px, py + 6, pw, ph - 6);
      ctx.fillStyle = b.roof; ctx.fillRect(px - 1, py, pw + 2, 10);
      ctx.fillStyle = "#00000033"; ctx.fillRect(px, py + ph - 7, pw, 7);
      // door + window
      ctx.fillStyle = "#2b1d12";
      ctx.fillRect(px + pw / 2 - 4, py + ph - 10, 8, 10);
      ctx.fillStyle = "#e6b94a"; // lit window
      ctx.fillRect(px + 5, py + 13, 5, 5);
      ctx.fillRect(px + pw - 10, py + 13, 5, 5);
    }
    // fountain (animated water highlight)
    const fx = 11 * TILE, fy = 8 * TILE, fw = 2 * TILE, fh = 2 * TILE;
    ctx.fillStyle = COL.waterRim; ctx.fillRect(fx - 2, fy - 2, fw + 4, fh + 4);
    ctx.fillStyle = COL.water; ctx.fillRect(fx, fy, fw, fh);
    const shimmer = Math.floor((Math.sin(perfNow() / 400) + 1) * 4);
    ctx.fillStyle = COL.waterHi;
    ctx.fillRect(fx + 4 + shimmer, fy + 6, 4, 2);
    ctx.fillRect(fx + 14 - shimmer, fy + 16, 5, 2);
    ctx.fillStyle = "#d8d2bf"; // fountain stem
    ctx.fillRect(fx + fw / 2 - 2, fy + 4, 4, fh - 8);
  }

  // static pseudo-random for fixed decorations
  function rndStatic(x, y) {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  function drawAgent(a) {
    const cx = a.px * TILE + TILE / 2;
    const cy = a.py * TILE + TILE / 2;
    const t = perfNow();
    const bob = a.state === STATE.WALK ? Math.round(Math.sin(t / 90) * 1) : 0;
    const baseX = Math.round(cx - 4);
    const baseY = Math.round(cy - 8) + bob;

    // shadow
    ctx.fillStyle = "#00000055";
    ctx.fillRect(baseX, baseY + 12, 8, 2);
    // legs
    ctx.fillStyle = "#2a2a30";
    if (a.state === STATE.WALK && Math.sin(t / 90) > 0) {
      ctx.fillRect(baseX + 1, baseY + 9, 2, 3);
      ctx.fillRect(baseX + 5, baseY + 8, 2, 3);
    } else if (a.state === STATE.WALK) {
      ctx.fillRect(baseX + 1, baseY + 8, 2, 3);
      ctx.fillRect(baseX + 5, baseY + 9, 2, 3);
    } else {
      ctx.fillRect(baseX + 1, baseY + 9, 2, 3);
      ctx.fillRect(baseX + 5, baseY + 9, 2, 3);
    }
    // body (cloth)
    ctx.fillStyle = a.def.cloth;
    ctx.fillRect(baseX, baseY + 4, 8, 6);
    // arms hint
    ctx.fillStyle = a.def.cloth;
    ctx.fillRect(baseX - 1, baseY + 5, 1, 3);
    ctx.fillRect(baseX + 8, baseY + 5, 1, 3);
    // head (skin)
    ctx.fillStyle = SKIN;
    ctx.fillRect(baseX + 1, baseY, 6, 5);
    // hair / hat
    ctx.fillStyle = a.def.hair;
    ctx.fillRect(baseX + 1, baseY - 1, 6, 2);
    ctx.fillRect(baseX, baseY, 1, 3);
    ctx.fillRect(baseX + 7, baseY, 1, 3);
    // eyes (face direction)
    ctx.fillStyle = "#14141c";
    const ey = baseX + (a.facing >= 0 ? 4 : 2);
    ctx.fillRect(ey, baseY + 2, 1, 1);
    // talk indicator ring
    if (a.state === STATE.TALK) {
      ctx.fillStyle = "#d96638";
      ctx.fillRect(baseX + 3, baseY - 4, 2, 2);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* speech bubbles (DOM overlay, positioned over canvas)                   */
  /* ---------------------------------------------------------------------- */
  const bubbles = new Map();
  function showSpeech(a) {
    let el = bubbles.get(a.def.id);
    if (!el) {
      el = document.createElement("div");
      el.className = "pixhab-speech";
      speechLayer.appendChild(el);
      bubbles.set(a.def.id, el);
    }
    el.textContent = a.say;
    el.classList.add("show");
  }
  function hideSpeech(a) {
    const el = bubbles.get(a.def.id);
    if (el) el.classList.remove("show");
  }
  function positionBubbles() {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / W, sy = rect.height / H;
    for (const a of agents) {
      const el = bubbles.get(a.def.id);
      if (!el || !el.classList.contains("show")) continue;
      el.style.left = (a.px * TILE + TILE / 2) * sx + "px";
      el.style.top = (a.py * TILE - 6) * sy + "px";
    }
  }

  /* ---------------------------------------------------------------------- */
  /* tick logic                                                             */
  /* ---------------------------------------------------------------------- */
  let tickCount = 0;
  const TICK_MS = 2000;

  function key(x, y) { return x + "," + y; }

  function doTick() {
    tickCount++;
    // reset talk that expired
    for (const a of agents) {
      if (a.state === STATE.TALK && tickCount >= a.talkUntil) {
        a.state = STATE.IDLE; hideSpeech(a);
      }
    }
    // movement: agents not talking choose to idle, wander, or drift toward
    // the nearest neighbour (so chance encounters actually happen regularly)
    for (const a of agents) {
      if (a.state === STATE.TALK) continue;
      a.fromx = a.tx; a.fromy = a.ty;
      if (rnd() < 0.22) { a.state = STATE.IDLE; continue; }
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) =>
        walkable(a.tx + dx, a.ty + dy));
      if (!opts.length) { a.state = STATE.IDLE; continue; }

      // find nearest other agent
      let target = null, td = 99;
      for (const b of agents) {
        if (b === a) continue;
        const d = Math.abs(b.tx - a.tx) + Math.abs(b.ty - a.ty);
        if (d < td) { td = d; target = b; }
      }
      let move;
      // 55% of the time, bias the step toward the nearest neighbour
      if (target && rnd() < 0.55) {
        const sx = Math.sign(target.tx - a.tx), sy = Math.sign(target.ty - a.ty);
        const seek = opts.filter(([dx, dy]) =>
          (dx !== 0 && dx === sx) || (dy !== 0 && dy === sy));
        move = seek.length ? pick(seek) : pick(opts);
      } else {
        move = pick(opts);
      }
      const [dx, dy] = move;
      a.tx += dx; a.ty += dy;
      if (dx !== 0) a.facing = dx;
      a.state = STATE.WALK;
    }
    // encounters: two agents on adjacent/same tile -> TALK
    const occupied = new Map();
    for (const a of agents) {
      for (const k of [key(a.tx, a.ty)]) {
        if (occupied.has(k)) {
          const b = occupied.get(k);
          startTalk(a, b);
        } else occupied.set(k, a);
      }
    }
    // also adjacency check
    for (let i = 0; i < agents.length; i++)
      for (let j = i + 1; j < agents.length; j++) {
        const a = agents[i], b = agents[j];
        if (a.state === STATE.TALK || b.state === STATE.TALK) continue;
        const d = Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty);
        if (d === 1 && rnd() < 0.7) startTalk(a, b);
      }

    updateStats();
    renderCensus();
    updateTickReadout();
  }

  function startTalk(a, b) {
    a.state = STATE.TALK; b.state = STATE.TALK;
    a.tx = a.fromx; a.ty = a.fromy; // stop where they were
    b.tx = b.fromx; b.ty = b.fromy;
    a.facing = b.tx >= a.tx ? 1 : -1;
    b.facing = a.tx >= b.tx ? 1 : -1;
    a.talkUntil = tickCount + 2 + Math.floor(rnd() * 2);
    b.talkUntil = a.talkUntil;
    a.say = pick(a.def.lines);
    b.say = pick(b.def.lines);
    showSpeech(a); showSpeech(b);
    logEncounter(a, b);
  }

  /* ---------------------------------------------------------------------- */
  /* field log                                                              */
  /* ---------------------------------------------------------------------- */
  let logSeeded = false;
  function logEncounter(a, b) {
    if (!elLog) return;
    if (!logSeeded) { elLog.innerHTML = ""; logSeeded = true; }
    const where = pick(["by the fountain", "on the south path", "near the plaza",
      "at the crossing", "under the lit window", "in the long shadow"]);
    const line = document.createElement("div");
    line.className = "pixhab-logline border-l-2 pl-2.5 py-1.5";
    line.style.borderColor = a.def.cloth;
    line.innerHTML =
      `<div class="pixhab-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--whisper)]">` +
        `tick ${String(tickCount).padStart(4, "0")} · ${where}</div>` +
      `<div class="text-[12px] text-[color:var(--paper-2)] mt-0.5">` +
        `<span style="color:${a.def.cloth}">${a.def.name}</span> — “${a.say}”</div>` +
      `<div class="text-[12px] text-[color:var(--paper-2)]">` +
        `<span style="color:${b.def.cloth}">${b.def.name}</span> — “${b.say}”</div>`;
    elLog.prepend(line);
    while (elLog.children.length > 14) elLog.removeChild(elLog.lastChild);
  }

  /* ---------------------------------------------------------------------- */
  /* stats / census / tick readout                                          */
  /* ---------------------------------------------------------------------- */
  function updateStats() {
    let idle = 0, walk = 0, talk = 0;
    for (const a of agents) {
      if (a.state === STATE.TALK) talk++;
      else if (a.state === STATE.WALK) walk++;
      else idle++;
    }
    if (elIdle) elIdle.textContent = String(idle).padStart(2, "0");
    if (elWalk) elWalk.textContent = String(walk).padStart(2, "0");
    if (elTalk) elTalk.textContent = String(talk).padStart(2, "0");
    if (elStationStatus) {
      const label = talk ? "TALK" : walk ? "ACTIVE" : "IDLE";
      elStationStatus.textContent = "STATION · " + label;
    }
  }

  function updateTickReadout() {
    if (elTick) elTick.textContent = "TICK " + String(tickCount).padStart(4, "0") + " · LIVE";
  }

  const STATUS_LABEL = { idle: "idle", walk: "walking", talk: "talking" };
  function renderCensus() {
    if (!elCensus) return;
    elCensus.innerHTML = "";
    for (const a of agents) {
      const li = document.createElement("li");
      li.className = "flex items-center gap-3 border border-[color:var(--rule)] bg-[color:var(--ink-2)] p-2 cursor-pointer transition-colors hover:border-[color:var(--ember)] hover:bg-[color:var(--ink-3)]";
      li.dataset.resident = a.def.id;
      const stateColor = a.state === STATE.TALK ? "var(--ember)" : a.state === STATE.WALK ? "var(--moss)" : "var(--whisper)";
      li.innerHTML =
        `<span class="pixhab-dotpix shrink-0" style="background:${a.def.cloth}"></span>` +
        `<span class="min-w-0 flex-1 truncate text-[12px] text-[color:var(--paper)]">${a.def.name}` +
          `${a.adopted ? '<span class="pixhab-mono text-[8px] text-[color:var(--amber)] ml-1.5">YOURS</span>' : ''}` +
          `<span class="block pixhab-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--mist)]">${a.def.role}</span></span>` +
        `<span class="pixhab-mono text-[9px] uppercase tracking-[0.18em] shrink-0" style="color:${stateColor}">${STATUS_LABEL[a.state]}</span>`;
      elCensus.appendChild(li);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* render loop (smooth interpolation between ticks)                       */
  /* ---------------------------------------------------------------------- */
  let lastTick = perfNow();
  function perfNow() { return (typeof performance !== "undefined" ? performance.now() : Date.now()); }

  function frame() {
    const now = perfNow();
    const since = now - lastTick;
    if (since >= TICK_MS) { lastTick = now; doTick(); }
    const f = Math.min(1, (now - lastTick) / TICK_MS);
    const ease = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;

    for (const a of agents) {
      a.px = a.fromx + (a.tx - a.fromx) * ease;
      a.py = a.fromy + (a.ty - a.fromy) * ease;
    }

    ctx.clearRect(0, 0, W, H);
    drawMap();
    [...agents].sort((p, q) => p.py - q.py).forEach(drawAgent);
    positionBubbles();
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------------- */
  /* resident bio modal                                                     */
  /* ---------------------------------------------------------------------- */
  const overlay = $("#modal-overlay");
  const modalBody = $("#modal-body");
  function openBio(id) {
    const a = agents.find((x) => x.def.id === id) || RESIDENTS.find((r) => r.id === id) && { def: RESIDENTS.find((r) => r.id === id) };
    if (!a || !overlay) return;
    const r = a.def;
    modalBody.innerHTML =
      `<div class="flex items-center justify-between border-b border-[color:var(--rule)] pb-3 mb-4">` +
        `<div class="flex items-center gap-3">` +
          `<span class="pixhab-dotpix" style="background:${r.cloth};width:14px;height:14px"></span>` +
          `<div><div class="pixhab-heading text-[18px]">${r.name}</div>` +
          `<div class="pixhab-mono text-[9px] uppercase tracking-[0.22em] text-[color:var(--mist)]">${r.role}</div></div>` +
        `</div>` +
        `<button id="modal-close" class="pixhab-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--whisper)] hover:text-[color:var(--ember)] transition-colors cursor-pointer">close ✕</button>` +
      `</div>` +
      `<p class="text-[14px] leading-relaxed text-[color:var(--paper-2)]">${r.bio}</p>` +
      `<div class="mt-4 pixhab-mono text-[9px] uppercase tracking-[0.22em] text-[color:var(--whisper)]">recent transcript</div>` +
      `<div class="mt-2 space-y-1.5">` +
        r.lines.slice(0, 3).map((l) => `<div class="border-l-2 pl-2.5 text-[12px] text-[color:var(--paper-2)]" style="border-color:${r.cloth}">“${l}”</div>`).join("") +
      `</div>`;
    overlay.classList.add("show");
    const close = $("#modal-close");
    if (close) close.onclick = closeBio;
  }
  function closeBio() { if (overlay) overlay.classList.remove("show"); }
  if (overlay) overlay.addEventListener("click", (e) => { if (e.target === overlay) closeBio(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeBio(); });

  // delegation: census + resident cards + canvas
  document.addEventListener("click", (e) => {
    const host = e.target.closest("[data-resident]");
    if (host) openBio(host.dataset.resident);
  });
  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * COLS;
    const y = (e.clientY - rect.top) / rect.height * ROWS;
    let best = null, bd = 99;
    for (const a of agents) {
      const d = Math.abs(a.px + 0.5 - x) + Math.abs(a.py + 0.5 - y);
      if (d < bd) { bd = d; best = a; }
    }
    if (best && bd < 1.4) openBio(best.def.id);
  });

  /* ---------------------------------------------------------------------- */
  /* login + adopt flow                                                     */
  /* ---------------------------------------------------------------------- */
  let connected = false;
  const adoptPanel = $("#adopt-panel");
  const myResidents = $("#myresidents-panel");

  function setWalletLabel(txt) {
    document.querySelectorAll("[data-wallet-btn]").forEach((b) => { b.textContent = txt; });
  }

  // bind every login button currently in the DOM (header + any in panels)
  function bindLoginButtons() {
    document.querySelectorAll("[data-wallet-btn]").forEach((b) => {
      if (b.dataset.bound) return;
      b.dataset.bound = "1";
      b.addEventListener("click", () => { if (!connected) login(); });
    });
  }

  // clicking LOGIN drops you straight into the signed-in state
  function login() {
    connected = true;
    setWalletLabel("LOGGED IN");
    document.querySelectorAll("[data-wallet-btn]").forEach((b) => {
      b.classList.remove("text-[color:var(--whisper)]", "text-[color:var(--paper-2)]");
      b.classList.add("text-[color:var(--ember)]", "border-[color:var(--ember)]");
    });
    renderAdoptPanel();
    renderMyResidents();
  }

  function renderAdoptPanel() {
    if (!adoptPanel) return;
    if (!connected) {
      adoptPanel.innerHTML =
        `<p class="pixhab-mono text-[11px] text-[color:var(--whisper)]">Log in to add a resident of your own to the town.</p>` +
        `<button data-wallet-btn class="mt-3 pixhab-mono w-full border border-[color:var(--rule-2)] py-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--paper-2)] transition-colors hover:border-[color:var(--ember)] hover:text-[color:var(--ember)] cursor-pointer">LOGIN</button>`;
      bindLoginButtons();
      return;
    }
    adoptPanel.innerHTML =
      `<div class="space-y-3 pixhab-fade-in">` +
        `<label class="block"><span class="pixhab-mono text-[9px] uppercase tracking-[0.22em] text-[color:var(--mist)]">Name</span>` +
          `<input id="adopt-name" maxlength="14" placeholder="give them a name" class="mt-1 w-full bg-[color:var(--ink)] border border-[color:var(--rule)] px-2.5 py-2 text-[13px] text-[color:var(--paper)] placeholder:text-[color:var(--whisper)] focus:border-[color:var(--ember)] focus:outline-none"/></label>` +
        `<label class="block"><span class="pixhab-mono text-[9px] uppercase tracking-[0.22em] text-[color:var(--mist)]">Role</span>` +
          `<input id="adopt-role" maxlength="22" placeholder="e.g. Lantern Keeper" class="mt-1 w-full bg-[color:var(--ink)] border border-[color:var(--rule)] px-2.5 py-2 text-[13px] text-[color:var(--paper)] placeholder:text-[color:var(--whisper)] focus:border-[color:var(--ember)] focus:outline-none"/></label>` +
        `<div><span class="pixhab-mono text-[9px] uppercase tracking-[0.22em] text-[color:var(--mist)]">Palette</span>` +
          `<div id="adopt-palette" class="mt-1 flex gap-2"></div></div>` +
        `<button id="adopt-go" class="pixhab-mono w-full border border-[color:var(--ember)] bg-[color:var(--ember)] py-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ink)] transition-colors hover:bg-transparent hover:text-[color:var(--ember)] cursor-pointer">Adopt → join next tick</button>` +
      `</div>`;
    const palettes = [["#d96638", "#f2c98a"], ["#6f8a4f", "#d6d6f0"], ["#e6b94a", "#2b1117"], ["#6c7e8a", "#c1432f"]];
    let chosen = 0;
    const pal = $("#adopt-palette");
    palettes.forEach((p, i) => {
      const sw = document.createElement("button");
      sw.type = "button";
      sw.style.cssText = `width:28px;height:28px;background:${p[0]};border:2px solid ${i === chosen ? "var(--paper)" : "var(--rule-2)"};cursor:pointer`;
      sw.innerHTML = `<span style="display:block;width:10px;height:10px;background:${p[1]};margin:auto"></span>`;
      sw.addEventListener("click", () => {
        chosen = i;
        [...pal.children].forEach((c, j) => c.style.borderColor = j === i ? "var(--paper)" : "var(--rule-2)");
      });
      pal.appendChild(sw);
    });
    $("#adopt-go").addEventListener("click", () => {
      const name = ($("#adopt-name").value || "Newcomer").trim().slice(0, 14);
      const role = ($("#adopt-role").value || "Wanderer").trim().slice(0, 22);
      adoptResident(name, role, palettes[chosen]);
    });
  }

  function adoptResident(name, role, palette) {
    const def = {
      id: "you-" + tickCount + "-" + Math.floor(rnd() * 999),
      name, role, hair: palette[1], cloth: palette[0],
      bio: `${name} is your resident — authored by you and walking the same square as everyone else. ${role} by trade, newly arrived at the south bank.`,
      lines: ["just got here. nice square.", "which way's the fountain?", "I think I'll like it here.", "morning! new in town."],
    };
    const [sx, sy] = [12, 11];
    agents.push({ def, tx: sx, ty: sy, px: sx, py: sy, fromx: sx, fromy: sy, state: STATE.WALK, facing: 1, talkUntil: 0, say: "", adopted: true });
    renderCensus();
    renderMyResidents();
    flashLog(`${name} joined the town — welcome to Field Station 01.`);
  }

  function flashLog(msg) {
    if (!elLog) return;
    if (!logSeeded) { elLog.innerHTML = ""; logSeeded = true; }
    const line = document.createElement("div");
    line.className = "pixhab-logline border-l-2 pl-2.5 py-1.5";
    line.style.borderColor = "var(--amber)";
    line.innerHTML = `<div class="pixhab-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--amber)]">tick ${String(tickCount).padStart(4, "0")} · adopt</div>` +
      `<div class="text-[12px] text-[color:var(--paper-2)] mt-0.5">${msg}</div>`;
    elLog.prepend(line);
  }

  function renderMyResidents() {
    if (!myResidents) return;
    const mine = agents.filter((a) => a.adopted);
    if (!connected) {
      myResidents.innerHTML = `<p class="pixhab-mono text-[11px] text-[color:var(--whisper)]">Log in to see residents you've added.</p>`;
      return;
    }
    if (!mine.length) {
      myResidents.innerHTML = `<p class="pixhab-mono text-[11px] text-[color:var(--whisper)]">No residents yet. Adopt one above — they'll appear here and on the next tick.</p>`;
      return;
    }
    myResidents.innerHTML = mine.map((a) =>
      `<div class="flex items-center gap-3 border border-[color:var(--rule)] bg-[color:var(--ink-2)] p-2 cursor-pointer hover:border-[color:var(--ember)] transition-colors" data-resident="${a.def.id}">` +
        `<span class="pixhab-dotpix" style="background:${a.def.cloth}"></span>` +
        `<span class="flex-1 text-[12px] text-[color:var(--paper)]">${a.def.name}<span class="block pixhab-mono text-[9px] uppercase tracking-[0.18em] text-[color:var(--mist)]">${a.def.role}</span></span>` +
        `<span class="pixhab-mono text-[8px] text-[color:var(--amber)]">YOURS</span>` +
      `</div>`).join("");
  }

  /* ---------------------------------------------------------------------- */
  /* "Meet the residents" cards                                             */
  /* ---------------------------------------------------------------------- */
  function renderCards() {
    const host = $("#resident-cards");
    if (!host) return;
    host.innerHTML = "";
    for (const r of RESIDENTS) {
      const li = document.createElement("li");
      li.innerHTML =
        `<button type="button" data-resident="${r.id}" class="group flex w-full cursor-pointer items-start gap-3 border border-[color:var(--rule)] bg-[color:var(--ink-2)] p-3 text-left transition-colors hover:border-[color:var(--ember)] hover:bg-[color:var(--ink-3)]">` +
          `<span class="grid grid-rows-2 overflow-hidden shrink-0" style="width:24px;height:24px">` +
            `<span style="background:${r.hair}"></span><span style="background:${r.cloth}"></span></span>` +
          `<span class="min-w-0 flex-1">` +
            `<span class="pixhab-heading text-[14px] text-[color:var(--paper)] group-hover:text-[color:var(--ember)] transition-colors">${r.name}</span>` +
            `<span class="block pixhab-mono mt-0.5 text-[9px] uppercase tracking-[0.22em] text-[color:var(--mist)]">${r.role}</span>` +
            `<span class="block mt-2 text-[12px] leading-relaxed text-[color:var(--paper-2)] line-clamp-2">${r.bio}</span>` +
          `</span>` +
        `</button>`;
      host.appendChild(li);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* boot                                                                   */
  /* ---------------------------------------------------------------------- */
  renderCards();
  updateStats();
  renderCensus();
  bindLoginButtons();
  renderAdoptPanel();
  renderMyResidents();
  requestAnimationFrame(frame);
})();
