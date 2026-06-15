(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const WORLD_W = 9600;
  const WORLD_H = 6400;
  const DPR_LIMIT = 2;
  const TAU = Math.PI * 2;
  const TILE = 64;
  const BOSS_X = 9020;
  const BOSS_Y = 5480;

  const WATER_RECTS = [
    { x: 0, y: 1088, w: 1056, h: 320 },
    { x: 1440, y: 1088, w: 8160, h: 320 },
    { x: 3520, y: 1344, w: 320, h: 832 },
    { x: 3520, y: 2560, w: 320, h: 3840 },
    { x: 3840, y: 3680, w: 2016, h: 320 },
    { x: 6240, y: 3680, w: 3360, h: 320 }
  ];

  const ROAD_RECTS = [
    { x: 128, y: 256, w: 1100, h: 128 },
    { x: 624, y: 384, w: 160, h: 460 },
    { x: 1056, y: 960, w: 384, h: 560 },
    { x: 1184, y: 1410, w: 1850, h: 128 },
    { x: 2944, y: 1500, w: 128, h: 760 },
    { x: 3400, y: 2176, w: 560, h: 384 },
    { x: 3900, y: 2010, w: 1680, h: 128 },
    { x: 5184, y: 3160, w: 980, h: 128 },
    { x: 5856, y: 3520, w: 384, h: 640 },
    { x: 6048, y: 4030, w: 2880, h: 128 },
    { x: 8120, y: 4940, w: 980, h: 128 },
    { x: 8860, y: 5050, w: 160, h: 520 }
  ];

  const FOREST_WALL_RECTS = [
    { x: 64, y: 96, w: 1248, h: 96 },
    { x: 64, y: 448, w: 480, h: 128 },
    { x: 864, y: 448, w: 560, h: 128 },
    { x: 480, y: 384, w: 96, h: 548 },
    { x: 832, y: 384, w: 96, h: 548 },
    { x: 1460, y: 848, w: 760, h: 128 },
    { x: 1480, y: 1552, w: 1430, h: 128 },
    { x: 2784, y: 1540, w: 112, h: 780 },
    { x: 3112, y: 1540, w: 112, h: 780 },
    { x: 3920, y: 1856, w: 1640, h: 112 },
    { x: 3920, y: 2190, w: 1640, h: 112 },
    { x: 5060, y: 3024, w: 980, h: 112 },
    { x: 5120, y: 3328, w: 720, h: 112 },
    { x: 5664, y: 3450, w: 112, h: 760 },
    { x: 6288, y: 4176, w: 2460, h: 112 },
    { x: 8060, y: 4784, w: 1060, h: 112 },
    { x: 8720, y: 5000, w: 112, h: 680 },
    { x: 9140, y: 5000, w: 112, h: 680 }
  ];

  const TERRAIN_SOLIDS = FOREST_WALL_RECTS;
  const PLACEMENT_BLOCKERS = WATER_RECTS.concat(FOREST_WALL_RECTS);

  const keys = new Set();
  const particles = [];
  const playerShots = [];
  const enemyShots = [];
  const floatText = [];
  const friendlyCritters = [];

  let audio = null;
  let lastTime = performance.now();
  let camera = { x: 0, y: 0, shake: 0 };
  let game;

  const palette = {
    night: "#0d1210",
    leaf: "#3f8f5a",
    leafLight: "#7ecb77",
    moss: "#203b2c",
    grass: "#315e3e",
    soil: "#6d5941",
    water: "#315d73",
    flower: "#f2e872",
    spinach: "#4ed06d",
    aiPink: "#e4549a",
    aiBlue: "#69d7ff",
    aiViolet: "#7e67ff",
    bark: "#674d34",
    cream: "#f5eed1",
    red: "#f15b5b",
    beaver: "#8a5a33",
    beaverDark: "#5c3924",
    plank: "#b77b43",
    mountain: "#56605d",
    snow: "#cfd8cf",
    shadow: "rgba(4, 7, 6, 0.42)"
  };

  const rand = mulberry32(946413);
  const decor = buildDecor();
  const terrainDots = buildTerrainDots();

  function mulberry32(seed) {
    return function random() {
      let t = seed += 0x6d2b79f5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function angleTo(a, b) {
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  function vectorFromAngle(angle, speed) {
    return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
  }

  function circleHit(a, b, extra = 0) {
    return Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + extra;
  }

  function rectCircleHit(circle, rect, extra = 0) {
    const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
    const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
    return Math.hypot(circle.x - closestX, circle.y - closestY) <= circle.r + extra;
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function rectHitsAny(rect, rects) {
    return rects.some((item) => rectsOverlap(rect, item));
  }

  function pointInRect(x, y, rect, margin = 0) {
    return x >= rect.x - margin && x <= rect.x + rect.w + margin && y >= rect.y - margin && y <= rect.y + rect.h + margin;
  }

  function pointHitsAny(x, y, rects, margin = 0) {
    return rects.some((rect) => pointInRect(x, y, rect, margin));
  }

  function tileHash(x, y) {
    let n = Math.imul(Math.floor(x / TILE) + 374761393, 668265263) ^ Math.imul(Math.floor(y / TILE) + 1442695041, 2246822519);
    n = (n ^ (n >>> 13)) >>> 0;
    return (n % 1000) / 1000;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
    const width = Math.floor(window.innerWidth * dpr);
    const height = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function screenSize() {
    return {
      w: canvas.width / Math.min(window.devicePixelRatio || 1, DPR_LIMIT),
      h: canvas.height / Math.min(window.devicePixelRatio || 1, DPR_LIMIT)
    };
  }

  function startGame() {
    if (game.state !== "menu") return;
    game.state = "play";
    game.time = 0;
    game.introTimer = 32;
    game.defenseAwake = false;
    game.message = "CISZA W LESIE";
    game.messageTimer = 3.6;
    game.player.punchCooldown = 0.35;
    playTone("pickup");
  }

  function wakeDefense(serverIndex = null) {
    if (game.state !== "play" || game.defenseAwake) return;
    game.defenseAwake = true;
    game.introTimer = 0;
    game.message = "AI SIE BUDZI";
    game.messageTimer = 2.4;
    camera.shake = Math.max(camera.shake, 5);
    if (serverIndex !== null) {
      for (const enemy of game.enemies) {
        if (enemy.serverIndex === serverIndex) enemy.aggro = true;
      }
    }
  }

  function roomBounds(server) {
    return {
      x: server.x - server.w / 2,
      y: server.y - server.h / 2,
      w: server.w,
      h: server.h
    };
  }

  function pointInRoom(server, entity, margin = 0) {
    const b = roomBounds(server);
    return entity.x > b.x + server.wall - margin &&
      entity.x < b.x + b.w - server.wall + margin &&
      entity.y > b.y + server.wall - margin &&
      entity.y < b.y + b.h - server.wall + margin;
  }

  function roomWalls(server) {
    const b = roomBounds(server);
    const wall = server.wall;
    const door = server.door;
    const leftDoor = server.x - door / 2;
    const rightDoor = server.x + door / 2;
    return [
      { x: b.x, y: b.y, w: b.w, h: wall },
      { x: b.x, y: b.y, w: wall, h: b.h },
      { x: b.x + b.w - wall, y: b.y, w: wall, h: b.h },
      { x: b.x, y: b.y + b.h - wall, w: leftDoor - b.x, h: wall },
      { x: rightDoor, y: b.y + b.h - wall, w: b.x + b.w - rightDoor, h: wall }
    ];
  }

  function pushOutOfRect(entity, rect) {
    const closestX = clamp(entity.x, rect.x, rect.x + rect.w);
    const closestY = clamp(entity.y, rect.y, rect.y + rect.h);
    let dx = entity.x - closestX;
    let dy = entity.y - closestY;
    let d2 = dx * dx + dy * dy;
    if (d2 >= entity.r * entity.r) return;

    if (d2 === 0) {
      const left = Math.abs(entity.x - rect.x);
      const right = Math.abs(rect.x + rect.w - entity.x);
      const top = Math.abs(entity.y - rect.y);
      const bottom = Math.abs(rect.y + rect.h - entity.y);
      const min = Math.min(left, right, top, bottom);
      if (min === left) dx = -1;
      else if (min === right) dx = 1;
      else if (min === top) dy = -1;
      else dy = 1;
      d2 = 1;
    }

    const d = Math.sqrt(d2);
    const push = entity.r - d;
    entity.x += dx / d * push;
    entity.y += dy / d * push;
  }

  function newGame() {
    const servers = [
      makeServer(720, 520, "Moss Cache"),
      makeServer(2320, 640, "Hive Gate"),
      makeServer(3000, 1900, "Pine Relay"),
      makeServer(4650, 2100, "Root Rack"),
      makeServer(6200, 3300, "Fern Array"),
      makeServer(8200, 5000, "River Node")
    ];

    const blockers = [
      makeBlocker(1248, 1248, 360, 360, "Moss Sluice"),
      makeBlocker(3680, 2368, 360, 360, "Canopy Lock"),
      makeBlocker(6048, 3840, 360, 360, "River Latch")
    ];

    const planks = [
      makePlank(620, 690),
      makePlank(1190, 1000),
      makePlank(2110, 1030),
      makePlank(3440, 2250),
      makePlank(4200, 2020),
      makePlank(5910, 3560),
      makePlank(6900, 4100),
      makePlank(8200, 5020),
      makePlank(8940, 5260)
    ];

    const enemies = [
      makeEnemy("cat", 660, 650, 0),
      makeEnemy("bot", 820, 500, 0),
      makeEnemy("drone", 610, 430, 0),
      makeEnemy("dog", 2240, 760, 1),
      makeEnemy("bot", 2400, 610, 1),
      makeEnemy("drone", 2220, 540, 1),
      makeEnemy("cat", 2920, 2040, 2),
      makeEnemy("bot", 3090, 1840, 2),
      makeEnemy("sentinel", 3160, 1980, 2),
      makeEnemy("dog", 4560, 2215, 3),
      makeEnemy("bot", 4740, 2050, 3),
      makeEnemy("drone", 4850, 2180, 3),
      makeEnemy("cat", 6120, 3170, 4),
      makeEnemy("bot", 6300, 3330, 4),
      makeEnemy("sentinel", 6420, 3190, 4),
      makeEnemy("dog", 8120, 5160, 5),
      makeEnemy("bot", 8300, 4920, 5),
      makeEnemy("drone", 8440, 5060, 5),
      makeEnemy("cat", 1700, 830, null),
      makeEnemy("dog", 5250, 1880, null),
      makeEnemy("drone", 7400, 4260, null)
    ];

    game = {
      state: "menu",
      time: 0,
      message: "NATURAI",
      messageTimer: 2.8,
      introTimer: 32,
      defenseAwake: false,
      blockers,
      planks,
      servers,
      enemies,
      pickups: [
        { type: "daisy", x: 760, y: 760, r: 17, taken: false, bob: 0 },
        { type: "daisy", x: 2140, y: 1030, r: 17, taken: false, bob: 1.2 },
        { type: "daisy", x: 4380, y: 2064, r: 17, taken: false, bob: 2.3 },
        { type: "daisy", x: 5860, y: 3560, r: 17, taken: false, bob: 3.7 },
        { type: "daisy", x: 8240, y: 5000, r: 17, taken: false, bob: 4.6 },
        { type: "spinach", x: 640, y: 680, r: 16, taken: false, respawn: 0, bob: 0.4 },
        { type: "spinach", x: 980, y: 675, r: 16, taken: false, respawn: 0, bob: 2.4 },
        { type: "spinach", x: 2210, y: 1030, r: 16, taken: false, respawn: 0, bob: 1 },
        { type: "spinach", x: 4480, y: 2060, r: 16, taken: false, respawn: 0, bob: 3 },
        { type: "spinach", x: 8240, y: 5080, r: 16, taken: false, respawn: 0, bob: 5 },
        { type: "spinach", x: 8940, y: 5360, r: 16, taken: false, respawn: 0, bob: 6 }
      ],
      boss: makeBoss(),
      player: {
        x: 230,
        y: 300,
        r: 16,
        hp: 10,
        maxHp: 10,
        speed: 178,
        facing: 0,
        punchCooldown: 0,
        throwCooldown: 0,
        hurtCooldown: 0,
        shield: 0,
        tailLevel: 0,
        heldPlank: null,
        dash: 0,
        step: 0,
        swimming: false
      }
    };

    particles.length = 0;
    playerShots.length = 0;
    enemyShots.length = 0;
    floatText.length = 0;
    friendlyCritters.length = 0;
  }

  function makeServer(x, y, name) {
    return {
      x,
      y,
      w: 304,
      h: 224,
      wall: 18,
      door: 82,
      r: 31,
      hp: 12,
      maxHp: 12,
      destroyed: false,
      name,
      pulse: rand() * TAU
    };
  }

  function makeBlocker(x, y, w, h, name) {
    return {
      x: x - w / 2,
      y: y - h / 2,
      cx: x,
      cy: y,
      w,
      h,
      r: Math.max(w, h) * 0.5,
      hp: 7,
      maxHp: 7,
      awake: false,
      destroyed: false,
      shootCooldown: 0.9,
      pulse: rand() * TAU,
      name
    };
  }

  function makePlank(x, y) {
    return {
      x,
      y,
      r: 23,
      w: 56,
      h: 14,
      taken: false,
      bob: rand() * TAU,
      angle: rand() > 0.5 ? 0.18 : -0.18
    };
  }

  function makeEnemy(type, x, y, serverIndex) {
    const base = {
      cat: { r: 13, hp: 2.6, speed: 58, damage: 0.5, range: 0, color: "#9aa7a8" },
      dog: { r: 17, hp: 4, speed: 54, damage: 0.5, range: 0, color: "#7f8f92" },
      bot: { r: 18, hp: 5, speed: 42, damage: 0.5, range: 0, color: "#9ca7aa" },
      drone: { r: 15, hp: 3.3, speed: 48, damage: 0.5, range: 245, color: "#9fe7ff" },
      sentinel: { r: 21, hp: 6.5, speed: 34, damage: 1, range: 195, color: "#c3b8ff" }
    }[type];

    return {
      type,
      x,
      y,
      ox: x,
      oy: y,
      r: base.r,
      hp: base.hp,
      maxHp: base.hp,
      speed: base.speed,
      damage: base.damage,
      range: base.range,
      color: base.color,
      serverIndex,
      aggro: false,
      hitFlash: 0,
      hurtCooldown: 0,
      shootCooldown: rand() * 1.2,
      wander: rand() * TAU,
      phase: rand() * TAU
    };
  }

  function makeBoss() {
    return {
      x: BOSS_X,
      y: BOSS_Y,
      r: 54,
      hp: 30,
      maxHp: 30,
      hurtCooldown: 0,
      hitFlash: 0,
      shootCooldown: 1.4,
      pulse: 0,
      defeated: false,
      exposedText: false
    };
  }

  function buildDecor() {
    const items = [];
    let attempts = 0;
    while (items.length < 640 && attempts < 5000) {
      attempts += 1;
      const x = 80 + rand() * (WORLD_W - 160);
      const y = 90 + rand() * (WORLD_H - 180);
      const test = { x: x - 44, y: y - 44, w: 88, h: 88 };
      if (rectHitsAny(test, PLACEMENT_BLOCKERS) || rectHitsAny(test, ROAD_RECTS)) continue;
      if (Math.hypot(x - 230, y - 300) < 260) continue;
      const nearBoss = Math.hypot(x - BOSS_X, y - BOSS_Y) < 420;
      const typeRoll = rand();
      let type = "tree";
      if (typeRoll > 0.78) type = "rock";
      if (typeRoll > 0.9) type = "flower";
      if (nearBoss && type === "tree") type = "antennaTree";
      items.push({
        type,
        x,
        y,
        r: type === "tree" || type === "antennaTree" ? 24 + rand() * 18 : 8 + rand() * 12,
        hue: rand(),
        phase: rand() * TAU
      });
    }
    return items;
  }

  function buildTerrainDots() {
    const dots = [];
    for (let i = 0; i < 1400; i += 1) {
      const x = rand() * WORLD_W;
      const y = rand() * WORLD_H;
      if (pointHitsAny(x, y, PLACEMENT_BLOCKERS, 12) || pointHitsAny(x, y, ROAD_RECTS, 12)) continue;
      dots.push({
        x,
        y,
        r: 1 + rand() * 3,
        c: rand() > 0.7 ? "rgba(126, 203, 119, 0.16)" : "rgba(245, 238, 209, 0.07)"
      });
    }
    return dots;
  }

  function togglePause() {
    if (!game) return;
    if (game.state === "play") {
      game.state = "paused";
      game.message = "PAUZA";
      game.messageTimer = 999;
    } else if (game.state === "paused") {
      game.state = "play";
      game.messageTimer = 0;
    }
  }

  function update(dt) {
    if (!game) return;
    game.time += dt;

    if (game.state === "menu") {
      updateParticles(dt);
      updateCamera(dt);
      return;
    }

    if (keys.has("KeyR") && game.state !== "play") {
      newGame();
      return;
    }

    if (game.state === "paused") {
      updateCamera(dt);
      return;
    }

    if (game.state !== "play") {
      updateParticles(dt);
      updateCamera(dt);
      return;
    }

    game.messageTimer = Math.max(0, game.messageTimer - dt);
    game.introTimer = Math.max(0, game.introTimer - dt);
    updatePlayer(dt);
    updatePickups(dt);
    updatePlanks(dt);
    updateBlockers(dt);
    updateEnemies(dt);
    updateBoss(dt);
    updateShots(dt);
    updateParticles(dt);
    updateFloatText(dt);
    updateCamera(dt);

    if (game.player.hp <= 0) {
      game.state = "dead";
      game.message = "SIGNAL LOST";
      game.messageTimer = 999;
      playTone("down");
    }
  }

  function updatePlayer(dt) {
    const p = game.player;
    let dx = 0;
    let dy = 0;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
    if (keys.has("KeyW") || keys.has("ArrowUp")) dy -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) dy += 1;

    if (dx || dy) {
      const length = Math.hypot(dx, dy);
      dx /= length;
      dy /= length;
      p.facing = Math.atan2(dy, dx);
      p.step += dt * 12;
    }

    const waterBefore = pointHitsAny(p.x, p.y, WATER_RECTS, p.r * 0.5);
    const speed = p.speed * (p.shield > 0 ? 0.96 : 1) * (waterBefore ? 0.88 : 1);
    moveCircle(p, dx * speed * dt, dy * speed * dt);
    p.swimming = pointHitsAny(p.x, p.y, WATER_RECTS, p.r * 0.55);

    if (!game.defenseAwake && game.introTimer <= 0) {
      const roomIndex = game.servers.findIndex((server) => !server.destroyed && pointInRoom(server, p, 6));
      if (roomIndex >= 0) wakeDefense(roomIndex);
    }

    p.punchCooldown = Math.max(0, p.punchCooldown - dt);
    p.throwCooldown = Math.max(0, p.throwCooldown - dt);
    p.hurtCooldown = Math.max(0, p.hurtCooldown - dt);
    p.shield = Math.max(0, p.shield - dt);

    if (keys.has("KeyE")) grabPlank();
    if (keys.has("Space")) punch();
    if (keys.has("KeyJ") || keys.has("KeyK")) throwPlank();
  }

  function moveCircle(entity, dx, dy) {
    entity.x = clamp(entity.x + dx, entity.r + 18, WORLD_W - entity.r - 18);
    entity.y = clamp(entity.y + dy, entity.r + 18, WORLD_H - entity.r - 18);

    for (const solid of TERRAIN_SOLIDS) {
      pushOutOfRect(entity, solid);
    }

    for (const item of decor) {
      if (item.type === "flower") continue;
      const radius = item.type === "rock" ? item.r * 0.75 : item.r * 0.72;
      const push = entity.r + radius - Math.hypot(entity.x - item.x, entity.y - item.y);
      if (push > 0) {
        const a = Math.atan2(entity.y - item.y, entity.x - item.x);
        entity.x += Math.cos(a) * push;
        entity.y += Math.sin(a) * push;
      }
    }

    for (const blocker of game.blockers) {
      if (!blocker.destroyed) pushOutOfRect(entity, blocker);
    }

    for (const server of game.servers) {
      if (server.destroyed) continue;
      for (const wall of roomWalls(server)) pushOutOfRect(entity, wall);
      const push = entity.r + server.r + 8 - Math.hypot(entity.x - server.x, entity.y - server.y);
      if (push > 0) {
        const a = Math.atan2(entity.y - server.y, entity.x - server.x);
        entity.x += Math.cos(a) * push;
        entity.y += Math.sin(a) * push;
      }
    }

    const boss = game.boss;
    if (!boss.defeated && entity !== boss) {
      const push = entity.r + boss.r - 6 - Math.hypot(entity.x - boss.x, entity.y - boss.y);
      if (push > 0) {
        const a = Math.atan2(entity.y - boss.y, entity.x - boss.x);
        entity.x += Math.cos(a) * push;
        entity.y += Math.sin(a) * push;
      }
    }
  }

  function punch() {
    const p = game.player;
    if (p.punchCooldown > 0) return;
    p.punchCooldown = 0.46;
    camera.shake = Math.max(camera.shake, 2);
    playTone("punch");

    const biteReach = 28 + Math.min(28, p.tailLevel * 2);
    const hit = {
      x: p.x + Math.cos(p.facing) * biteReach,
      y: p.y + Math.sin(p.facing) * biteReach,
      r: 24
    };
    const damage = 1.7 + p.tailLevel * 0.75;

    spawnArc(hit.x, hit.y, p.facing, palette.beaverDark);
    damageWorld(hit, damage, p.facing);
  }

  function grabPlank() {
    const p = game.player;
    if (p.heldPlank) return;
    let best = null;
    let bestDistance = 62;
    for (const plank of game.planks) {
      if (plank.taken) continue;
      const d = Math.hypot(plank.x - p.x, plank.y - p.y);
      if (d < bestDistance) {
        best = plank;
        bestDistance = d;
      }
    }
    if (!best) return;
    best.taken = true;
    p.heldPlank = best;
    playTone("pickup");
  }

  function throwPlank() {
    const p = game.player;
    if (p.throwCooldown > 0) return;
    if (!p.heldPlank) {
      grabPlank();
      return;
    }
    p.throwCooldown = 0.55;
    const v = vectorFromAngle(p.facing, 520);
    playerShots.push({
      type: "plank",
      x: p.x + Math.cos(p.facing) * 26,
      y: p.y + Math.sin(p.facing) * 26,
      vx: v.x,
      vy: v.y,
      r: 18,
      damage: 6.4 + p.tailLevel * 0.35,
      life: 1.45,
      angle: p.facing,
      spin: 7,
      color: palette.plank
    });
    p.heldPlank = null;
    camera.shake = Math.max(camera.shake, 3);
    playTone("shoot");
  }

  function updatePlanks(dt) {
    for (const plank of game.planks) {
      plank.bob += dt * 2;
    }
    const held = game.player.heldPlank;
    if (held) {
      held.x = game.player.x + Math.cos(game.player.facing + 0.65) * 22;
      held.y = game.player.y + Math.sin(game.player.facing + 0.65) * 22;
      held.angle = game.player.facing;
    }
  }

  function damageWorld(hit, damage, direction) {
    for (const enemy of game.enemies) {
      if (enemy.hp > 0 && circleHit(hit, enemy)) {
        hurtEnemy(enemy, damage, direction);
      }
    }

    for (const blocker of game.blockers) {
      if (!blocker.destroyed && rectCircleHit(hit, blocker, 8)) {
        hurtBlocker(blocker, damage);
      }
    }

    for (const server of game.servers) {
      if (!server.destroyed && circleHit(hit, server, 8)) {
        hurtServer(server, damage);
      }
    }

    const boss = game.boss;
    if (!boss.defeated && circleHit(hit, boss, 8)) {
      hurtBoss(damage);
    }
  }

  function hurtBlocker(blocker, damage) {
    if (!blocker.awake) {
      blocker.awake = true;
      blocker.shootCooldown = 0.9;
      game.message = blocker.name + " ACTIVE";
      game.messageTimer = 2.2;
      playTone("blocked");
    }
    blocker.hp -= damage;
    blocker.pulse += 1;
    camera.shake = Math.max(camera.shake, 3);
    burst(blocker.cx, blocker.cy, 10, blocker.awake ? palette.aiPink : palette.aiBlue);
    if (blocker.hp <= 0 && !blocker.destroyed) {
      blocker.destroyed = true;
      blocker.awake = false;
      game.message = blocker.name + " OPEN";
      game.messageTimer = 2.2;
      burst(blocker.cx, blocker.cy, 42, palette.leafLight);
      playTone("objectBreak");
      playTone("restore");
    }
  }

  function updateBlockers(dt) {
    const p = game.player;
    for (const blocker of game.blockers) {
      if (blocker.destroyed) continue;
      blocker.pulse += dt * (blocker.awake ? 5 : 1.5);
      if (!blocker.awake) continue;
      blocker.shootCooldown = Math.max(0, blocker.shootCooldown - dt);
      const d = Math.hypot(blocker.cx - p.x, blocker.cy - p.y);
      if (d < 360 && blocker.shootCooldown <= 0) {
        blocker.shootCooldown = 2.15;
        shootBlocker(blocker, p);
      }
    }
  }

  function shootBlocker(blocker, target) {
    const a = Math.atan2(target.y - blocker.cy, target.x - blocker.cx);
    const v = vectorFromAngle(a, 150);
    enemyShots.push({
      x: blocker.cx,
      y: blocker.cy,
      vx: v.x,
      vy: v.y,
      r: 8,
      damage: 0.5,
      life: 2.8,
      color: palette.aiPink,
      force: true
    });
    playTone("enemyShot");
  }

  function hurtEnemy(enemy, damage, direction) {
    wakeDefense(enemy.serverIndex);
    enemy.hp -= damage;
    enemy.aggro = true;
    enemy.hitFlash = 0.16;
    const knock = vectorFromAngle(direction, 16);
    enemy.x += knock.x;
    enemy.y += knock.y;
    burst(enemy.x, enemy.y, 8, enemy.type === "bot" || enemy.type === "sentinel" ? palette.aiBlue : palette.aiPink);
    playTone("hit");

    if (enemy.hp <= 0) {
      playTone("enemyDown");
      burst(enemy.x, enemy.y, 20, enemy.color);
      if (enemy.type === "cat" || enemy.type === "dog") {
        friendlyCritters.push({
          type: enemy.type,
          x: enemy.x,
          y: enemy.y,
          r: enemy.r,
          phase: rand() * TAU,
          life: 18
        });
      }
    }
  }

  function hurtServer(server, damage) {
    wakeDefense(game.servers.indexOf(server));
    server.hp -= damage;
    server.pulse += 0.9;
    camera.shake = Math.max(camera.shake, 5);
    burst(server.x, server.y, 12, palette.aiBlue);
    playTone("core");

    for (const enemy of game.enemies) {
      if (enemy.serverIndex === game.servers.indexOf(server)) enemy.aggro = true;
    }

    if (server.hp <= 0 && !server.destroyed) {
      server.destroyed = true;
      server.hp = 0;
      game.message = server.name + " DOWN";
      game.messageTimer = 2.6;
      burst(server.x, server.y, 64, palette.leafLight);
      camera.shake = Math.max(camera.shake, 14);
      playTone("objectBreak");
      playTone("restore");
      spawnFriendlyRing(server.x, server.y);
    }
  }

  function hurtBoss(damage) {
    wakeDefense(null);
    const boss = game.boss;
    const coresLeft = coresLeftCount();
    if (coresLeft > 0) {
      boss.hitFlash = 0.12;
      game.message = "AI SHIELD: " + coresLeft + " CORES";
      game.messageTimer = 1.4;
      burst(boss.x, boss.y, 10, palette.aiViolet);
      playTone("blocked");
      return;
    }

    boss.hp -= damage;
    boss.hitFlash = 0.16;
    boss.pulse += 1.4;
    camera.shake = Math.max(camera.shake, 7);
    burst(boss.x, boss.y, 18, palette.aiPink);
    playTone("hit");
    if (boss.hp <= 0 && !boss.defeated) {
      boss.defeated = true;
      boss.hp = 0;
      game.state = "won";
      game.message = "NATURAI RESTORED";
      game.messageTimer = 999;
      burst(boss.x, boss.y, 160, palette.leafLight);
      camera.shake = 22;
      playTone("win");
    }
  }

  function updatePickups(dt) {
    for (const pickup of game.pickups) {
      pickup.bob += dt * 3;
      if (pickup.taken) {
        pickup.respawn -= dt;
        if (pickup.type === "spinach" && pickup.respawn <= 0) pickup.taken = false;
        continue;
      }
      if (circleHit(game.player, pickup, 8)) {
        pickup.taken = true;
        if (pickup.type === "daisy") {
          game.player.tailLevel += 1;
          game.message = "OGON +1";
          game.messageTimer = 2.4;
          burst(pickup.x, pickup.y, 30, palette.flower);
          playTone("pickup");
        } else {
          pickup.respawn = 24;
          game.player.shield = Math.min(14, game.player.shield + 9.5);
          game.message = "SPINACH SHIELD";
          game.messageTimer = 1.9;
          burst(pickup.x, pickup.y, 28, palette.spinach);
          playTone("shield");
        }
      }
    }
  }

  function updateEnemies(dt) {
    const p = game.player;
    for (const enemy of game.enemies) {
      if (enemy.hp <= 0) continue;
      enemy.phase += dt * 2.4;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.hurtCooldown = Math.max(0, enemy.hurtCooldown - dt);
      enemy.shootCooldown = Math.max(0, enemy.shootCooldown - dt);

      const home = { x: enemy.ox, y: enemy.oy };
      const toPlayer = Math.hypot(enemy.x - p.x, enemy.y - p.y);
      const server = enemy.serverIndex === null ? null : game.servers[enemy.serverIndex];
      const serverAlive = server && !server.destroyed;

      if (!game.defenseAwake) {
        enemy.aggro = false;
        enemy.wander += dt * 0.32;
        const drift = enemy.speed * 0.14;
        if (dist(enemy, home) > 78) {
          const a = angleTo(enemy, home);
          moveCircle(enemy, Math.cos(a) * drift * dt, Math.sin(a) * drift * dt);
        } else {
          moveCircle(enemy, Math.cos(enemy.wander) * drift * dt, Math.sin(enemy.wander) * drift * dt);
        }
        continue;
      }

      if (toPlayer < 230 || (enemy.aggro && toPlayer < 500) || (serverAlive && dist(enemy, server) > 210)) {
        enemy.aggro = true;
      } else if (toPlayer > 640) {
        enemy.aggro = false;
      }

      let target = enemy.aggro ? p : home;
      if (serverAlive && !enemy.aggro) target = server;

      const a = angleTo(enemy, target);
      let speed = enemy.speed;
      if (!enemy.aggro && dist(enemy, home) < 110) {
        enemy.wander += dt * 0.46;
        speed *= 0.34;
        moveCircle(enemy, Math.cos(enemy.wander) * speed * dt, Math.sin(enemy.wander) * speed * dt);
      } else if (enemy.range > 0 && enemy.aggro && toPlayer < enemy.range * 0.76) {
        moveCircle(enemy, -Math.cos(a) * speed * 0.28 * dt, -Math.sin(a) * speed * 0.28 * dt);
      } else {
        moveCircle(enemy, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt);
      }

      if (enemy.range > 0 && enemy.aggro && toPlayer < enemy.range && enemy.shootCooldown <= 0) {
        enemy.shootCooldown = enemy.type === "sentinel" ? 1.85 : 2.15;
        shootEnemy(enemy, p);
      }

      if (enemy.aggro && circleHit(enemy, p, 2)) {
        hurtPlayer(enemy.damage, angleTo(enemy, p));
      }
    }

    for (const critter of friendlyCritters) {
      critter.phase += dt * 3.4;
      critter.life -= dt;
      critter.x += Math.cos(critter.phase) * 9 * dt;
      critter.y += Math.sin(critter.phase * 0.7) * 8 * dt;
    }
    for (let i = friendlyCritters.length - 1; i >= 0; i -= 1) {
      if (friendlyCritters[i].life <= 0) friendlyCritters.splice(i, 1);
    }
  }

  function shootEnemy(enemy, target) {
    const a = angleTo(enemy, target);
    const speed = enemy.type === "sentinel" ? 165 : 190;
    const v = vectorFromAngle(a, speed);
    enemyShots.push({
      x: enemy.x,
      y: enemy.y,
      vx: v.x,
      vy: v.y,
      r: enemy.type === "sentinel" ? 9 : 7,
      damage: enemy.type === "sentinel" ? 0.8 : 0.5,
      life: 2.4,
      color: enemy.type === "sentinel" ? palette.aiViolet : palette.aiBlue
    });
    playTone("enemyShot");
  }

  function updateBoss(dt) {
    const boss = game.boss;
    if (boss.defeated) return;

    boss.pulse += dt * 2;
    boss.hitFlash = Math.max(0, boss.hitFlash - dt);
    boss.hurtCooldown = Math.max(0, boss.hurtCooldown - dt);
    boss.shootCooldown = Math.max(0, boss.shootCooldown - dt);

    const p = game.player;
    const d = dist(boss, p);
    if (!game.defenseAwake) return;
    if (d < 520 && boss.shootCooldown <= 0) {
      const exposed = coresLeftCount() === 0;
      boss.shootCooldown = exposed ? 1.25 : 1.75;
      const waves = exposed ? 2 : 1;
      for (let i = 0; i < waves; i += 1) {
        const a = angleTo(boss, p) + (i - (waves - 1) / 2) * 0.28;
        const v = vectorFromAngle(a, exposed ? 215 : 180);
        enemyShots.push({
          x: boss.x + Math.cos(a) * 54,
          y: boss.y + Math.sin(a) * 54,
          vx: v.x,
          vy: v.y,
          r: exposed ? 10 : 8,
          damage: exposed ? 0.9 : 0.6,
          life: 2.6,
          color: exposed ? palette.aiPink : palette.aiViolet
        });
      }
      playTone("enemyShot");
    }

    if (d < boss.r + p.r + 4) {
      hurtPlayer(2, angleTo(boss, p));
    }

    if (coresLeftCount() === 0 && !boss.exposedText) {
      boss.exposedText = true;
      game.message = "ROOT AI EXPOSED";
      game.messageTimer = 2.8;
      playTone("exposed");
    }
  }

  function shotHitsSolid(shot, includeBlockers = true) {
    for (const solid of TERRAIN_SOLIDS) {
      if (rectCircleHit(shot, solid, 0)) return true;
    }
    for (const server of game.servers) {
      if (server.destroyed) continue;
      for (const wall of roomWalls(server)) {
        if (rectCircleHit(shot, wall, 0)) return true;
      }
    }
    if (includeBlockers) {
      for (const blocker of game.blockers) {
        if (!blocker.destroyed && rectCircleHit(shot, blocker, 0)) return true;
      }
    }
    return false;
  }

  function updateShots(dt) {
    for (const shot of playerShots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      shot.vx *= 0.995;
      shot.vy *= 0.995;
      if (shot.type === "plank") shot.angle += shot.spin * dt;
      trail(shot.x, shot.y, shot.color);

      if (shotHitsSolid(shot, false)) {
        burst(shot.x, shot.y, 8, shot.color);
        shot.life = -1;
        continue;
      }

      for (const enemy of game.enemies) {
        if (enemy.hp > 0 && circleHit(shot, enemy)) {
          hurtEnemy(enemy, shot.damage, Math.atan2(shot.vy, shot.vx));
          shot.life = -1;
          break;
        }
      }
      if (shot.life > 0) {
        for (const blocker of game.blockers) {
          if (!blocker.destroyed && rectCircleHit(shot, blocker, 6)) {
            hurtBlocker(blocker, shot.damage);
            shot.life = -1;
            break;
          }
        }
      }
      if (shot.life > 0) {
        for (const server of game.servers) {
          if (!server.destroyed && circleHit(shot, server, 6)) {
            hurtServer(server, shot.damage);
            shot.life = -1;
            break;
          }
        }
      }
      if (shot.life > 0 && !game.boss.defeated && circleHit(shot, game.boss, 4)) {
        hurtBoss(shot.damage);
        shot.life = -1;
      }
    }

    for (const shot of enemyShots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;
      shot.vx *= 1.002;
      shot.vy *= 1.002;
      trail(shot.x, shot.y, shot.color);
      if (shotHitsSolid(shot, true)) {
        burst(shot.x, shot.y, 6, shot.color);
        shot.life = -1;
        continue;
      }
      if (circleHit(shot, game.player)) {
        hurtPlayer(shot.damage, Math.atan2(shot.vy, shot.vx), shot.force);
        shot.life = -1;
      }
    }

    pruneShots(playerShots);
    pruneShots(enemyShots);
  }

  function pruneShots(shots) {
    for (let i = shots.length - 1; i >= 0; i -= 1) {
      const s = shots[i];
      if (s.life <= 0 || s.x < -60 || s.y < -60 || s.x > WORLD_W + 60 || s.y > WORLD_H + 60) {
        shots.splice(i, 1);
      }
    }
  }

  function hurtPlayer(damage, direction, force = false) {
    const p = game.player;
    if ((!force && !game.defenseAwake) || p.hurtCooldown > 0 || game.state !== "play") return;
    p.hurtCooldown = 0.78;
    if (p.shield > 0) {
      p.shield = Math.max(0, p.shield - damage * 1.1);
      damage *= 0.15;
      burst(p.x, p.y, 16, palette.spinach);
      playTone("blocked");
    } else {
      burst(p.x, p.y, 14, palette.red);
      playTone("hurt");
    }
    const tailLoss = damage * (p.shield > 0 ? 0.15 : 0.45);
    p.tailLevel = Math.max(0, p.tailLevel - tailLoss);
    p.hp -= damage;
    p.x += Math.cos(direction) * 12;
    p.y += Math.sin(direction) * 12;
    camera.shake = Math.max(camera.shake, 5);
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
      p.age += dt;
      p.r *= 0.992;
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      if (particles[i].life <= 0) particles.splice(i, 1);
    }
  }

  function updateFloatText(dt) {
    for (const t of floatText) {
      t.y -= dt * 24;
      t.life -= dt;
    }
    for (let i = floatText.length - 1; i >= 0; i -= 1) {
      if (floatText[i].life <= 0) floatText.splice(i, 1);
    }
  }

  function updateCamera(dt) {
    const size = screenSize();
    const p = game.player;
    const targetX = clamp(p.x - size.w / 2, 0, WORLD_W - size.w);
    const targetY = clamp(p.y - size.h / 2, 0, WORLD_H - size.h);
    camera.x = lerp(camera.x, targetX, 1 - Math.pow(0.001, dt));
    camera.y = lerp(camera.y, targetY, 1 - Math.pow(0.001, dt));
    camera.shake = Math.max(0, camera.shake - dt * 28);
  }

  function render() {
    resize();
    const size = screenSize();
    ctx.clearRect(0, 0, size.w, size.h);

    const shakeX = camera.shake ? (rand() - 0.5) * camera.shake : 0;
    const shakeY = camera.shake ? (rand() - 0.5) * camera.shake : 0;

    ctx.save();
    ctx.translate(Math.round(-camera.x + shakeX), Math.round(-camera.y + shakeY));
    drawWorld();
    drawForestWalls();
    drawDecor();
    drawPickups();
    drawPlanks();
    drawBlockers();
    drawServers();
    drawFriendlyCritters();
    drawBoss();
    drawEnemies();
    drawShots();
    drawPlayer();
    drawParticles();
    ctx.restore();

    if (game.state !== "menu") drawHud(size);
    drawVignette(size);
    drawOverlay(size);
  }

  function drawWorld() {
    drawTerrainGrid();

    for (const dot of terrainDots) {
      ctx.fillStyle = dot.c;
      ctx.fillRect(Math.round(dot.x), Math.round(dot.y), Math.max(1, Math.round(dot.r)), Math.max(1, Math.round(dot.r)));
    }

    for (const server of game.servers) {
      if (!server.destroyed && game.state !== "won") {
        drawCorruptionField(server.x, server.y, 360, 0.22);
      } else {
        drawRestoredField(server.x, server.y, 290, 0.2);
      }
    }

    if (!game.boss.defeated) drawCorruptionField(game.boss.x, game.boss.y, 500, coresLeftCount() ? 0.24 : 0.16);
    if (game.state === "won") drawRestoredField(game.boss.x, game.boss.y, 700, 0.28);
  }

  function drawTerrainGrid() {
    const size = screenSize();
    const startX = Math.max(0, Math.floor(camera.x / TILE) * TILE - TILE);
    const startY = Math.max(0, Math.floor(camera.y / TILE) * TILE - TILE);
    const endX = Math.min(WORLD_W, camera.x + size.w + TILE * 2);
    const endY = Math.min(WORLD_H, camera.y + size.h + TILE * 2);

    for (let y = startY; y < endY; y += TILE) {
      for (let x = startX; x < endX; x += TILE) {
        const tile = { x, y, w: TILE, h: TILE };
        const water = rectHitsAny(tile, WATER_RECTS);
        const road = rectHitsAny(tile, ROAD_RECTS);
        const mountain = !water && !road && (x > 6400 || y > 4200 || (x > 5200 && y > 3000));
        const h = tileHash(x, y);
        if (water) {
          ctx.fillStyle = h > 0.5 ? "#2b5a72" : "#315d73";
        } else if (road) {
          ctx.fillStyle = h > 0.5 ? "#735f43" : "#66523b";
        } else if (mountain) {
          ctx.fillStyle = h > 0.72 ? "#68706b" : h > 0.38 ? palette.mountain : "#46514f";
        } else {
          ctx.fillStyle = h > 0.72 ? "#5d965b" : h > 0.36 ? "#518a54" : "#477d4c";
        }
        ctx.fillRect(x, y, TILE, TILE);

        if (water) {
          ctx.fillStyle = "rgba(105, 215, 255, 0.12)";
          ctx.fillRect(x + 8, y + 18 + (h > 0.5 ? 12 : 0), TILE - 16, 5);
        } else if (road) {
          ctx.fillStyle = "rgba(245, 238, 209, 0.08)";
          ctx.fillRect(x + 8, y + 8, TILE - 16, 8);
          ctx.fillRect(x + 8, y + 48, TILE - 16, 5);
        } else if (mountain) {
          ctx.fillStyle = h > 0.76 ? palette.snow : "rgba(17, 24, 23, 0.28)";
          ctx.fillRect(x + 12, y + 10, 18, 12);
          ctx.fillRect(x + 38, y + 38, 14, 16);
        } else if (h > 0.82) {
          ctx.fillStyle = "rgba(126, 203, 119, 0.16)";
          ctx.fillRect(x + 14, y + 16, 10, 10);
          ctx.fillRect(x + 42, y + 38, 8, 8);
        }

        ctx.strokeStyle = water ? "rgba(9, 21, 28, 0.62)" : "rgba(9, 16, 12, 0.48)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      }
    }

    ctx.strokeStyle = "rgba(245, 238, 209, 0.09)";
    ctx.lineWidth = 2;
    for (let x = Math.floor(startX / (TILE * 4)) * TILE * 4; x < endX; x += TILE * 4) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, startY);
      ctx.lineTo(x + 0.5, endY);
      ctx.stroke();
    }
    for (let y = Math.floor(startY / (TILE * 4)) * TILE * 4; y < endY; y += TILE * 4) {
      ctx.beginPath();
      ctx.moveTo(startX, y + 0.5);
      ctx.lineTo(endX, y + 0.5);
      ctx.stroke();
    }
  }

  function drawCorruptionField(x, y, radius, alpha) {
    const g = ctx.createRadialGradient(x, y, radius * 0.08, x, y, radius);
    g.addColorStop(0, `rgba(228, 84, 154, ${alpha})`);
    g.addColorStop(0.52, `rgba(105, 215, 255, ${alpha * 0.42})`);
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = `rgba(105, 215, 255, ${alpha * 0.55})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 7; i += 1) {
      const a = game.time * 0.6 + i * 1.7;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 45, y + Math.sin(a) * 45);
      ctx.lineTo(x + Math.cos(a + 0.5) * radius * 0.78, y + Math.sin(a + 0.5) * radius * 0.78);
      ctx.stroke();
    }
  }

  function drawRestoredField(x, y, radius, alpha) {
    const g = ctx.createRadialGradient(x, y, 20, x, y, radius);
    g.addColorStop(0, `rgba(126, 203, 119, ${alpha})`);
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }

  function drawForestWalls() {
    for (const wall of FOREST_WALL_RECTS) {
      const startX = Math.floor(wall.x / TILE) * TILE;
      const startY = Math.floor(wall.y / TILE) * TILE;
      const endX = wall.x + wall.w;
      const endY = wall.y + wall.h;
      for (let y = startY; y < endY; y += TILE) {
        for (let x = startX; x < endX; x += TILE) {
          if (x + 18 < wall.x || y + 18 < wall.y || x > endX || y > endY) continue;
          const mountain = x > 6200 || y > 4200;
          const phase = tileHash(x, y) * TAU;
          const item = {
            type: mountain ? "antennaTree" : "tree",
            x: x + 32,
            y: y + 38,
            r: mountain ? 32 : 30,
            phase
          };
          drawWallTree(item, mountain);
        }
      }
    }
  }

  function drawWallTree(item, mountain) {
    const clean = isRestoredAt(item.x, item.y) || game.state === "won";
    drawTree(item, clean);
    if (mountain) {
      ctx.fillStyle = "rgba(207, 216, 207, 0.34)";
      ctx.fillRect(item.x - 17, item.y - item.r - 12, 34, 10);
      ctx.fillRect(item.x - 9, item.y - item.r - 24, 18, 10);
    }
  }

  function drawDecor() {
    const sorted = decor.slice().sort((a, b) => a.y - b.y);
    for (const item of sorted) {
      const clean = isRestoredAt(item.x, item.y) || game.state === "won";
      if (item.type === "tree") drawTree(item, clean);
      if (item.type === "antennaTree") drawAntennaTree(item, clean);
      if (item.type === "rock") drawRock(item, clean);
      if (item.type === "flower") drawTinyFlower(item, clean);
    }
  }

  function drawTree(item, clean) {
    const x = Math.round(item.x);
    const y = Math.round(item.y);
    const r = Math.round(item.r);
    shadow(x, y + r * 0.65, r * 1.05, r * 0.34);
    ctx.fillStyle = palette.bark;
    ctx.fillRect(x - 6, y + Math.round(r * 0.22), 12, Math.round(r * 0.72));
    ctx.fillStyle = clean ? "#255c33" : "#183522";
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillRect(x - Math.round(r * 0.72), y - Math.round(r * 1.28), Math.round(r * 1.42), Math.round(r * 0.7));
    ctx.fillRect(x - Math.round(r * 1.18), y - Math.round(r * 0.42), Math.round(r * 0.82), Math.round(r * 0.84));
    ctx.fillRect(x + Math.round(r * 0.36), y - Math.round(r * 0.36), Math.round(r * 0.82), Math.round(r * 0.82));
    ctx.fillStyle = clean ? "rgba(245, 238, 209, 0.12)" : "rgba(105, 215, 255, 0.14)";
    ctx.fillRect(x - Math.round(r * 0.55), y - Math.round(r * 0.7), Math.round(r * 0.62), Math.round(r * 0.42));
    if (!clean) drawNeuralink(x, y, r);
  }

  function drawAntennaTree(item, clean) {
    drawTree(item, clean);
    if (!clean) {
      ctx.strokeStyle = palette.aiBlue;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(item.x, item.y - item.r * 0.8);
      ctx.lineTo(item.x + Math.cos(game.time * 2 + item.phase) * 24, item.y - item.r * 1.55);
      ctx.stroke();
      ctx.fillStyle = "rgba(105, 215, 255, 0.72)";
      ctx.fillRect(item.x + Math.cos(game.time * 2 + item.phase) * 24 - 1, item.y - item.r * 1.55 - 1, 3, 3);
    }
  }

  function drawRock(item, clean) {
    const x = Math.round(item.x);
    const y = Math.round(item.y);
    const r = Math.round(item.r);
    shadow(x, y + 5, r * 1.05, r * 0.42);
    ctx.fillStyle = clean ? "#819081" : "#667074";
    ctx.fillRect(x - r, y - Math.round(r * 0.55), r * 2, Math.round(r * 1.05));
    ctx.fillStyle = clean ? "#9ba69a" : "#7c878b";
    ctx.fillRect(x - Math.round(r * 0.55), y - Math.round(r * 0.86), Math.round(r * 1.08), Math.round(r * 0.38));
    if (!clean) {
      ctx.strokeStyle = "rgba(105, 215, 255, 0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.42, y);
      ctx.lineTo(x + r * 0.3, y - r * 0.25);
      ctx.stroke();
    }
  }

  function drawTinyFlower(item, clean) {
    const x = Math.round(item.x);
    const y = Math.round(item.y);
    ctx.fillStyle = clean ? "rgba(242, 232, 114, 0.78)" : "rgba(228, 84, 154, 0.55)";
    ctx.fillRect(x - 2, y - 9, 4, 7);
    ctx.fillRect(x - 2, y + 2, 4, 7);
    ctx.fillRect(x - 9, y - 2, 7, 4);
    ctx.fillRect(x + 2, y - 2, 7, 4);
    ctx.fillStyle = clean ? palette.cream : palette.aiBlue;
    ctx.fillRect(x - 2, y - 2, 4, 4);
  }

  function drawNeuralink(x, y, r) {
    ctx.save();
    ctx.strokeStyle = "rgba(105, 215, 255, 0.58)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + r * 0.18, y - r * 0.32);
    ctx.lineTo(x + r * 0.58, y - r * 0.22);
    ctx.lineTo(x + r * 0.36, y + r * 0.18);
    ctx.stroke();
    ctx.fillStyle = "rgba(105, 215, 255, 0.74)";
    ctx.fillRect(x + r * 0.55, y - r * 0.25, 3, 3);
    ctx.restore();
  }

  function drawPlanks() {
    for (const plank of game.planks) {
      if (plank.taken) continue;
      drawPlank(plank.x, plank.y + Math.sin(plank.bob) * 3, plank.angle, 1);
    }
  }

  function drawPlank(x, y, angle, scale = 1) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    shadow(0, 13, 30, 6);
    ctx.fillStyle = palette.plank;
    ctx.fillRect(-28, -7, 56, 14);
    ctx.fillStyle = "rgba(92, 57, 36, 0.5)";
    ctx.fillRect(-22, -4, 18, 3);
    ctx.fillRect(5, 3, 17, 3);
    ctx.restore();
  }

  function drawPickups() {
    for (const pickup of game.pickups) {
      if (pickup.taken) continue;
      const y = pickup.y + Math.sin(pickup.bob) * 5;
      shadow(pickup.x, pickup.y + 15, 24, 7);
      if (pickup.type === "daisy") drawDaisy(pickup.x, y, 1.1);
      else drawSpinach(pickup.x, y, 1);
    }
  }

  function drawDaisy(x, y, scale) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    ctx.fillStyle = palette.leafLight;
    ctx.fillRect(-2, 10, 4, 21);
    ctx.fillStyle = "#f7f0dc";
    ctx.fillRect(-4, -18, 8, 12);
    ctx.fillRect(-4, 6, 8, 12);
    ctx.fillRect(-18, -4, 12, 8);
    ctx.fillRect(6, -4, 12, 8);
    ctx.fillRect(-13, -13, 9, 9);
    ctx.fillRect(4, -13, 9, 9);
    ctx.fillRect(-13, 4, 9, 9);
    ctx.fillRect(4, 4, 9, 9);
    ctx.fillStyle = palette.flower;
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
  }

  function drawSpinach(x, y, scale) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    ctx.fillStyle = palette.spinach;
    ctx.fillRect(-15, -10, 14, 26);
    ctx.fillRect(1, -13, 15, 29);
    ctx.fillStyle = "#d5ffd8";
    ctx.fillRect(-8, -5, 3, 18);
    ctx.fillRect(8, -7, 3, 20);
    ctx.fillStyle = "#2f8f4c";
    ctx.fillRect(-2, 10, 5, 12);
    ctx.restore();
  }

  function drawBlockers() {
    for (const blocker of game.blockers) {
      if (blocker.destroyed) {
        drawBlockerRuin(blocker);
      } else {
        drawBlocker(blocker);
      }
    }
  }

  function drawBlocker(blocker) {
    const pulse = Math.sin(blocker.pulse) * 0.5 + 0.5;
    shadow(blocker.cx, blocker.y + blocker.h + 10, blocker.w * 0.55, 10);
    ctx.save();
    ctx.fillStyle = blocker.awake ? "#3a2533" : "#2b3538";
    ctx.fillRect(blocker.x, blocker.y, blocker.w, blocker.h);
    ctx.fillStyle = blocker.awake ? palette.aiPink : "#64777a";
    ctx.fillRect(blocker.x + 12, blocker.y + 12, blocker.w - 24, 14);
    ctx.fillRect(blocker.x + 12, blocker.y + blocker.h - 26, blocker.w - 24, 14);
    ctx.fillStyle = blocker.awake ? palette.aiBlue : "#92a5a7";
    ctx.globalAlpha = 0.45 + pulse * 0.35;
    ctx.fillRect(blocker.cx - 15, blocker.cy - 15, 30, 30);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = blocker.awake ? palette.aiPink : "rgba(245, 238, 209, 0.32)";
    ctx.lineWidth = 3;
    ctx.strokeRect(blocker.x + 5, blocker.y + 5, blocker.w - 10, blocker.h - 10);
    if (blocker.awake) {
      ctx.fillStyle = "rgba(241, 91, 91, 0.82)";
      ctx.fillRect(blocker.x + 8, blocker.y - 13, blocker.w - 16, 7);
      ctx.fillStyle = palette.leafLight;
      ctx.fillRect(blocker.x + 8, blocker.y - 13, (blocker.w - 16) * (blocker.hp / blocker.maxHp), 7);
    }
    ctx.restore();
  }

  function drawBlockerRuin(blocker) {
    ctx.save();
    ctx.fillStyle = "#38583d";
    ctx.fillRect(blocker.x, blocker.y + blocker.h * 0.42, blocker.w, blocker.h * 0.18);
    ctx.fillStyle = palette.leafLight;
    ctx.fillRect(blocker.cx - 18, blocker.cy - 20, 12, 42);
    ctx.fillRect(blocker.cx + 8, blocker.cy - 26, 12, 48);
    ctx.restore();
  }

  function drawServers() {
    for (const server of game.servers) {
      if (server.destroyed) {
        drawServerRuin(server);
      } else {
        drawServer(server);
      }
    }
  }

  function drawServer(server) {
    const b = roomBounds(server);
    const pulse = Math.sin(game.time * 3 + server.pulse) * 0.5 + 0.5;
    shadow(server.x, server.y + server.h * 0.44, server.w * 0.48, 18);

    ctx.save();

    ctx.strokeStyle = `rgba(105, 215, 255, ${0.2 + pulse * 0.22})`;
    ctx.lineWidth = 5;
    const cablePads = [
      [b.x - 86, server.y - 74],
      [b.x + b.w + 34, server.y - 74],
      [b.x - 86, server.y + 88],
      [b.x + b.w + 34, server.y + 88]
    ];
    for (const pad of cablePads) {
      ctx.fillStyle = "#202a2e";
      ctx.fillRect(pad[0], pad[1], 52, 52);
      ctx.strokeRect(pad[0] + 6, pad[1] + 6, 40, 40);
      ctx.beginPath();
      ctx.moveTo(pad[0] + 26, pad[1] + 26);
      ctx.lineTo(server.x, server.y);
      ctx.stroke();
    }

    ctx.fillStyle = "#172024";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "#263238";
    for (let y = b.y + server.wall; y < b.y + b.h - server.wall; y += 32) {
      for (let x = b.x + server.wall; x < b.x + b.w - server.wall; x += 32) {
        ctx.fillRect(x + 2, y + 2, 28, 28);
      }
    }

    ctx.strokeStyle = "rgba(105, 215, 255, 0.32)";
    ctx.lineWidth = 2;
    for (let x = b.x + 30; x < b.x + b.w - 30; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, b.y + 24);
      ctx.lineTo(server.x, server.y);
      ctx.stroke();
    }

    ctx.fillStyle = "#4b5256";
    for (const wall of roomWalls(server)) ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = "#6d5941";
    ctx.fillRect(server.x - server.door / 2, b.y + b.h - server.wall, server.door, server.wall);

    ctx.fillStyle = "#11171c";
    for (let i = 0; i < 4; i += 1) {
      const rackX = b.x + 44 + i * 58;
      ctx.fillRect(rackX, b.y + 42, 36, 66);
      ctx.fillRect(rackX, b.y + b.h - 98, 36, 48);
      ctx.fillStyle = i % 2 ? palette.aiPink : palette.aiBlue;
      ctx.globalAlpha = 0.35 + pulse * 0.35;
      ctx.fillRect(rackX + 7, b.y + 54, 7, 8);
      ctx.fillRect(rackX + 22, b.y + 73, 7, 8);
      ctx.fillRect(rackX + 10, b.y + b.h - 84, 18, 6);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#11171c";
    }

    ctx.fillStyle = "#222b30";
    ctx.fillRect(b.x + 18, b.y - 34, 56, 28);
    ctx.fillRect(b.x + b.w - 74, b.y - 34, 56, 28);
    ctx.fillRect(server.x - 24, b.y + b.h + 12, 48, 36);
    ctx.fillStyle = palette.aiBlue;
    ctx.globalAlpha = 0.4 + pulse * 0.4;
    ctx.fillRect(b.x + 30, b.y - 26, 32, 5);
    ctx.fillRect(b.x + b.w - 62, b.y - 26, 32, 5);
    ctx.fillRect(server.x - 16, b.y + b.h + 23, 32, 6);
    ctx.globalAlpha = 1;

    ctx.fillStyle = server.hp / server.maxHp > 0.35 ? "#2c3137" : "#46343b";
    ctx.fillRect(server.x - 32, server.y - 40, 64, 82);
    ctx.fillStyle = "#0b1014";
    ctx.fillRect(server.x - 22, server.y - 27, 44, 16);
    ctx.fillRect(server.x - 22, server.y - 2, 44, 16);
    ctx.fillRect(server.x - 22, server.y + 23, 44, 12);

    ctx.fillStyle = palette.aiBlue;
    ctx.globalAlpha = 0.45 + pulse * 0.35;
    for (let i = 0; i < 6; i += 1) {
      ctx.fillRect(server.x - 18 + i * 7, server.y - 23, 4, 7);
      ctx.fillRect(server.x - 18 + i * 7, server.y + 2, 4, 7);
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = `rgba(228, 84, 154, ${0.42 + pulse * 0.35})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(server.x - 45, server.y - 53, 90, 105);

    ctx.fillStyle = "rgba(241, 91, 91, 0.82)";
    const hp = server.hp / server.maxHp;
    ctx.fillRect(server.x - 42, server.y + 62, 84, 8);
    ctx.fillStyle = palette.leafLight;
    ctx.fillRect(server.x - 42, server.y + 62, 84 * hp, 8);
    ctx.restore();
  }

  function drawServerRuin(server) {
    const b = roomBounds(server);
    shadow(server.x, server.y + server.h * 0.44, server.w * 0.46, 16);
    ctx.save();
    ctx.fillStyle = "#5b9658";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "#2d6e39";
    for (let y = b.y + 16; y < b.y + b.h - 12; y += 28) {
      for (let x = b.x + 18; x < b.x + b.w - 16; x += 30) {
        const h = tileHash(x, y);
        if (h > 0.18) ctx.fillRect(x, y, 18, 18);
        if (h > 0.62) drawTinyFlower({ x: x + 9, y: y + 8, phase: h * TAU }, true);
      }
    }

    ctx.fillStyle = "#426f45";
    for (const wall of roomWalls(server)) ctx.fillRect(wall.x, wall.y, wall.w, wall.h);

    ctx.fillStyle = palette.bark;
    ctx.fillRect(server.x - 8, server.y - 14, 16, 52);
    ctx.fillStyle = "#235c35";
    ctx.fillRect(server.x - 36, server.y - 52, 72, 46);
    ctx.fillRect(server.x - 24, server.y - 78, 48, 38);

    ctx.fillStyle = palette.leafLight;
    for (let i = 0; i < 8; i += 1) {
      const x = b.x + 34 + i * 34;
      const y = b.y + b.h - 54 - Math.sin(game.time * 1.7 + i) * 3;
      ctx.fillRect(x, y, 12, 30);
      drawTinyFlower({ x: x + 6, y: y - 3, phase: i }, true);
    }
    ctx.restore();
  }

  function drawFriendlyCritters() {
    for (const critter of friendlyCritters) {
      drawAnimal(critter, true);
    }
  }

  function drawBoss() {
    const boss = game.boss;
    if (boss.defeated) {
      drawRestoredTree(boss.x, boss.y);
      return;
    }

    const exposed = coresLeftCount() === 0;
    const pulse = Math.sin(game.time * 4 + boss.pulse) * 0.5 + 0.5;
    shadow(boss.x, boss.y + 42, 132, 46);

    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.strokeStyle = exposed ? "rgba(228, 84, 154, 0.7)" : "rgba(105, 215, 255, 0.55)";
    ctx.lineWidth = 4;
    for (let i = 0; i < 9; i += 1) {
      const a = i * TAU / 9 + game.time * 0.17;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 52, Math.sin(a) * 36);
      ctx.bezierCurveTo(Math.cos(a + 0.3) * 110, Math.sin(a + 0.3) * 82, Math.cos(a) * 165, Math.sin(a) * 122, Math.cos(a) * 210, Math.sin(a) * 150);
      ctx.stroke();
    }

    ctx.fillStyle = boss.hitFlash > 0 ? palette.cream : "#26312f";
    ctx.beginPath();
    ctx.ellipse(0, 0, 58, 68, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#151b1f";
    roundedRect(-31, -36, 62, 72, 9);
    ctx.fillStyle = exposed ? palette.aiPink : palette.aiBlue;
    ctx.globalAlpha = 0.72 + pulse * 0.28;
    ctx.beginPath();
    ctx.arc(0, -4, 27 + pulse * 6, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = exposed ? palette.flower : palette.aiViolet;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, -4, 40 + pulse * 8, -Math.PI * 0.7, Math.PI * 1.25);
    ctx.stroke();

    ctx.fillStyle = "rgba(241, 91, 91, 0.86)";
    roundedRect(-54, 76, 108, 9, 4);
    ctx.fillStyle = exposed ? palette.flower : palette.aiViolet;
    roundedRect(-54, 76, 108 * (boss.hp / boss.maxHp), 9, 4);
    ctx.restore();
  }

  function drawRestoredTree(x, y) {
    shadow(x, y + 42, 140, 44);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = palette.bark;
    roundedRect(-18, -8, 36, 90, 12);
    ctx.fillStyle = palette.leafLight;
    ctx.beginPath();
    ctx.arc(-34, -35, 48, 0, TAU);
    ctx.arc(31, -42, 55, 0, TAU);
    ctx.arc(2, -75, 50, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(245, 238, 209, 0.14)";
    ctx.beginPath();
    ctx.arc(-20, -66, 21, 0, TAU);
    ctx.arc(28, -58, 18, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawEnemies() {
    const alive = game.enemies.filter((e) => e.hp > 0).sort((a, b) => a.y - b.y);
    for (const enemy of alive) {
      if (enemy.type === "cat" || enemy.type === "dog") drawAnimal(enemy, false);
      else if (enemy.type === "drone") drawDrone(enemy);
      else drawRobot(enemy);
    }
  }

  function drawAnimal(enemy, friendly) {
    const y = Math.round(enemy.y + Math.sin(enemy.phase) * (friendly ? 1 : 2));
    const x = Math.round(enemy.x);
    const r = Math.round(enemy.r);
    shadow(x, y + r * 0.9, r * 1.08, r * 0.32);
    ctx.save();
    ctx.translate(x, y);
    const faceLeft = !friendly && enemy.aggro ? game.player.x < enemy.x : Math.sin(enemy.phase) < 0;
    ctx.scale(faceLeft ? -1 : 1, 1);

    const body = friendly ? "#f4c27a" : enemy.hitFlash > 0 ? palette.cream : enemy.color;
    const dark = friendly ? "#c98445" : "#566164";
    ctx.fillStyle = body;
    ctx.fillRect(-r, -Math.round(r * 0.48), Math.round(r * 1.7), Math.round(r * 0.95));
    ctx.fillRect(Math.round(r * 0.42), -Math.round(r * 0.8), Math.round(r * 0.78), Math.round(r * 0.82));
    ctx.fillStyle = dark;
    ctx.fillRect(-Math.round(r * 0.72), Math.round(r * 0.42), 6, 9);
    ctx.fillRect(Math.round(r * 0.24), Math.round(r * 0.42), 6, 9);

    ctx.fillStyle = body;
    if (enemy.type === "cat") {
      ctx.fillRect(Math.round(r * 0.48), -Math.round(r * 1.16), 7, 8);
      ctx.fillRect(Math.round(r * 0.92), -Math.round(r * 1.08), 7, 8);
      ctx.fillStyle = dark;
      ctx.fillRect(-Math.round(r * 1.34), -Math.round(r * 0.42), Math.round(r * 0.52), 6);
    } else {
      ctx.fillStyle = dark;
      ctx.fillRect(Math.round(r * 0.98), -Math.round(r * 0.6), 8, 14);
      ctx.fillRect(-Math.round(r * 1.42), -Math.round(r * 0.22), Math.round(r * 0.55), 7);
    }

    ctx.fillStyle = friendly ? "#203b2c" : palette.aiBlue;
    ctx.fillRect(Math.round(r * 0.86), -Math.round(r * 0.48), 4, 4);
    if (!friendly) {
      ctx.strokeStyle = "rgba(105, 215, 255, 0.78)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-Math.round(r * 0.55), -Math.round(r * 0.36));
      ctx.lineTo(Math.round(r * 0.2), -Math.round(r * 0.15));
      ctx.lineTo(Math.round(r * 0.64), -Math.round(r * 0.42));
      ctx.stroke();
      ctx.fillStyle = "rgba(105, 215, 255, 0.62)";
      ctx.fillRect(-Math.round(r * 0.18), -Math.round(r * 0.3), 12, 3);
    }
    ctx.restore();
  }

  function drawRobot(enemy) {
    const x = Math.round(enemy.x);
    const y = Math.round(enemy.y);
    const r = Math.round(enemy.r);
    shadow(x, y + r, r * 1.2, r * 0.38);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = enemy.hitFlash > 0 ? palette.cream : (enemy.type === "sentinel" ? "#716d8f" : "#687477");
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.fillStyle = "#171e22";
    ctx.fillRect(-Math.round(r * 0.55), -Math.round(r * 0.38), Math.round(r * 1.1), Math.round(r * 0.55));
    ctx.fillStyle = enemy.type === "sentinel" ? palette.aiViolet : palette.aiBlue;
    ctx.fillRect(-Math.round(r * 0.38), -Math.round(r * 0.24), 5, 5);
    ctx.fillRect(Math.round(r * 0.16), -Math.round(r * 0.24), 5, 5);
    ctx.fillStyle = palette.aiPink;
    ctx.fillRect(-Math.round(r * 0.72), Math.round(r * 0.82), 6, 10);
    ctx.fillRect(Math.round(r * 0.42), Math.round(r * 0.82), 6, 10);
    ctx.restore();
  }

  function drawDrone(enemy) {
    const x = Math.round(enemy.x);
    const y = Math.round(enemy.y + Math.sin(enemy.phase * 2) * 3);
    const r = Math.round(enemy.r);
    shadow(x, y + 18, r * 1.08, r * 0.28);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = palette.aiBlue;
    ctx.fillRect(-r * 2, -3, r * 4, 6);
    ctx.fillRect(-3, -r * 2, 6, r * 4);
    ctx.fillStyle = enemy.hitFlash > 0 ? palette.cream : "#30424a";
    ctx.fillRect(-r, -Math.round(r * 0.7), r * 2, Math.round(r * 1.4));
    ctx.fillStyle = palette.aiPink;
    ctx.fillRect(-5, -5, 10, 10);
    ctx.fillStyle = "rgba(245, 238, 209, 0.55)";
    ctx.fillRect(-r * 2 - 6, -9, 12, 12);
    ctx.fillRect(r * 2 - 6, -9, 12, 12);
    ctx.fillRect(-6, -r * 2 - 6, 12, 12);
    ctx.fillRect(-6, r * 2 - 6, 12, 12);
    ctx.restore();
  }

  function drawShots() {
    for (const shot of playerShots) drawShot(shot);
    for (const shot of enemyShots) drawShot(shot);
  }

  function drawShot(shot) {
    ctx.save();
    if (shot.type === "plank") {
      drawPlank(shot.x, shot.y, shot.angle + game.time * shot.spin, 1.05);
    } else {
      ctx.shadowBlur = 10;
      ctx.shadowColor = shot.color;
      ctx.fillStyle = shot.color;
      ctx.fillRect(Math.round(shot.x - shot.r), Math.round(shot.y - shot.r), shot.r * 2, shot.r * 2);
    }
    ctx.restore();
  }

  function drawPlayer() {
    const p = game.player;
    const hurtBlink = p.hurtCooldown > 0 && Math.floor(game.time * 18) % 2 === 0;
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const tailLength = 24 + p.tailLevel * 42;
    const back = p.facing + Math.PI;
    if (!p.swimming) shadow(x, y + 16, 25, 7);

    ctx.save();
    ctx.translate(x, y);

    if (p.swimming) {
      ctx.fillStyle = "rgba(105, 215, 255, 0.34)";
      ctx.fillRect(-28, 5, 56, 9);
      ctx.fillRect(-20, 18, 40, 6);
    }

    if (tailLength > 24) {
      const segments = Math.ceil(tailLength / 26);
      ctx.fillStyle = palette.beaverDark;
      for (let i = 1; i <= segments; i += 1) {
        const d = i * 24;
        const width = Math.max(10, 22 - i * 0.7);
        const tx = Math.cos(back) * d;
        const ty = Math.sin(back) * d;
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(back);
        ctx.fillRect(-8, -width / 2, 24, width);
        ctx.restore();
      }
      ctx.save();
      ctx.translate(Math.cos(back) * (tailLength + 8), Math.sin(back) * (tailLength + 8));
      ctx.rotate(back);
      ctx.fillStyle = palette.beaver;
      ctx.fillRect(-6, -17, 32, 34);
      ctx.fillStyle = "rgba(245, 238, 209, 0.12)";
      ctx.fillRect(0, -10, 20, 4);
      ctx.fillRect(0, 7, 20, 4);
      ctx.restore();
    }

    if (p.shield > 0) {
      ctx.strokeStyle = "rgba(78, 208, 109, 0.72)";
      ctx.lineWidth = 4;
      ctx.strokeRect(-30, -28, 60, 56);
    }

    ctx.fillStyle = hurtBlink ? palette.cream : palette.beaver;
    ctx.fillRect(-16, p.swimming ? -14 : -10, 32, p.swimming ? 22 : 28);
    ctx.fillStyle = palette.beaverDark;
    if (!p.swimming) {
      ctx.fillRect(-12, 14, 9, 12);
      ctx.fillRect(4, 14, 9, 12);
    }

    const faceX = Math.round(Math.cos(p.facing) * 13);
    const faceY = Math.round(Math.sin(p.facing) * 10);
    ctx.fillStyle = hurtBlink ? palette.cream : "#9a673d";
    ctx.fillRect(faceX - 10, faceY - 18, 22, 20);
    ctx.fillStyle = "#1d1714";
    ctx.fillRect(faceX + (Math.cos(p.facing) >= 0 ? 4 : -5), faceY - 12, 4, 4);
    ctx.fillStyle = palette.cream;
    ctx.fillRect(faceX + (Math.cos(p.facing) >= 0 ? 8 : -10), faceY - 5, 7, 6);

    if (p.heldPlank) {
      drawPlank(Math.cos(p.facing + 0.7) * 23, Math.sin(p.facing + 0.7) * 23, p.facing + 0.08, 0.85);
    }

    if (p.punchCooldown > 0.29) {
      ctx.strokeStyle = "rgba(245, 238, 209, 0.7)";
      ctx.lineWidth = 3;
      const bx = Math.cos(p.facing) * 30;
      const by = Math.sin(p.facing) * 30;
      ctx.strokeRect(bx - 14, by - 12, 28, 24);
      ctx.fillStyle = palette.cream;
      ctx.fillRect(bx - 7, by - 5, 5, 10);
      ctx.fillRect(bx + 2, by - 5, 5, 10);
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawHud(size) {
    const p = game.player;
    ctx.save();
    ctx.font = "700 13px Inter, system-ui, sans-serif";
    ctx.textBaseline = "middle";

    glassPanel(18, 18, 276, 72);
    ctx.fillStyle = palette.cream;
    ctx.fillText("ZYCIE", 34, 40);
    for (let i = 0; i < p.maxHp; i += 1) {
      drawHeart(88 + i * 22, 40, i + 1 <= Math.ceil(p.hp), p.hp - i);
    }

    ctx.fillStyle = palette.cream;
    ctx.fillText("RDZENIE", 34, 68);
    for (let i = 0; i < game.servers.length; i += 1) {
      const s = game.servers[i];
      ctx.fillStyle = s.destroyed ? palette.leafLight : palette.aiPink;
      ctx.beginPath();
      ctx.roundRect(99 + i * 23, 61, 15, 15, 4);
      ctx.fill();
    }

    const rightW = p.tailLevel > 0 || p.shield > 0 || p.heldPlank ? 210 : 118;
    glassPanel(size.w - rightW - 18, 18, rightW, 72);
    drawMiniMap(size.w - rightW, 31, rightW - 34, 44);

    if (p.tailLevel > 0) {
      drawTailIcon(36, size.h - 42, 0.82);
      meter(62, size.h - 55, 86, 9, clamp(p.tailLevel / 8, 0, 1), palette.beaver);
    }
    if (p.heldPlank) {
      drawPlank(size.w - 180, size.h - 42, -0.1, 0.64);
    }
    if (p.shield > 0) {
      drawSpinach(size.w - 58, size.h - 42, 0.72);
      meter(size.w - 148, size.h - 55, 82, 9, p.shield / 14, palette.spinach);
    }

    ctx.restore();
  }

  function drawMiniMap(x, y, w, h) {
    ctx.save();
    ctx.fillStyle = "rgba(13, 18, 16, 0.46)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    for (const blocker of game.blockers) {
      ctx.fillStyle = blocker.destroyed ? palette.leafLight : blocker.awake ? palette.aiPink : "#92a5a7";
      ctx.fillRect(x + blocker.cx / WORLD_W * w - 2, y + blocker.cy / WORLD_H * h - 2, 4, 4);
    }
    for (const server of game.servers) {
      ctx.fillStyle = server.destroyed ? palette.leafLight : palette.aiPink;
      ctx.beginPath();
      ctx.arc(x + server.x / WORLD_W * w, y + server.y / WORLD_H * h, 2.8, 0, TAU);
      ctx.fill();
    }
    const boss = game.boss;
    ctx.fillStyle = boss.defeated ? palette.leafLight : palette.aiViolet;
    ctx.beginPath();
    ctx.arc(x + boss.x / WORLD_W * w, y + boss.y / WORLD_H * h, 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = palette.cream;
    ctx.beginPath();
    ctx.arc(x + game.player.x / WORLD_W * w, y + game.player.y / WORLD_H * h, 3.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawTailIcon(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = palette.beaverDark;
    ctx.fillRect(-18, -6, 25, 12);
    ctx.fillStyle = palette.beaver;
    ctx.fillRect(4, -13, 24, 26);
    ctx.fillStyle = "rgba(245, 238, 209, 0.14)";
    ctx.fillRect(9, -6, 14, 3);
    ctx.fillRect(9, 5, 14, 3);
    ctx.restore();
  }

  function drawHeart(x, y, filled, amount) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = filled ? palette.red : "rgba(245, 238, 209, 0.18)";
    if (amount > 0 && amount < 1) ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.bezierCurveTo(-13, -2, -8, -14, 0, -8);
    ctx.bezierCurveTo(8, -14, 13, -2, 0, 7);
    ctx.fill();
    ctx.restore();
  }

  function drawVignette(size) {
    const g = ctx.createRadialGradient(size.w / 2, size.h / 2, size.h * 0.1, size.w / 2, size.h / 2, size.h * 0.78);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size.w, size.h);
  }

  function drawOverlay(size) {
    if (game.state === "menu") {
      drawMenu(size);
      return;
    }
    if (game.messageTimer <= 0 && game.state === "play") return;

    ctx.save();
    ctx.textAlign = "center";
    if (game.state !== "play") {
      ctx.fillStyle = "rgba(6, 9, 8, 0.54)";
      ctx.fillRect(0, 0, size.w, size.h);
    }

    const alpha = game.state === "play" ? clamp(game.messageTimer / 0.7, 0, 1) : 1;
    ctx.globalAlpha = alpha;
    ctx.font = "900 34px Inter, system-ui, sans-serif";
    ctx.fillStyle = palette.cream;
    ctx.fillText(game.message, size.w / 2, size.h * 0.2);

    if (game.state === "paused") {
      ctx.font = "700 14px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(245, 238, 209, 0.72)";
      ctx.fillText("ESC / P", size.w / 2, size.h * 0.2 + 44);
    }
    if (game.state === "dead" || game.state === "won") {
      ctx.font = "700 14px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(245, 238, 209, 0.72)";
      ctx.fillText("R", size.w / 2, size.h * 0.2 + 44);
    }
    ctx.restore();
  }

  function drawMenu(size) {
    ctx.save();
    ctx.fillStyle = "rgba(6, 9, 8, 0.76)";
    ctx.fillRect(0, 0, size.w, size.h);
    const cx = size.w / 2;
    const cy = size.h / 2;
    const panelW = Math.min(520, size.w - 48);
    const panelX = cx - panelW / 2;
    const panelY = Math.max(36, cy - 28);

    ctx.textAlign = "center";
    ctx.fillStyle = palette.cream;
    ctx.font = "900 54px Inter, system-ui, sans-serif";
    ctx.fillText("NATURAI", cx, panelY - 128);
    ctx.font = "700 16px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(245, 238, 209, 0.72)";
    ctx.fillText("bobrowy sabotarz kontra system w lesie", cx, panelY - 94);

    ctx.fillStyle = "#1f3638";
    ctx.fillRect(cx - 102, panelY - 64, 204, 48);
    ctx.strokeStyle = palette.leafLight;
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - 102, panelY - 64, 204, 48);
    ctx.fillStyle = palette.cream;
    ctx.font = "800 18px Inter, system-ui, sans-serif";
    ctx.fillText("ROZPOCZNIJ", cx, panelY - 38);

    ctx.fillStyle = "rgba(13, 18, 16, 0.72)";
    ctx.fillRect(panelX, panelY + 8, panelW, 188);
    ctx.strokeStyle = "rgba(245, 238, 209, 0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY + 8, panelW, 188);

    ctx.textAlign = "left";
    ctx.fillStyle = palette.cream;
    ctx.font = "900 14px Inter, system-ui, sans-serif";
    ctx.fillText("STEROWANIE", panelX + 22, panelY + 34);

    const rows = [
      ["WASD", "ruch"],
      ["SPACJA", "gryzienie"],
      ["E", "podnies deske"],
      ["J / K", "rzuc deske"],
      ["STOKROTKA", "ogon rosnie, ugryzienie mocniejsze"],
      ["SZPINAK", "tarcza"],
      ["R", "restart po koncu gry"]
    ];

    ctx.font = "800 12px Inter, system-ui, sans-serif";
    for (let i = 0; i < rows.length; i += 1) {
      const y = panelY + 58 + i * 19;
      ctx.fillStyle = "rgba(126, 203, 119, 0.16)";
      ctx.fillRect(panelX + 22, y - 10, 88, 15);
      ctx.fillStyle = palette.cream;
      ctx.textAlign = "center";
      ctx.fillText(rows[i][0], panelX + 66, y - 1);
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(245, 238, 209, 0.78)";
      ctx.fillText(rows[i][1], panelX + 126, y - 1);
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(245, 238, 209, 0.66)";
    ctx.font = "700 13px Inter, system-ui, sans-serif";
    ctx.fillText("system spi pod mchem; blokady bronia sie dopiero po ataku", cx, panelY + 226);
    ctx.restore();
  }

  function glassPanel(x, y, w, h) {
    ctx.save();
    ctx.fillStyle = "rgba(13, 18, 16, 0.56)";
    ctx.strokeStyle = "rgba(245, 238, 209, 0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function meter(x, y, w, h, amount, color) {
    ctx.save();
    ctx.fillStyle = "rgba(13, 18, 16, 0.62)";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, clamp(amount, 0, 1) * w, h, h / 2);
    ctx.fill();
    ctx.restore();
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }

  function shadow(x, y, w, h) {
    ctx.fillStyle = palette.shadow;
    ctx.fillRect(Math.round(x - w), Math.round(y - h / 2), Math.round(w * 2), Math.round(h));
  }

  function burst(x, y, count, color) {
    for (let i = 0; i < count; i += 1) {
      const a = rand() * TAU;
      const speed = 40 + rand() * 180;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r: 2 + rand() * 4,
        color,
        life: 0.35 + rand() * 0.7,
        maxLife: 0.7,
        age: 0
      });
    }
  }

  function trail(x, y, color) {
    particles.push({
      x,
      y,
      vx: (rand() - 0.5) * 18,
      vy: (rand() - 0.5) * 18,
      r: 1.2 + rand() * 2.2,
      color,
      life: 0.22,
      maxLife: 0.22,
      age: 0
    });
  }

  function spawnArc(x, y, angle, color) {
    for (let i = 0; i < 12; i += 1) {
      const a = angle + (rand() - 0.5) * 1.4;
      const speed = 45 + rand() * 90;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r: 1.8 + rand() * 2.2,
        color,
        life: 0.14 + rand() * 0.18,
        maxLife: 0.3,
        age: 0
      });
    }
  }

  function spawnFriendlyRing(x, y) {
    for (let i = 0; i < 4; i += 1) {
      friendlyCritters.push({
        type: i % 2 ? "cat" : "dog",
        x: x + Math.cos(i * TAU / 4) * 70,
        y: y + Math.sin(i * TAU / 4) * 70,
        r: i % 2 ? 13 : 16,
        phase: rand() * TAU,
        life: 14
      });
    }
  }

  function coresLeftCount() {
    return game.servers.filter((server) => !server.destroyed).length;
  }

  function isRestoredAt(x, y) {
    for (const server of game.servers) {
      if (server.destroyed && Math.hypot(x - server.x, y - server.y) < 330) return true;
    }
    return false;
  }

  function initAudio() {
    if (audio) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();

    const master = context.createGain();
    master.gain.value = 0.16;
    master.connect(context.destination);

    const musicGain = context.createGain();
    musicGain.gain.value = 0.045;
    const sfxGain = context.createGain();
    sfxGain.gain.value = 0.18;

    const musicFilter = context.createBiquadFilter();
    musicFilter.type = "lowpass";
    musicFilter.frequency.value = 1050;
    musicFilter.Q.value = 0.45;
    musicGain.connect(musicFilter);
    musicFilter.connect(master);
    sfxGain.connect(master);

    const droneA = context.createOscillator();
    const droneB = context.createOscillator();
    const droneGain = context.createGain();
    droneA.type = "sine";
    droneB.type = "triangle";
    droneA.frequency.value = 82.41;
    droneB.frequency.value = 123.47;
    droneGain.gain.value = 0.022;
    droneA.connect(droneGain);
    droneB.connect(droneGain);
    droneGain.connect(musicGain);
    droneA.start();
    droneB.start();

    audio = { context, master, musicGain, sfxGain, droneGain, nextNote: 0, index: 0 };
  }

  function playTone(type) {
    if (!audio) return;
    const { context, sfxGain } = audio;
    if (context.state === "suspended") context.resume();
    const now = context.currentTime;
    const table = {
      punch: { f: 185, to: 72, d: 0.075, w: "square", v: 0.18 },
      shoot: { f: 260, to: 145, d: 0.12, w: "triangle", v: 0.2 },
      hit: { f: 230, to: 125, d: 0.085, w: "sawtooth", v: 0.16 },
      enemyDown: { f: 360, to: 115, d: 0.24, w: "triangle", v: 0.18 },
      hurt: { f: 110, to: 52, d: 0.16, w: "sawtooth", v: 0.22 },
      core: { f: 92, to: 44, d: 0.24, w: "square", v: 0.22 },
      objectBreak: { f: 132, to: 48, d: 0.28, w: "sawtooth", v: 0.2 },
      pickup: { f: 520, to: 780, d: 0.18, w: "sine", v: 0.16 },
      shield: { f: 260, to: 390, d: 0.22, w: "triangle", v: 0.16 },
      blocked: { f: 165, to: 130, d: 0.09, w: "square", v: 0.13 },
      restore: { f: 330, to: 660, d: 0.52, w: "triangle", v: 0.15 },
      exposed: { f: 245, to: 185, d: 0.35, w: "sawtooth", v: 0.14 },
      enemyShot: { f: 300, to: 240, d: 0.065, w: "square", v: 0.1 },
      down: { f: 86, to: 38, d: 0.58, w: "sawtooth", v: 0.2 },
      win: { f: 440, to: 880, d: 0.8, w: "triangle", v: 0.18 }
    };
    const sound = table[type] || table.hit;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = sound.w;
    osc.frequency.setValueAtTime(sound.f, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, sound.to), now + sound.d);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(sound.v, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + sound.d);
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(now);
    osc.stop(now + sound.d + 0.03);

    if (type === "objectBreak" || type === "enemyDown") {
      const low = context.createOscillator();
      const lowGain = context.createGain();
      low.type = "sine";
      low.frequency.setValueAtTime(sound.f * 0.5, now);
      low.frequency.exponentialRampToValueAtTime(34, now + sound.d * 0.8);
      lowGain.gain.setValueAtTime(0.0001, now);
      lowGain.gain.exponentialRampToValueAtTime(sound.v * 0.55, now + 0.02);
      lowGain.gain.exponentialRampToValueAtTime(0.0001, now + sound.d * 0.9);
      low.connect(lowGain);
      lowGain.connect(sfxGain);
      low.start(now);
      low.stop(now + sound.d + 0.02);
    }
  }

  function updateMusic() {
    if (!audio) return;
    const { context, musicGain, droneGain } = audio;
    if (context.state === "suspended") context.resume();
    if (game.state === "dead" || game.state === "menu" || game.state === "paused") {
      musicGain.gain.setTargetAtTime(0.0001, context.currentTime, 0.4);
      droneGain.gain.setTargetAtTime(0.0001, context.currentTime, 0.4);
      return;
    }
    const clean = game.state === "won" ? 1 : (game.servers.length - coresLeftCount()) / game.servers.length;
    musicGain.gain.setTargetAtTime(game.state === "won" ? 0.065 : 0.045, context.currentTime, 0.8);
    droneGain.gain.setTargetAtTime(0.018 + clean * 0.012, context.currentTime, 1.5);
    if (context.currentTime < audio.nextNote) return;

    const scale = clean > 0.55 ? [196, 247, 294, 330, 392, 494] : [147, 196, 220, 247, 294, 330];
    const note = scale[(audio.index + Math.floor(clean * 2)) % scale.length] * (audio.index % 6 === 0 ? 0.5 : 1);
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = clean > 0.55 ? "triangle" : "sine";
    osc.frequency.value = note;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.85);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start();
    osc.stop(context.currentTime + 0.9);
    audio.nextNote = context.currentTime + (clean > 0.55 ? 0.68 : 0.82);
    audio.index += 1;
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    updateMusic();
    render();
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (event) => {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "KeyE", "Escape", "KeyP"].includes(event.code)) {
      event.preventDefault();
    }
    initAudio();
    if ((event.code === "Escape" || event.code === "KeyP") && (game.state === "play" || game.state === "paused")) {
      if (!event.repeat) togglePause();
      return;
    }
    if (game.state === "menu" && (event.code === "Enter" || event.code === "Space")) {
      startGame();
      return;
    }
    keys.add(event.code);
  });
  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
  });
  window.addEventListener("blur", () => {
    keys.clear();
  });
  canvas.addEventListener("pointerdown", (event) => {
    initAudio();
    if (game.state === "menu") {
      startGame();
      return;
    }
    if (game.state !== "play") return;
    const rect = canvas.getBoundingClientRect();
    const p = game.player;
    const worldX = camera.x + (event.clientX - rect.left) * (screenSize().w / rect.width);
    const worldY = camera.y + (event.clientY - rect.top) * (screenSize().h / rect.height);
    p.facing = Math.atan2(worldY - p.y, worldX - p.x);
    if (event.button === 2 || event.shiftKey) throwPlank();
    else punch();
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function polyfillRoundRect(x, y, w, h, r) {
      const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
      this.moveTo(x + radius, y);
      this.arcTo(x + w, y, x + w, y + h, radius);
      this.arcTo(x + w, y + h, x, y + h, radius);
      this.arcTo(x, y + h, x, y, radius);
      this.arcTo(x, y, x + w, y, radius);
      return this;
    };
  }

  resize();
  newGame();
  requestAnimationFrame(loop);
})();
