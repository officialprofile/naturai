(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const WORLD_W = 9600;
  const WORLD_H = 6400;
  const DPR_LIMIT = 2;
  const TAU = Math.PI * 2;
  const TILE = 64;
  const BOSS_X = 9024;
  const BOSS_Y = 2368;
  const DATA_CENTER = { x: 8000, y: 1152, w: 1472, h: 1984, wall: TILE };

  const WATER_RECTS = [
    { x: 0, y: 3200, w: 9600, h: 320 },
    { x: 1024, y: 0, w: 320, h: 3200 },
    { x: 3584, y: 0, w: 320, h: 3200 },
    { x: 6080, y: 2816, w: 3520, h: 384 },
    { x: 7872, y: 768, w: 1728, h: 320 }
  ];

  const ROAD_RECTS = [
    { x: 192, y: 1472, w: 7616, h: 128 },
    { x: 7808, y: 1472, w: 320, h: 128 },
    { x: 8128, y: 1984, w: 1152, h: 128 },
    { x: 2112, y: 1472, w: 128, h: 640 },
    { x: 3328, y: 960, w: 128, h: 640 },
    { x: 4608, y: 1472, w: 128, h: 768 },
    { x: 6016, y: 1472, w: 128, h: 512 },
    { x: 7296, y: 1472, w: 128, h: 768 },
    { x: 8384, y: 1472, w: 128, h: 640 }
  ];

  const FOREST_WALL_RECTS = [
    { x: 0, y: 0, w: 9600, h: 256 },
    { x: 0, y: 3904, w: 9600, h: 256 },
    { x: 0, y: 256, w: 128, h: 3648 },
    { x: 9472, y: 256, w: 128, h: 3648 },
    { x: 128, y: 512, w: 896, h: 128 },
    { x: 128, y: 3456, w: 896, h: 128 },
    { x: 1344, y: 256, w: 192, h: 960 },
    { x: 1344, y: 1792, w: 192, h: 2112 },
    { x: 2688, y: 256, w: 192, h: 1088 },
    { x: 2688, y: 1984, w: 192, h: 1920 },
    { x: 4032, y: 256, w: 192, h: 832 },
    { x: 4032, y: 1664, w: 192, h: 2240 },
    { x: 5376, y: 256, w: 192, h: 1152 },
    { x: 5376, y: 2048, w: 192, h: 1856 },
    { x: 6720, y: 256, w: 192, h: 896 },
    { x: 6720, y: 1792, w: 192, h: 2112 },
    { x: 7808, y: 256, w: 192, h: 1024 },
    { x: 7808, y: 2304, w: 192, h: 1600 }
  ];

  const SERVER_SITES = [
    { x: 1920, y: 2112, tilesW: 6, tilesH: 6, name: "Moss Cache", hp: 14 },
    { x: 2944, y: 1664, tilesW: 8, tilesH: 6, name: "Hive Gate", hp: 16 },
    { x: 4480, y: 2112, tilesW: 8, tilesH: 6, name: "Pine Relay", hp: 16 },
    { x: 5760, y: 832, tilesW: 10, tilesH: 7, name: "Root Rack", hp: 18 },
    { x: 7040, y: 2112, tilesW: 10, tilesH: 7, name: "Fern Array", hp: 22 },
    { x: 8192, y: 1536, tilesW: 12, tilesH: 9, name: "Korpo Data Gate", hp: 30 }
  ];

  const SERVER_SITE_RECTS = SERVER_SITES.map((site) => ({
    x: site.x - TILE * 4,
    y: site.y - TILE * 3,
    w: site.tilesW * TILE + TILE * 8,
    h: site.tilesH * TILE + TILE * 6
  }));

  const SMALL_STREAM_RECTS = [
    { x: 1344, y: 2688, w: 1344, h: 128, bridged: false, bridgeMessageShown: false },
    { x: 4864, y: 0, w: 128, h: 1472, bridged: false, bridgeMessageShown: false },
    { x: 6912, y: 2688, w: 1088, h: 128, bridged: false, bridgeMessageShown: false }
  ];
  const ALL_WATER_RECTS = WATER_RECTS.concat(SMALL_STREAM_RECTS);

  const BURROWS = [
    { x: 640, y: 960, ux: 448, uy: 448, label: "Stara nora" },
    { x: 2368, y: 2944, ux: 1536, uy: 704, label: "Nora przy korzeniach" },
    { x: 5248, y: 1344, ux: 2496, uy: 1536, label: "Nora pod rzeka" },
    { x: 7616, y: 2496, ux: 3392, uy: 1792, label: "Kamienna nora" }
  ];

  const CABINS = [
    { x: 704, y: 640, w: 192, h: 192, item: "book", used: false, title: "Dziennik lesnika" },
    { x: 2496, y: 768, w: 192, h: 192, item: "hat", used: false, title: "Stara czapka" },
    { x: 6336, y: 2496, w: 192, h: 192, item: "boots", used: false, title: "Za duze buty" }
  ];

  const SECRET_HEDGE_RECTS = [
    { x: 512, y: 1920, w: 512, h: 128, name: "Sekretny zarosl", hp: 5 },
    { x: 512, y: 2304, w: 512, h: 128, name: "Sekretny zarosl", hp: 5 },
    { x: 512, y: 1920, w: 128, h: 512, name: "Sekretny zarosl", hp: 5 },
    { x: 896, y: 1920, w: 128, h: 512, name: "Sekretny zarosl", hp: 5 }
  ];

  const UNDER_W = 4096;
  const UNDER_H = 2816;
  const UNDER_TUNNELS = [
    { x: 256, y: 384, w: 1408, h: 128 },
    { x: 896, y: 384, w: 128, h: 960 },
    { x: 896, y: 1216, w: 1152, h: 128 },
    { x: 1472, y: 640, w: 128, h: 960 },
    { x: 1472, y: 640, w: 1152, h: 128 },
    { x: 2432, y: 640, w: 128, h: 1152 },
    { x: 1984, y: 1472, w: 1472, h: 128 },
    { x: 3328, y: 1472, w: 128, h: 512 },
    { x: 640, y: 1856, w: 2816, h: 128 },
    { x: 640, y: 1216, w: 128, h: 768 },
    { x: 2688, y: 1984, w: 128, h: 448 }
  ];

  const MOLE_DATA = [
    { name: "Kret Archiwista", x: 960, y: 1216, lines: ["Pod ziemia przewody gadaja szybciej niz korzenie.", "Przegryz kabel przy serwerowni, a kamery na gorze zasna."] },
    { name: "Kret Elektryk", x: 2480, y: 704, lines: ["Nie musisz gasic pradu, ale bez kamer latwiej dojsc do rdzenia.", "Kable sa czerwone i cieple. Gryz ostroznie, ale stanowczo."] },
    { name: "Kret Kartograf", x: 3360, y: 1792, lines: ["Tunele sa waskie. Patrz pod lapy, bo mrok lubi mylic kierunki."] }
  ];

  const CATERPILLAR_DATA = [
    { x: 512, y: 448 }, { x: 1184, y: 1280 }, { x: 1760, y: 704 },
    { x: 2368, y: 1536 }, { x: 3200, y: 1920 }, { x: 768, y: 1920 }
  ];

  const CABLE_DATA = [
    { serverIndex: 0, x: 1088, y: 1216, w: 512, h: 32 },
    { serverIndex: 1, x: 1472, y: 736, w: 32, h: 640 },
    { serverIndex: 2, x: 1984, y: 640, w: 576, h: 32 },
    { serverIndex: 3, x: 2432, y: 1184, w: 32, h: 512 },
    { serverIndex: 4, x: 2688, y: 1472, w: 640, h: 32 },
    { serverIndex: 5, x: 3328, y: 1472, w: 32, h: 384 }
  ];

  const TERRAIN_SOLIDS = FOREST_WALL_RECTS;
  const PLACEMENT_BLOCKERS = ALL_WATER_RECTS.concat(FOREST_WALL_RECTS, SERVER_SITE_RECTS, CABINS, SECRET_HEDGE_RECTS, [DATA_CENTER]);

  const keys = new Set();
  const particles = [];
  const playerShots = [];
  const enemyShots = [];
  const floatText = [];
  const friendlyCritters = [];
  const followers = [];
  const dolphins = [];

  let audio = null;
  let audioMuted = false;
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

  const FLOWER_LIBRARY = [
    { id: "daisy", label: "STOKROTKA", petals: "white", center: "#f2d84f" },
    { id: "poppy", label: "MAK", petals: "#e53935", center: "#1b1714" },
    { id: "cornflower", label: "CHABER", petals: "#3f7df0", center: "#213d8f" },
    { id: "violet", label: "FIOLEK", petals: "#7d4bc7", center: "#f0d86a" },
    { id: "clover", label: "KONICZYNA", petals: "#f3d7eb", center: "#5fbf62" },
    { id: "dandelion", label: "MNISZEK", petals: "#ffd43b", center: "#d6a820" },
    { id: "bluebell", label: "DZWONEK", petals: "#5a79db", center: "#3350a4" },
    { id: "forget", label: "NIEZAPOMINAJKA", petals: "#7bbcff", center: "#ffd94a" },
    { id: "buttercup", label: "JASKIER", petals: "#ffe15a", center: "#cc9f1a" },
    { id: "thistle", label: "OSET", petals: "#a85ad6", center: "#6a377f" },
    { id: "chamomile", label: "RUMIANEK", petals: "#f7f0dc", center: "#ffd447" }
  ];

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
    const servers = SERVER_SITES.map(makeServer);

    const blockers = [
      makeBlocker(1440, 1504, 192, 576, "Moss Gate"),
      makeBlocker(2784, 1664, 192, 640, "Canopy Lock"),
      makeBlocker(4128, 1376, 192, 576, "Root Switch"),
      makeBlocker(5472, 1728, 192, 640, "Ridge Latch"),
      makeBlocker(6816, 1472, 192, 640, "River Latch"),
      makeBlocker(7904, 1792, 192, 1024, "Data Turnstile")
    ];

    const planks = [
      makePlank(640, 896),
      makePlank(896, 1408),
      makePlank(1856, 2624),
      makePlank(2380, 2880),
      makePlank(3296, 1408),
      makePlank(4800, 1344),
      makePlank(5120, 2176),
      makePlank(6528, 2752),
      makePlank(7424, 2624),
      makePlank(8128, 1440)
    ];

    const enemies = [
      makeEnemy("cat", 2048, 2048, 0),
      makeEnemy("bot", 2176, 2176, 0),
      makeEnemy("drone", 2304, 2112, 0),
      makeEnemy("squirrel", 2240, 2432, 0),
      makeEnemy("dog", 3136, 1856, 1),
      makeEnemy("bot", 3264, 1728, 1),
      makeEnemy("drone", 3392, 1856, 1),
      makeEnemy("squirrel", 3520, 1984, 1),
      makeEnemy("cat", 4608, 2304, 2),
      makeEnemy("bot", 4736, 2176, 2),
      makeEnemy("sentinel", 4928, 2304, 2),
      makeEnemy("cat", 5952, 960, 3),
      makeEnemy("bot", 6080, 1152, 3),
      makeEnemy("sentinel", 6272, 1024, 3),
      makeEnemy("squirrel", 6400, 1216, 3),
      makeEnemy("dog", 7232, 2240, 4),
      makeEnemy("bot", 7360, 2368, 4),
      makeEnemy("drone", 7552, 2240, 4),
      makeEnemy("dog", 8448, 1856, 5),
      makeEnemy("bot", 8576, 1728, 5),
      makeEnemy("drone", 8704, 1856, 5),
      makeEnemy("sentinel", 8832, 2048, 5),
      makeEnemy("cat", 3968, 1472, null),
      makeEnemy("squirrel", 6208, 2496, null),
      makeEnemy("drone", 7680, 2560, null)
    ];
    game = {
      state: "menu",
      time: 0,
      message: "NATURAI",
      messageTimer: 2.8,
      introTimer: 32,
      defenseAwake: false,
      area: "surface",
      activeBurrow: null,
      days: 1,
      dayClock: 0,
      alarmTimer: 0,
      undergroundMessage: 0,
      worldRestored: false,
      victoryTimer: 0,
      victoryAge: 0,
      blockers,
      planks,
      servers,
      enemies,
      pickups: [
        { type: "flower", species: "daisy", x: 832, y: 896, r: 17, taken: false, bob: 0 },
        { type: "flower", species: "poppy", x: 896, y: 1536, r: 17, taken: false, bob: 0.7 },
        { type: "flower", species: "cornflower", x: 1856, y: 2880, r: 17, taken: false, bob: 1.2 },
        { type: "flower", species: "violet", x: 2496, y: 2592, r: 17, taken: false, bob: 1.7 },
        { type: "flower", species: "clover", x: 3264, y: 1408, r: 17, taken: false, bob: 2.3 },
        { type: "flower", species: "dandelion", x: 3968, y: 1856, r: 17, taken: false, bob: 2.9 },
        { type: "flower", species: "bluebell", x: 4736, y: 1984, r: 17, taken: false, bob: 3.7 },
        { type: "flower", species: "forget", x: 5440, y: 1536, r: 17, taken: false, bob: 4.1 },
        { type: "flower", species: "buttercup", x: 6400, y: 768, r: 17, taken: false, bob: 4.6 },
        { type: "flower", species: "thistle", x: 7040, y: 2624, r: 17, taken: false, bob: 5.1 },
        { type: "flower", species: "chamomile", x: 7680, y: 2624, r: 17, taken: false, bob: 5.6 },
        { type: "spinach", x: 704, y: 960, r: 16, taken: false, respawn: 0, bob: 0.4 },
        { type: "spinach", x: 1664, y: 1472, r: 16, taken: false, respawn: 0, bob: 2.4 },
        { type: "spinach", x: 3456, y: 1792, r: 16, taken: false, respawn: 0, bob: 1 },
        { type: "spinach", x: 6016, y: 768, r: 16, taken: false, respawn: 0, bob: 3 },
        { type: "spinach", x: 7616, y: 2624, r: 16, taken: false, respawn: 0, bob: 5 },
        { type: "nut", x: 960, y: 768, r: 12, taken: false, bob: 0.2 },
        { type: "nut", x: 2368, y: 2624, r: 12, taken: false, bob: 1.6 },
        { type: "nut", x: 4608, y: 1792, r: 12, taken: false, bob: 3.2 },
        { type: "nut", x: 6208, y: 2496, r: 12, taken: false, bob: 4.7 },
        { type: "nut", x: 7616, y: 2624, r: 12, taken: false, bob: 5.4 },
        { type: "elixir", x: 768, y: 2176, r: 15, taken: false, bob: 6.1 }
      ],
      npcs: makeBeaverNpcs(),
      moles: makeMoles(),
      caterpillars: makeCaterpillars(),
      cables: makeCables(),
      cabins: CABINS.map((cabin) => ({ ...cabin, used: false })),
      hedges: SECRET_HEDGE_RECTS.map((hedge) => ({ ...hedge, maxHp: hedge.hp, destroyed: false, pulse: rand() * TAU })),
      victoryFlowers: makeVictoryFlowers(),
      wildlife: makeWildlife(),
      dialogLines: [],
      dialogTimer: 0,
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
        nutCooldown: 0,
        useCooldown: 0,
        hurtCooldown: 0,
        shield: 0,
        tailLevel: 0,
        heldPlank: null,
        nuts: 0,
        hat: false,
        boots: false,
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
    followers.length = 0;
    dolphins.length = 0;
    for (const stream of SMALL_STREAM_RECTS) {
      stream.bridged = false;
      stream.bridgeMessageShown = false;
    }
    for (const item of decor) item.chewed = false;
  }

  function makeServer(site) {
    const w = site.tilesW * TILE;
    const h = site.tilesH * TILE;
    const doorTiles = site.tilesW >= 10 ? 4 : 2;
    return {
      x: site.x + w / 2,
      y: site.y + h / 2,
      w,
      h,
      tilesW: site.tilesW,
      tilesH: site.tilesH,
      wall: TILE,
      door: doorTiles * TILE,
      r: TILE * 0.72,
      hp: site.hp,
      maxHp: site.hp,
      destroyed: false,
      powered: true,
      alarmCooldown: 0,
      name: site.name,
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
      angle: rand() > 0.5 ? 0.18 : -0.18,
      bridgeStreamIndex: null
    };
  }

  function makeEnemy(type, x, y, serverIndex) {
    const base = {
      cat: { r: 20, hp: 3.2, speed: 54, damage: 0.5, range: 0, color: "#9aa7a8" },
      dog: { r: 19, hp: 4.2, speed: 52, damage: 0.5, range: 0, color: "#7f8f92" },
      squirrel: { r: 14, hp: 2.2, speed: 68, damage: 0.35, range: 0, color: "#9b8f7a" },
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


  function makeBeaverNpcs() {
    return [
      {
        name: "Stary Bobr",
        x: 392,
        y: 344,
        r: 22,
        phase: 0.2,
        talkCooldown: 0,
        lines: [
          "Ludzie znikneli, a maszyny zostawily po sobie glodne serwerownie.",
          "Bobry trzymaja lad. Delfiny pilnuja wody. Razem mamy jeszcze szanse.",
          "Nie walcz z calym lasem naraz. Najpierw znajdz sciezke, potem slaby przewod.",
          "Kazda serwerownia ma swoj cien. Zniszcz cien, a okolica zacznie oddychac."
        ],
        randomLines: [
          "Jestem przekonany, że gdyby wszyscy ludzie żyli w takiej prostocie jak ja nad stawem, nie znano by złodziejstwa ani rabunku.",
          "Prostota, prostota, prostota! Powiadam wam, niech wasze sprawy będą dwiema lub trzema, a nie stu lub tysiącem.",
          "Poranek to czas, kiedy się budzę i budzę we mnie intelekt. Najbardziej inspirująca część dnia to ta, kiedy człowiek wraca do życia z głębokiego snu."
        ]
      },
      {
        name: "Ciesla Tam",
        x: 768,
        y: 896,
        r: 22,
        phase: 1.6,
        talkCooldown: 0,
        lines: [
          "Zbieraj kwiaty. Ogon rosnie powoli, ale kazdy platkowy sok pomaga.",
          "J bierze albo upuszcza deske. K rzuca. Orzeszki zostaw na koty i wiewiorki.",
          "Przy waskim strumieniu odloz deski na nurcie. Dwie dobrze ulozone wystarcza.",
          "Jesli deska wskoczy prosto przez wode, to znaczy, ze znalazla swoje miejsce."
        ]
      },
      {
        name: "Mlody Zwiadowca",
        x: 896,
        y: 1664,
        r: 21,
        phase: 2.7,
        talkCooldown: 0,
        lines: [
          "Nie spiesz sie do serwerowni. Najpierw poznaj mokre sciezki i stare nory.",
          "Na dalszej rzece czasem wyskakuja delfiny. Na razie tylko obserwuja.",
          "Rzeki przychodza zza scian krzakow. Tam gdzie nie wejdziesz, tam las zaczyna opowiesc.",
          "Nie kazda droga jest prosta, ale wszystkie wielkie bramy stoja w poprzek postepu."
        ]
      },
      {
        name: "Bobr od Zapachow",
        x: 2368,
        y: 2592,
        r: 21,
        phase: 3.4,
        talkCooldown: 0,
        lines: [
          "Kamery budza alarm, jesli wejdziesz w ich oko. Pod ziemia ida przewody.",
          "Nora to nie skrot. To drugi las, tylko bez nieba.",
          "Kable sa jak korzenie maszyn. Przetniesz prad, a oko kamery robi sie slepe.",
          "Krety mowia cicho, ale wiedza, ktory przewod boli najbardziej."
        ]
      },
      {
        name: "Bobr Przeprawowy",
        x: 3968,
        y: 1472,
        r: 22,
        phase: 4.2,
        talkCooldown: 0,
        lines: [
          "Male rzeczki da sie oszukac deskami. Nie zawsze to potrzebne, ale las to pamieta.",
          "Jesli nurt zacznie omijac deski, znaczy ze zrobiles cos bardzo bobrowego.",
          "Nie kazda tama zatrzymuje rzeke. Czasem wystarczy pokazac jej ladniejszy zakret.",
          "W glebi krzakow podobno ktos schowal butelke po bardzo nierozsadnym zielarzu."
        ]
      },
      {
        name: "Bobr z Gorskiej Sciezki",
        x: 6208,
        y: 704,
        r: 22,
        phase: 5.1,
        talkCooldown: 0,
        lines: [
          "W gorach technologia brzmi cieniej. Ale kamery widza dalej.",
          "Nie wszystko trzeba gryzc. Czasem wystarczy przeczytac stara kartke w chacie.",
          "Gorskie serwerownie sa wieksze, ale ich pycha robi je mniej uwaznymi.",
          "Jesli brama wyglada obojetnie, to tylko czeka, az pierwszy raz ja ugryziesz."
        ]
      },
      {
        name: "Bobr Nad Rzeka",
        x: 7552,
        y: 2560,
        r: 22,
        phase: 5.9,
        talkCooldown: 0,
        lines: [
          "Delfiny wyskakuja tylko tam, gdzie woda jest gleboka.",
          "Jesli zobaczysz je nad ziemia, to znaczy, ze swiat znowu ma blad.",
          "Za ostatnimi drzewami stoi data center. Tam muzyka sama robi sie ciezsza.",
          "Po wszystkim nie uciekaj. Zobacz, czy natura naprawde wrocila na swoje miejsce."
        ]
      }
    ];
  }

  function makeMoles() {
    return MOLE_DATA.map((mole) => ({ ...mole, r: 19, phase: rand() * TAU, talkCooldown: 0 }));
  }

  function makeCaterpillars() {
    return CATERPILLAR_DATA.map((item) => ({ ...item, r: 9, phase: rand() * TAU, dir: rand() * TAU }));
  }

  function makeVictoryFlowers() {
    const flowers = [];
    let attempts = 0;
    while (flowers.length < 190 && attempts < 4000) {
      attempts += 1;
      const x = Math.floor((2 + rand() * (WORLD_W / TILE - 4))) * TILE + TILE / 2;
      const y = Math.floor((5 + rand() * 50)) * TILE + TILE / 2;
      if (pointHitsAny(x, y, ALL_WATER_RECTS, 30) || pointHitsAny(x, y, FOREST_WALL_RECTS, 28)) continue;
      flowers.push({
        x,
        y,
        species: FLOWER_LIBRARY[Math.floor(rand() * FLOWER_LIBRARY.length)].id,
        bob: rand() * TAU
      });
    }
    return flowers;
  }

  function makeWildlife() {
    return [
      { type: "deer", x: 1376, y: 960, r: 22, phase: rand() * TAU, dir: 0.2 },
      { type: "hare", x: 2600, y: 1376, r: 12, phase: rand() * TAU, dir: -0.4 },
      { type: "fox", x: 3808, y: 2944, r: 16, phase: rand() * TAU, dir: 0.8 },
      { type: "boar", x: 5248, y: 2624, r: 19, phase: rand() * TAU, dir: -0.6 },
      { type: "deer", x: 6784, y: 896, r: 22, phase: rand() * TAU, dir: 0.5 },
      { type: "hare", x: 8448, y: 2944, r: 12, phase: rand() * TAU, dir: 0.1 }
    ];
  }

  function makeCables() {
    return CABLE_DATA.map((cable) => ({ ...cable, cut: false, pulse: rand() * TAU }));
  }

  function buildDecor() {
    const items = [];
    let attempts = 0;
    while (items.length < 620 && attempts < 7000) {
      attempts += 1;
      const x = Math.floor((1 + rand() * (WORLD_W / TILE - 2))) * TILE + TILE / 2;
      const y = Math.floor((1 + rand() * (WORLD_H / TILE - 2))) * TILE + TILE / 2;
      const test = { x: x - 40, y: y - 40, w: 80, h: 80 };
      if (rectHitsAny(test, PLACEMENT_BLOCKERS) || rectHitsAny(test, ROAD_RECTS)) continue;
      if (Math.hypot(x - 230, y - 300) < 360) continue;
      const typeRoll = rand();
      let type = "bush";
      if (typeRoll > 0.8) type = "rock";
      if (typeRoll > 0.92) type = "flower";
      const chewable = type === "bush" && rand() < 0.09;
      items.push({
        type,
        x,
        y,
        r: type === "bush" ? 22 + rand() * 14 : 8 + rand() * 12,
        chewable,
        chewed: false,
        species: type === "flower" ? FLOWER_LIBRARY[Math.floor(rand() * FLOWER_LIBRARY.length)].id : null,
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
    game.dialogTimer = Math.max(0, game.dialogTimer - dt);
    if (game.victoryTimer > 0) {
      game.victoryTimer = Math.max(0, game.victoryTimer - dt);
      game.victoryAge += dt;
    }
    game.introTimer = Math.max(0, game.introTimer - dt);
    game.dayClock += dt;
    if (game.dayClock > 75) {
      game.dayClock = 0;
      game.days += 1;
    }
    updatePlayer(dt);
    if (game.area === "surface") {
      updateNpcs(dt);
      updatePickups(dt);
      updatePlanks(dt);
      updateStreams();
      updateSecurityCameras(dt);
      updateBlockers(dt);
      updateEnemies(dt);
      updateFollowers(dt);
      updateDolphins(dt);
      updateWildlife(dt);
      updateBoss(dt);
      updateShots(dt);
    } else {
      updateMoles(dt);
      updateCaterpillars(dt);
    }
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

  function currentBounds() {
    return game.area === "underground" ? { w: UNDER_W, h: UNDER_H } : { w: WORLD_W, h: WORLD_H };
  }

  function circleInTunnels(entity, margin = 0) {
    return UNDER_TUNNELS.some((rect) => pointInRect(entity.x, entity.y, rect, -entity.r * 0.25 + margin));
  }

  function tryUseBurrow() {
    const p = game.player;
    if (p.useCooldown > 0) return false;
    let best = null;
    let bestDistance = 62;
    const list = game.area === "surface" ? BURROWS : BURROWS.map((burrow) => ({ ...burrow, x: burrow.ux, y: burrow.uy }));
    for (const burrow of list) {
      const d = Math.hypot(burrow.x - p.x, burrow.y - p.y);
      if (d < bestDistance) {
        best = burrow;
        bestDistance = d;
      }
    }
    if (!best) return false;
    p.useCooldown = 0.55;
    if (game.area === "surface") {
      game.area = "underground";
      game.activeBurrow = best.label;
      p.x = best.ux;
      p.y = best.uy;
      p.swimming = false;
      clearFollowers("water");
      game.message = "SCHODZISZ DO NORY";
    } else {
      const surface = BURROWS.find((burrow) => burrow.label === best.label) || BURROWS[0];
      game.area = "surface";
      game.activeBurrow = null;
      p.x = surface.x;
      p.y = surface.y + 42;
      game.message = "WRACASZ NA POWIERZCHNIE";
    }
    game.messageTimer = 1.8;
    camera.x = 0;
    camera.y = 0;
    playTone("pickup");
    return true;
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

    const waterBefore = game.area === "surface" && pointHitsAny(p.x, p.y, ALL_WATER_RECTS, p.r * 0.5);
    const speed = p.speed * (p.shield > 0 ? 0.96 : 1) * (waterBefore ? 0.88 : 1) * (game.area === "underground" ? 0.92 : 1);
    moveCircle(p, dx * speed * dt, dy * speed * dt);
    p.swimming = game.area === "surface" && pointHitsAny(p.x, p.y, ALL_WATER_RECTS, p.r * 0.55);
    if (p.swimming) clearFollowers("water");

    if (!game.defenseAwake && game.introTimer <= 0) {
      const roomIndex = game.servers.findIndex((server) => !server.destroyed && pointInRoom(server, p, 6));
      if (roomIndex >= 0) wakeDefense(roomIndex);
    }

    p.punchCooldown = Math.max(0, p.punchCooldown - dt);
    p.throwCooldown = Math.max(0, p.throwCooldown - dt);
    p.nutCooldown = Math.max(0, p.nutCooldown - dt);
    p.useCooldown = Math.max(0, p.useCooldown - dt);
    p.hurtCooldown = Math.max(0, p.hurtCooldown - dt);
    p.shield = Math.max(0, p.shield - dt);

    if (keys.has("KeyE")) {
      if (!tryUseBurrow()) grabPlank();
    }
    if (keys.has("Space")) punch();
  }

  function moveCircle(entity, dx, dy) {
    const oldX = entity.x;
    const oldY = entity.y;
    const bounds = currentBounds();
    entity.x = clamp(entity.x + dx, entity.r + 18, bounds.w - entity.r - 18);
    entity.y = clamp(entity.y + dy, entity.r + 18, bounds.h - entity.r - 18);

    if (game.area === "underground") {
      if (!circleInTunnels(entity)) {
        entity.x = oldX;
        entity.y = oldY;
      }
      return;
    }

    for (const solid of TERRAIN_SOLIDS) {
      pushOutOfRect(entity, solid);
    }

    for (const item of decor) {
      if (item.chewed || item.type === "flower") continue;
      const radius = item.type === "rock" ? item.r * 0.75 : item.r * 0.78;
      const push = entity.r + radius - Math.hypot(entity.x - item.x, entity.y - item.y);
      if (push > 0) {
        const a = Math.atan2(entity.y - item.y, entity.x - item.x);
        entity.x += Math.cos(a) * push;
        entity.y += Math.sin(a) * push;
      }
    }

    for (const hedge of game.hedges) {
      if (!hedge.destroyed) pushOutOfRect(entity, hedge);
    }

    for (const cabin of game.cabins) {
      for (const wall of cabinWalls(cabin)) pushOutOfRect(entity, wall);
    }

    for (const wall of dataCenterWalls()) pushOutOfRect(entity, wall);

    if ((entity.type === "cat" || entity.type === "dog" || entity.type === "squirrel") && pointHitsAny(entity.x, entity.y, ALL_WATER_RECTS, entity.r * 0.8)) {
      entity.x = oldX;
      entity.y = oldY;
      entity.wander = (entity.wander || 0) + Math.PI * 0.7;
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
    if (tryTalkToBeaver() || tryInteractCabin() || tryEatCaterpillar()) {
      p.punchCooldown = 0.34;
      return;
    }
    clearFollowers("attack");
    p.punchCooldown = 0.46;
    camera.shake = Math.max(camera.shake, 2);
    playTone("punch");

    const biteReach = 27 + Math.min(18, p.tailLevel * 1.35);
    const hit = {
      x: p.x + Math.cos(p.facing) * biteReach,
      y: p.y + Math.sin(p.facing) * biteReach,
      r: 24
    };
    const damage = 1.7 + p.tailLevel * 0.34;

    spawnArc(hit.x, hit.y, p.facing, palette.beaverDark);
    damageWorld(hit, damage, p.facing);
  }

  function handlePlankAction() {
    if (game.player.heldPlank) dropPlank();
    else grabPlank();
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

  function dropPlank() {
    const p = game.player;
    const plank = p.heldPlank;
    if (!plank) return;
    plank.taken = false;
    plank.x = p.x + Math.cos(p.facing) * 30;
    plank.y = p.y + Math.sin(p.facing) * 30;
    plank.angle = p.facing + 0.12;
    plank.bob = rand() * TAU;
    plank.bridgeStreamIndex = null;
    const snapped = snapPlankToStream(plank);
    p.heldPlank = null;
    if (snapped) {
      game.message = "DESKA NA STRUMIENIU";
      game.messageTimer = 1.15;
    }
    playTone("drop");
  }

  function snapPlankToStream(plank) {
    if (game.area !== "surface") return false;
    for (let i = 0; i < SMALL_STREAM_RECTS.length; i += 1) {
      const stream = SMALL_STREAM_RECTS[i];
      const horizontal = stream.w > stream.h;
      if (horizontal) {
        const centerY = stream.y + stream.h / 2;
        if (plank.x > stream.x + TILE * 0.5 && plank.x < stream.x + stream.w - TILE * 0.5 && Math.abs(plank.y - centerY) < 76) {
          plank.y = centerY;
          plank.x = Math.round(plank.x / TILE) * TILE + TILE / 2;
          plank.angle = Math.PI / 2;
          plank.bridgeStreamIndex = i;
          return true;
        }
      } else {
        const centerX = stream.x + stream.w / 2;
        if (plank.y > stream.y + TILE * 0.5 && plank.y < stream.y + stream.h - TILE * 0.5 && Math.abs(plank.x - centerX) < 76) {
          plank.x = centerX;
          plank.y = Math.round(plank.y / TILE) * TILE + TILE / 2;
          plank.angle = 0;
          plank.bridgeStreamIndex = i;
          return true;
        }
      }
    }
    return false;
  }

  function throwPlank() {
    const p = game.player;
    if (p.throwCooldown > 0) return;
    if (!p.heldPlank) {
      game.message = "NIE MASZ DESKI";
      game.messageTimer = 1.2;
      playTone("blocked");
      return;
    }
    clearFollowers("attack");
    p.throwCooldown = 0.55;
    const v = vectorFromAngle(p.facing, 520);
    p.heldPlank.bridgeStreamIndex = null;
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

  function throwNut() {
    const p = game.player;
    if (p.nutCooldown > 0) return;
    if (p.nuts <= 0) {
      game.message = "BRAK ORZESZKOW";
      game.messageTimer = 1.2;
      playTone("blocked");
      return;
    }
    p.nuts -= 1;
    p.nutCooldown = 0.42;
    const v = vectorFromAngle(p.facing, 430);
    playerShots.push({
      type: "nut",
      x: p.x + Math.cos(p.facing) * 22,
      y: p.y + Math.sin(p.facing) * 22,
      vx: v.x,
      vy: v.y,
      r: 8,
      damage: 0.75,
      life: 1.35,
      angle: p.facing,
      spin: 12,
      color: "#9b6a35"
    });
    playTone("nut");
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
    if (game.area === "underground") {
      chewCable(hit);
      return;
    }
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

    hurtSecretHedges(hit, damage);

    for (const server of game.servers) {
      if (!server.destroyed && circleHit(hit, server, 8)) {
        hurtServer(server, damage);
      }
    }

    const boss = game.boss;
    if (!boss.defeated && circleHit(hit, boss, 8)) {
      hurtBoss(damage);
    }

    chewBushes(hit, direction);
  }

  function chewBushes(hit, direction) {
    for (const item of decor) {
      if (item.type !== "bush" || !item.chewable || item.chewed) continue;
      if (Math.hypot(hit.x - item.x, hit.y - item.y) > hit.r + item.r + 4) continue;
      item.chewed = true;
      const plank = makePlank(item.x + Math.cos(direction) * 18, item.y + Math.sin(direction) * 18);
      plank.angle = direction + 0.25;
      game.planks.push(plank);
      burst(item.x, item.y, 18, "#7ff06c");
      playTone("objectBreak");
      game.message = "KRZAK -> DESKA";
      game.messageTimer = 1.4;
      return;
    }
  }


  function hurtSecretHedges(hit, damage) {
    for (const hedge of game.hedges) {
      if (hedge.destroyed || !rectCircleHit(hit, hedge, 8)) continue;
      hedge.hp -= damage;
      hedge.pulse += 1.2;
      burst(hit.x, hit.y, 12, "#7ff06c");
      playTone("hit");
      if (hedge.hp <= 0) {
        hedge.destroyed = true;
        game.message = "KRZAKI PRZEGRYZIONE";
        game.messageTimer = 1.8;
        burst(hedge.x + hedge.w / 2, hedge.y + hedge.h / 2, 38, palette.leafLight);
        playTone("objectBreak");
      }
      return true;
    }
    return false;
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
      if (enemy.type === "cat" || enemy.type === "dog" || enemy.type === "squirrel") {
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
    server.hp -= server.powered ? damage : damage * 1.35;
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
      restoreWorldAfterBoss();
      burst(boss.x, boss.y, 160, palette.leafLight);
      camera.shake = 22;
      playTone("win");
    }
  }

  function restoreWorldAfterBoss() {
    game.worldRestored = true;
    game.victoryTimer = 8;
    game.victoryAge = 0;
    game.defenseAwake = false;
    game.alarmTimer = 0;
    game.message = "";
    game.messageTimer = 0;
    for (const server of game.servers) {
      server.destroyed = true;
      server.powered = false;
      server.hp = 0;
    }
    for (const blocker of game.blockers) {
      blocker.destroyed = true;
      blocker.awake = false;
      blocker.hp = 0;
    }
    for (const enemy of game.enemies) enemy.hp = 0;
    enemyShots.length = 0;
    playerShots.length = 0;
    clearFollowers("restore");
  }

  function updatePickups(dt) {
    for (const pickup of game.pickups) {
      pickup.bob += dt * 3;
      if (pickup.taken) {
        if (pickup.type === "spinach") {
          pickup.respawn -= dt;
          if (pickup.respawn <= 0) pickup.taken = false;
        }
        continue;
      }
      if (circleHit(game.player, pickup, 8)) {
        pickup.taken = true;
        if (pickup.type === "flower") {
          game.player.tailLevel += 0.25;
          const flower = flowerInfo(pickup.species);
          game.message = flower.label + ": OGON +";
          game.messageTimer = 2.4;
          burst(pickup.x, pickup.y, 30, flower.petals);
          playTone("pickup");
        } else if (pickup.type === "nut") {
          game.player.nuts = Math.min(6, game.player.nuts + 1);
          game.message = "ORZESZEK +1";
          game.messageTimer = 1.5;
          burst(pickup.x, pickup.y, 18, "#b77b43");
          playTone("pickup");
        } else if (pickup.type === "elixir") {
          game.player.tailLevel = Math.max(2, game.player.tailLevel * 2);
          game.message = "ELIKSIR OGONA x2";
          game.messageTimer = 2.8;
          burst(pickup.x, pickup.y, 48, palette.aiViolet);
          playTone("restore");
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

  function updateNpcs(dt) {
    for (const npc of game.npcs) {
      npc.phase += dt * 1.1;
      npc.talkCooldown = Math.max(0, npc.talkCooldown - dt);
    }
  }

  function tryTalkToBeaver() {
    const p = game.player;
    let best = null;
    let bestDistance = 72;
    const talkers = game.area === "underground" ? game.moles : game.npcs;
    for (const npc of talkers) {
      const d = Math.hypot(npc.x - p.x, npc.y - p.y);
      if (d < bestDistance) {
        best = npc;
        bestDistance = d;
      }
    }
    if (!best || best.talkCooldown > 0) return false;
    best.talkCooldown = 1.3;
    const lines = best.randomLines ? [best.randomLines[Math.floor(rand() * best.randomLines.length)]] : best.lines;
    game.message = best.name;
    game.messageTimer = 4.8;
    game.dialogLines = lines;
    game.dialogTimer = best.randomLines ? 8.2 : 6.2;
    p.facing = Math.atan2(best.y - p.y, best.x - p.x);
    playTone("pickup");
    return true;
  }


  function tryEatCaterpillar() {
    if (game.area !== "underground") return false;
    const p = game.player;
    let best = null;
    let bestDistance = 46;
    for (const caterpillar of game.caterpillars) {
      if (caterpillar.eaten) continue;
      const d = Math.hypot(caterpillar.x - p.x, caterpillar.y - p.y);
      if (d < bestDistance) {
        best = caterpillar;
        bestDistance = d;
      }
    }
    if (!best) return false;
    best.eaten = true;
    p.hp = Math.min(p.maxHp, p.hp + 0.5);
    game.message = "GASIENICA +1/2 ZYCIA";
    game.messageTimer = 1.6;
    burst(best.x, best.y, 18, "#b7d86a");
    playTone("pickup");
    return true;
  }

  function clearFollowers(reason) {
    if (!followers.length) return;
    if (reason === "attack") {
      game.message = "TOWARZYSZE UCIEKLI";
      game.messageTimer = 1.4;
    }
    followers.length = 0;
  }

  function tameAnimal(enemy) {
    enemy.hp = 0;
    followers.push({
      type: enemy.type,
      x: enemy.x,
      y: enemy.y,
      r: enemy.r,
      phase: rand() * TAU,
      life: 180,
      slot: followers.length
    });
    game.message = enemy.type === "cat" ? "KOT IDZIE ZA TOBA" : "WIEWIORKA IDZIE ZA TOBA";
    game.messageTimer = 2.2;
    burst(enemy.x, enemy.y, 24, "#f2d58a");
    playTone("pickup");
  }

  function updateFollowers(dt) {
    const p = game.player;
    for (const follower of followers) {
      follower.life -= dt;
      follower.phase += dt * 3;
      const slot = follower.slot % 5;
      const angle = p.facing + Math.PI + (slot - 2) * 0.45;
      const targetX = p.x + Math.cos(angle) * (58 + slot * 13);
      const targetY = p.y + Math.sin(angle) * (44 + slot * 9);
      follower.x = lerp(follower.x, targetX, 1 - Math.pow(0.02, dt));
      follower.y = lerp(follower.y, targetY, 1 - Math.pow(0.02, dt));
    }
    for (let i = followers.length - 1; i >= 0; i -= 1) {
      if (followers[i].life <= 0) followers.splice(i, 1);
    }
  }

  function waterRectAt(x, y, inset = 0) {
    return WATER_RECTS.find((rect) => pointInRect(x, y, rect, -inset));
  }

  function spawnDolphinNearPlayer() {
    const p = game.player;
    const current = waterRectAt(p.x, p.y, 46);
    const candidates = current ? [current] : WATER_RECTS.filter((rect) => rect.w >= 256 && rect.h >= 256);
    for (let i = 0; i < 10; i += 1) {
      const rect = candidates[Math.floor(rand() * candidates.length)];
      const horizontal = rect.w >= rect.h;
      const travel = horizontal ? Math.min(150, rect.w * 0.3) : Math.min(150, rect.h * 0.3);
      const margin = travel / 2 + 58;
      if ((horizontal && rect.w < margin * 2 + 20) || (!horizontal && rect.h < margin * 2 + 20)) continue;
      const x = horizontal ? clamp(p.x + (rand() - 0.5) * 520, rect.x + margin, rect.x + rect.w - margin) : rect.x + rect.w / 2 + (rand() - 0.5) * Math.max(0, rect.w - 140);
      const y = horizontal ? rect.y + rect.h / 2 + (rand() - 0.5) * Math.max(0, rect.h - 140) : clamp(p.y + (rand() - 0.5) * 420, rect.y + margin, rect.y + rect.h - margin);
      if (!pointInRect(x, y, rect, -48)) continue;
      const dir = horizontal ? (rand() > 0.5 ? 0 : Math.PI) : (rand() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
      dolphins.push({
        x,
        y,
        dir,
        travel,
        life: 2.15,
        maxLife: 2.15,
        phase: rand() * TAU
      });
      return true;
    }
    return false;
  }

  function updateDolphins(dt) {
    const p = game.player;
    if (game.area === "surface" && p.swimming && (p.x > 3300 || p.y > 2600) && dolphins.length < 3 && rand() < dt * 0.22) {
      spawnDolphinNearPlayer();
    }
    for (const dolphin of dolphins) {
      dolphin.life -= dt;
      dolphin.phase += dt * 5.4;
    }
    for (let i = dolphins.length - 1; i >= 0; i -= 1) {
      if (dolphins[i].life <= 0) dolphins.splice(i, 1);
    }
  }

  function updateMoles(dt) {
    for (const mole of game.moles) {
      mole.phase += dt * 1.4;
      mole.talkCooldown = Math.max(0, mole.talkCooldown - dt);
    }
  }

  function caterpillarInTunnel(caterpillar) {
    return UNDER_TUNNELS.some((rect) => pointInRect(caterpillar.x, caterpillar.y, rect, -caterpillar.r - 3));
  }

  function caterpillarTouchesMole(caterpillar) {
    return game.moles.some((mole) => Math.hypot(caterpillar.x - mole.x, caterpillar.y - mole.y) < caterpillar.r + mole.r + 10);
  }

  function updateCaterpillars(dt) {
    for (const caterpillar of game.caterpillars) {
      if (caterpillar.eaten) continue;
      caterpillar.phase += dt * 3.2;
      if (rand() < dt * 0.8) caterpillar.dir += (rand() - 0.5) * 1.2;
      const oldX = caterpillar.x;
      const oldY = caterpillar.y;
      caterpillar.x += Math.cos(caterpillar.dir) * 14 * dt;
      caterpillar.y += Math.sin(caterpillar.dir) * 14 * dt;
      if (!caterpillarInTunnel(caterpillar) || caterpillarTouchesMole(caterpillar)) {
        caterpillar.x = oldX;
        caterpillar.y = oldY;
        caterpillar.dir += Math.PI * (0.72 + rand() * 0.35);
      }
    }
  }

  function updateWildlife(dt) {
    if (!game.worldRestored) return;
    for (const animal of game.wildlife) {
      animal.phase += dt * 2;
      if (rand() < dt * 0.35) animal.dir += (rand() - 0.5) * 0.9;
      const oldX = animal.x;
      const oldY = animal.y;
      const speed = animal.type === "hare" ? 28 : animal.type === "deer" ? 18 : 16;
      animal.x += Math.cos(animal.dir) * speed * dt;
      animal.y += Math.sin(animal.dir) * speed * dt;
      if (pointHitsAny(animal.x, animal.y, ALL_WATER_RECTS, animal.r + 10) || pointHitsAny(animal.x, animal.y, FOREST_WALL_RECTS, animal.r + 8)) {
        animal.x = oldX;
        animal.y = oldY;
        animal.dir += Math.PI * 0.65;
      }
    }
  }

  function chewCable(hit) {
    for (const cable of game.cables) {
      if (cable.cut || !rectCircleHit(hit, cable, 8)) continue;
      cable.cut = true;
      const server = game.servers[cable.serverIndex];
      if (server) server.powered = false;
      game.message = server ? server.name + " BEZ PRADU" : "KABEL PRZEGRYZIONY";
      game.messageTimer = 2.3;
      burst(hit.x, hit.y, 34, palette.aiBlue);
      playTone("objectBreak");
      return true;
    }
    return false;
  }

  function tryInteractCabin() {
    if (game.area !== "surface") return false;
    const p = game.player;
    for (const cabin of game.cabins) {
      const near = p.x > cabin.x - 28 && p.x < cabin.x + cabin.w + 28 && p.y > cabin.y - 32 && p.y < cabin.y + cabin.h + 42;
      if (!near) continue;
      cabin.used = true;
      game.message = cabin.title;
      game.messageTimer = 4.8;
      if (cabin.item === "book") {
        game.dialogLines = ["Na wilgotnej stronie czytasz: kiedy las zapomina cisze, trzeba zaczac od odnalezienia zrodla brzeczenia."];
        game.dialogTimer = 6.2;
      } else if (cabin.item === "hat") {
        p.hat = true;
        game.dialogLines = ["Zakladasz czapke. Jest za duza i pachnie kurzem, ale wyglada dzielnie."];
        game.dialogTimer = 4.2;
      } else {
        p.boots = true;
        game.dialogLines = ["Buty sa ludzkie i kompletnie niepraktyczne dla bobra. Mimo to przez chwile czujesz sie elegancko."];
        game.dialogTimer = 4.8;
      }
      playTone("pickup");
      return true;
    }
    return false;
  }

  function updateSecurityCameras(dt) {
    if (game.area !== "surface") return;
    const p = game.player;
    game.alarmTimer = Math.max(0, game.alarmTimer - dt);
    for (let i = 0; i < game.servers.length; i += 1) {
      const server = game.servers[i];
      server.alarmCooldown = Math.max(0, server.alarmCooldown - dt);
      if (server.destroyed || !server.powered || server.alarmCooldown > 0) continue;
      for (const camera of serverCameras(server)) {
        if (!pointInCameraCone(p.x, p.y, camera)) continue;
        server.alarmCooldown = 4.5;
        game.alarmTimer = 2.8;
        game.message = "ALARM KAMERY: " + server.name;
        game.messageTimer = 2.4;
        wakeDefense(i);
        playTone("blocked");
        break;
      }
    }
  }

  function serverCameras(server) {
    const b = roomBounds(server);
    return [
      { x: b.x - 12, y: b.y + TILE, a: Math.PI, range: 330, spread: 0.45 },
      { x: b.x + b.w + 12, y: b.y + b.h - TILE, a: 0, range: 330, spread: 0.45 },
      { x: server.x, y: b.y - 12, a: -Math.PI / 2, range: 300, spread: 0.42 }
    ];
  }

  function pointInCameraCone(x, y, camera) {
    const dx = x - camera.x;
    const dy = y - camera.y;
    const d = Math.hypot(dx, dy);
    if (d > camera.range || d < 18) return false;
    const diff = Math.atan2(Math.sin(Math.atan2(dy, dx) - camera.a), Math.cos(Math.atan2(dy, dx) - camera.a));
    return Math.abs(diff) < camera.spread;
  }

  function updateStreams() {
    for (let i = 0; i < SMALL_STREAM_RECTS.length; i += 1) {
      const stream = SMALL_STREAM_RECTS[i];
      const planks = game.planks.filter((plank) => !plank.taken && plank.bridgeStreamIndex === i);
      const wasBridged = stream.bridged;
      stream.bridged = planks.length >= 2;
      if (stream.bridged && !wasBridged && !stream.bridgeMessageShown) {
        stream.bridgeMessageShown = true;
        game.message = "NURT OBCHODZI DESKI";
        game.messageTimer = 2.1;
        playTone("restore");
      }
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
    for (const wall of dataCenterWalls()) {
      if (rectCircleHit(shot, wall, 0)) return true;
    }
    if (includeBlockers) {
      for (const blocker of game.blockers) {
        if (!blocker.destroyed && rectCircleHit(shot, blocker, 0)) return true;
      }
    }
    return false;
  }

  function steerNut(shot, dt) {
    let best = null;
    let bestDistance = 170;
    for (const enemy of game.enemies) {
      if (enemy.hp <= 0 || (enemy.type !== "cat" && enemy.type !== "squirrel")) continue;
      const d = Math.hypot(enemy.x - shot.x, enemy.y - shot.y);
      if (d < bestDistance) {
        best = enemy;
        bestDistance = d;
      }
    }
    if (!best) return;
    const speed = Math.hypot(shot.vx, shot.vy) || 360;
    const current = Math.atan2(shot.vy, shot.vx);
    const target = Math.atan2(best.y - shot.y, best.x - shot.x);
    const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    const next = current + clamp(diff, -dt * 5.2, dt * 5.2);
    shot.vx = Math.cos(next) * speed;
    shot.vy = Math.sin(next) * speed;
  }

  function updateShots(dt) {
    for (const shot of playerShots) {
      if (shot.type === "nut") steerNut(shot, dt);
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
        const hitExtra = shot.type === "nut" ? 18 : 0;
        if (enemy.hp > 0 && circleHit(shot, enemy, hitExtra)) {
          if (shot.type === "nut" && (enemy.type === "cat" || enemy.type === "squirrel")) {
            tameAnimal(enemy);
          } else {
            if (shot.type === "nut" && !(enemy.type === "cat" || enemy.type === "squirrel")) clearFollowers("attack");
            hurtEnemy(enemy, shot.damage, Math.atan2(shot.vy, shot.vx));
          }
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
    clearFollowers("hurt");
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
    const bounds = currentBounds();
    const targetX = clamp(p.x - size.w / 2, 0, Math.max(0, bounds.w - size.w));
    const targetY = clamp(p.y - size.h / 2, 0, Math.max(0, bounds.h - size.h));
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
    if (game.area === "underground") {
      drawUndergroundWorld();
      drawCaterpillars();
      drawMoles();
      drawPlayer();
      drawParticles();
    } else {
      drawWorld();
      drawDataCenter();
      drawForestWalls();
      drawDecor();
      drawVictoryFlowers();
      drawSecretHedges();
      drawCabins();
      drawBurrows();
      drawPickups();
      drawPlanks();
      drawDolphins();
      drawNpcs();
      drawSecurityCameras();
      drawBlockers();
      drawServers();
      drawFriendlyCritters();
      drawFollowers();
      drawWildlife();
      drawBoss();
      drawEnemies();
      drawShots();
      drawPlayer();
      drawParticles();
    }
    ctx.restore();

    if (game.area === "underground") drawUndergroundFog(size);
    if (game.state !== "menu") drawHud(size);
    drawVignette(size);
    drawOverlay(size);
  }

  function drawWorld() {
    drawTerrainGrid();
    drawSmallStreamEffects();

    for (const dot of terrainDots) {
      ctx.fillStyle = dot.c;
      ctx.fillRect(Math.round(dot.x), Math.round(dot.y), Math.max(1, Math.round(dot.r)), Math.max(1, Math.round(dot.r)));
    }

    if (game.worldRestored) {
      drawRestoredField(WORLD_W * 0.52, 2016, 5200, 0.16);
      return;
    }

    for (const server of game.servers) {
      if (!server.destroyed && game.state !== "won") {
        drawCorruptionField(server.x, server.y, 360, 0.22);
      } else {
        drawRestoredField(server.x, server.y, 290, 0.2);
      }
    }

    if (!game.boss.defeated) drawCorruptionField(game.boss.x, game.boss.y, 600, coresLeftCount() ? 0.28 : 0.2);
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
        const water = rectHitsAny(tile, ALL_WATER_RECTS);
        const road = rectHitsAny(tile, ROAD_RECTS);
        const mountain = !water && !road && (x > 6400 || y > 4200 || (x > 5200 && y > 3000));
        const h = tileHash(x, y);
        if (water) {
          ctx.fillStyle = h > 0.5 ? "#2b5a72" : "#315d73";
        } else if (road) {
          ctx.fillStyle = game.worldRestored ? (h > 0.5 ? "#557a48" : "#486f42") : (h > 0.5 ? "#735f43" : "#66523b");
        } else if (mountain) {
          ctx.fillStyle = h > 0.72 ? "#68706b" : h > 0.38 ? palette.mountain : "#46514f";
        } else {
          ctx.fillStyle = h > 0.72 ? "#5d965b" : h > 0.36 ? "#518a54" : "#477d4c";
        }
        ctx.fillRect(x, y, TILE, TILE);

        if (water) {
          const flow = (game.time * 24 + h * 48) % 34;
          ctx.fillStyle = "rgba(105, 215, 255, 0.12)";
          ctx.fillRect(x + 8 + (flow % 9), y + 11 + flow, TILE - 20, 4);
          ctx.fillRect(x + 5 + ((flow + 14) % 11), y + ((flow + 30) % 52), TILE - 18, 3);
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

  function drawSmallStreamEffects() {
    for (let i = 0; i < SMALL_STREAM_RECTS.length; i += 1) {
      const stream = SMALL_STREAM_RECTS[i];
      if (!stream.bridged) continue;
      const planks = game.planks.filter((plank) => !plank.taken && plank.bridgeStreamIndex === i);
      ctx.save();
      ctx.fillStyle = "rgba(105, 215, 255, 0.2)";
      if (stream.w > stream.h) {
        for (const plank of planks) {
          ctx.fillRect(plank.x - 54, stream.y + 8, 38, 12);
          ctx.fillRect(plank.x + 16, stream.y + stream.h - 20, 38, 12);
          ctx.fillStyle = "rgba(245, 238, 209, 0.2)";
          ctx.fillRect(plank.x - 10, stream.y + 8, 20, stream.h - 16);
          ctx.fillStyle = "rgba(105, 215, 255, 0.2)";
        }
      } else {
        for (const plank of planks) {
          ctx.fillRect(stream.x + 8, plank.y - 54, 12, 38);
          ctx.fillRect(stream.x + stream.w - 20, plank.y + 16, 12, 38);
          ctx.fillStyle = "rgba(245, 238, 209, 0.2)";
          ctx.fillRect(stream.x + 8, plank.y - 10, stream.w - 16, 20);
          ctx.fillStyle = "rgba(105, 215, 255, 0.2)";
        }
      }
      ctx.restore();
    }
  }

  function drawSecretHedges() {
    for (const hedge of game.hedges) drawSecretHedge(hedge);
  }

  function drawSecretHedge(hedge) {
    ctx.save();
    if (hedge.destroyed) {
      drawGridRect(hedge.x, hedge.y, hedge.w, hedge.h, "rgba(66, 111, 69, 0.48)", "rgba(24, 80, 36, 0.3)");
      for (let x = hedge.x + 28; x < hedge.x + hedge.w; x += 46) {
        for (let y = hedge.y + 30; y < hedge.y + hedge.h; y += 46) drawTinyFlower({ x, y, phase: x + y }, true);
      }
      ctx.restore();
      return;
    }
    hedge.pulse += 0.025;
    drawGridRect(hedge.x, hedge.y, hedge.w, hedge.h, "#12351f", "rgba(4, 9, 6, 0.66)");
    ctx.beginPath();
    ctx.rect(hedge.x, hedge.y, hedge.w, hedge.h);
    ctx.clip();
    for (let y = hedge.y; y < hedge.y + hedge.h; y += TILE) {
      for (let x = hedge.x; x < hedge.x + hedge.w; x += TILE) drawBushTile(x, y, false, false);
    }
    ctx.fillStyle = `rgba(136, 255, 118, ${0.16 + Math.sin(game.time * 2 + hedge.pulse) * 0.06})`;
    ctx.fillRect(hedge.x + 8, hedge.y + 8, hedge.w - 16, hedge.h - 16);
    ctx.restore();
  }

  function cabinWalls(cabin) {
    const wall = 16;
    const door = TILE;
    const doorX = cabin.x + cabin.w / 2 - door / 2;
    return [
      { x: cabin.x, y: cabin.y, w: cabin.w, h: wall },
      { x: cabin.x, y: cabin.y, w: wall, h: cabin.h },
      { x: cabin.x + cabin.w - wall, y: cabin.y, w: wall, h: cabin.h },
      { x: cabin.x, y: cabin.y + cabin.h - wall, w: doorX - cabin.x, h: wall },
      { x: doorX + door, y: cabin.y + cabin.h - wall, w: cabin.x + cabin.w - doorX - door, h: wall }
    ];
  }

  function dataCenterWalls() {
    if (!game || game.worldRestored || game.boss.defeated) return [];
    const d = DATA_CENTER;
    const wall = TILE;
    const doorY = d.y + TILE * 11;
    const doorH = TILE * 4;
    return [
      { x: d.x, y: d.y, w: d.w, h: wall },
      { x: d.x, y: d.y + d.h - wall, w: d.w, h: wall },
      { x: d.x + d.w - wall, y: d.y, w: wall, h: d.h },
      { x: d.x, y: d.y, w: wall, h: doorY - d.y },
      { x: d.x, y: doorY + doorH, w: wall, h: d.y + d.h - doorY - doorH }
    ];
  }

  function drawDataCenter() {
    const d = DATA_CENTER;
    if (game.worldRestored) {
      drawGridRect(d.x, d.y, d.w, d.h, "#5a9658", "rgba(24, 80, 36, 0.34)");
      for (let y = d.y + TILE; y < d.y + d.h - TILE; y += TILE) {
        for (let x = d.x + TILE; x < d.x + d.w - TILE; x += TILE) {
          const h = tileHash(x, y);
          ctx.fillStyle = h > 0.45 ? "#367d42" : "#2f723d";
          ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
          if (h > 0.58) drawTinyFlower({ x: x + 32, y: y + 32, phase: h * TAU }, true);
        }
      }
      drawRestoredTree(d.x + d.w * 0.72, d.y + d.h * 0.62);
      return;
    }

    const pulse = Math.sin(game.time * 2.8) * 0.5 + 0.5;
    shadow(d.x + d.w / 2, d.y + d.h, d.w * 0.46, 28);
    ctx.save();
    drawGridRect(d.x, d.y, d.w, d.h, "#252d30", "rgba(105, 215, 255, 0.13)");

    ctx.fillStyle = "#3e4749";
    ctx.fillRect(d.x + TILE, d.y + TILE * 11, d.w - TILE * 2, TILE * 4);
    ctx.fillStyle = "rgba(105, 215, 255, 0.18)";
    ctx.fillRect(d.x + TILE, d.y + TILE * 12 + 26, d.w - TILE * 2, 9);
    ctx.fillStyle = "rgba(228, 84, 154, 0.18)";
    ctx.fillRect(d.x + TILE * 2, d.y + TILE * 14 + 12, d.w - TILE * 4, 7);

    for (let y = d.y + TILE * 2; y < d.y + d.h - TILE * 2; y += TILE * 3) {
      for (let x = d.x + TILE * 2; x < d.x + d.w - TILE * 3; x += TILE * 3) {
        if (Math.hypot(x + 32 - BOSS_X, y + 32 - BOSS_Y) < 260) continue;
        if (rectsOverlap({ x, y, w: TILE, h: TILE * 2 }, roomBounds(game.servers[5]))) continue;
        drawRack(x, y, pulse, true);
      }
    }

    ctx.strokeStyle = `rgba(228, 84, 154, ${0.28 + pulse * 0.22})`;
    ctx.lineWidth = 5;
    ctx.strokeRect(BOSS_X - TILE * 2 + 0.5, BOSS_Y - TILE * 2 + 0.5, TILE * 4 - 1, TILE * 4 - 1);
    ctx.strokeRect(BOSS_X - TILE * 3 + 0.5, BOSS_Y - TILE * 3 + 0.5, TILE * 6 - 1, TILE * 6 - 1);

    for (const wall of dataCenterWalls()) {
      ctx.fillStyle = "#4b5256";
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeStyle = "rgba(245, 238, 209, 0.12)";
      ctx.strokeRect(wall.x + 0.5, wall.y + 0.5, wall.w - 1, wall.h - 1);
    }
    ctx.fillStyle = "rgba(245, 238, 209, 0.2)";
    ctx.fillRect(d.x, d.y + TILE * 11 + 16, TILE, TILE * 4 - 32);
    ctx.restore();
  }

  function drawCabins() {
    for (const cabin of game.cabins) {
      shadow(cabin.x + cabin.w / 2, cabin.y + cabin.h, cabin.w * 0.55, 18);
      drawGridRect(cabin.x, cabin.y, cabin.w, cabin.h, "#6b5035", "rgba(61, 39, 25, 0.55)");
      ctx.fillStyle = "rgba(245, 238, 209, 0.12)";
      for (let y = cabin.y + 24; y < cabin.y + cabin.h - 20; y += 28) ctx.fillRect(cabin.x + 18, y, cabin.w - 36, 5);

      ctx.fillStyle = "#3b2a20";
      for (const wall of cabinWalls(cabin)) ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.fillStyle = "#2b1f18";
      ctx.fillRect(cabin.x + 30, cabin.y + 34, 52, 34);
      ctx.fillStyle = "#8d6240";
      ctx.fillRect(cabin.x + 106, cabin.y + 46, 42, 54);
      ctx.fillStyle = "#d4a15b";
      ctx.fillRect(cabin.x + 116, cabin.y + 56, 22, 10);
      ctx.fillStyle = cabin.used ? "#324b34" : "#d4a15b";
      if (cabin.item === "book") {
        ctx.fillRect(cabin.x + 42, cabin.y + 118, 30, 22);
        ctx.fillStyle = "#f5eed1";
        ctx.fillRect(cabin.x + 46, cabin.y + 122, 10, 14);
        ctx.fillRect(cabin.x + 58, cabin.y + 122, 10, 14);
      } else if (cabin.item === "hat") {
        ctx.fillRect(cabin.x + 42, cabin.y + 122, 36, 8);
        ctx.fillRect(cabin.x + 52, cabin.y + 108, 16, 16);
      } else {
        ctx.fillRect(cabin.x + 44, cabin.y + 114, 18, 28);
        ctx.fillRect(cabin.x + 68, cabin.y + 114, 18, 28);
      }
      if (Math.abs(game.player.x - (cabin.x + cabin.w / 2)) < 110 && Math.abs(game.player.y - (cabin.y + cabin.h / 2)) < 110) {
        drawWorldHint(cabin.x + cabin.w / 2, cabin.y - 12, "SPACJA");
      }
    }
  }

  function drawCaveEntrance(x, y, underground = false) {
    const bx = Math.round(x - TILE);
    const by = Math.round(y - TILE);
    shadow(x, y + 54, 86, 18);
    ctx.save();
    drawGridRect(bx, by, TILE * 2, TILE * 2, underground ? "#251811" : "#4b3a2b", "rgba(17, 10, 6, 0.62)");
    ctx.fillStyle = underground ? "#140d0a" : "#2a1f18";
    ctx.fillRect(bx + 22, by + 36, TILE * 2 - 44, TILE * 2 - 48);
    ctx.fillStyle = underground ? "#5b432f" : "#6b513a";
    ctx.fillRect(bx + 8, by + TILE + 30, TILE * 2 - 16, 18);
    ctx.fillRect(bx + 10, by + 12, 24, 18);
    ctx.fillRect(bx + 88, by + 18, 26, 20);
    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    ctx.fillRect(bx + 36, by + 52, 56, 54);
    ctx.fillStyle = underground ? "rgba(245, 238, 209, 0.08)" : "rgba(126, 203, 119, 0.12)";
    ctx.fillRect(bx + 13, by + 13, TILE * 2 - 26, 8);
    ctx.restore();
  }

  function drawBurrows() {
    for (const burrow of BURROWS) {
      drawCaveEntrance(burrow.x, burrow.y, false);
      if (Math.hypot(game.player.x - burrow.x, game.player.y - burrow.y) < 92) drawWorldHint(burrow.x, burrow.y - 78, "E");
    }
  }

  function drawWorldHint(x, y, text) {
    ctx.save();
    ctx.fillStyle = "rgba(13, 18, 16, 0.78)";
    ctx.fillRect(Math.round(x - 28), Math.round(y - 12), 56, 18);
    ctx.fillStyle = palette.cream;
    ctx.font = "800 11px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, x, y + 1);
    ctx.restore();
  }

  function drawSecurityCameras() {
    for (const server of game.servers) {
      if (server.destroyed || !server.powered) continue;
      for (const camera of serverCameras(server)) drawCamera(camera);
    }
  }

  function drawCamera(camera) {
    ctx.save();
    ctx.fillStyle = "rgba(228, 84, 154, 0.08)";
    ctx.beginPath();
    ctx.moveTo(camera.x, camera.y);
    ctx.arc(camera.x, camera.y, camera.range, camera.a - camera.spread, camera.a + camera.spread);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#273036";
    ctx.fillRect(camera.x - 10, camera.y - 10, 20, 20);
    ctx.fillStyle = palette.aiPink;
    ctx.fillRect(camera.x - 4, camera.y - 4, 8, 8);
    ctx.restore();
  }

  function drawUndergroundWorld() {
    ctx.fillStyle = "#0d0907";
    ctx.fillRect(0, 0, UNDER_W, UNDER_H);
    for (const rect of UNDER_TUNNELS) {
      ctx.fillStyle = "#4b3729";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = "#5e4633";
      for (let x = rect.x; x < rect.x + rect.w; x += TILE) {
        for (let y = rect.y; y < rect.y + rect.h; y += TILE) {
          const h = tileHash(x, y);
          if (h > 0.62) ctx.fillRect(x + 14, y + 18, 18, 12);
          if (h < 0.22) ctx.fillRect(x + 38, y + 42, 12, 8);
        }
      }
      ctx.strokeStyle = "rgba(17, 10, 6, 0.62)";
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
    }
    drawUndergroundBurrows();
    drawCables();
  }

  function drawUndergroundBurrows() {
    for (const burrow of BURROWS) {
      drawCaveEntrance(burrow.ux, burrow.uy, true);
      if (Math.hypot(game.player.x - burrow.ux, game.player.y - burrow.uy) < 92) drawWorldHint(burrow.ux, burrow.uy - 78, "E");
    }
  }

  function drawCables() {
    for (const cable of game.cables) {
      cable.pulse += 0.03;
      ctx.fillStyle = cable.cut ? "#2c2520" : "#421f2c";
      ctx.fillRect(cable.x, cable.y, cable.w, cable.h);
      ctx.fillStyle = cable.cut ? "#7f6a57" : `rgba(105, 215, 255, ${0.25 + Math.sin(game.time * 4 + cable.pulse) * 0.12})`;
      if (cable.w > cable.h) {
        ctx.fillRect(cable.x, cable.y + cable.h / 2 - 3, cable.w, 6);
      } else {
        ctx.fillRect(cable.x + cable.w / 2 - 3, cable.y, 6, cable.h);
      }
      if (!cable.cut) drawWorldHint(cable.x + cable.w / 2, cable.y - 12, "GRYZ");
    }
  }

  function drawMoles() {
    for (const mole of game.moles) drawMole(mole);
  }

  function drawMole(mole) {
    const x = Math.round(mole.x);
    const y = Math.round(mole.y + Math.sin(mole.phase) * 1.5);
    shadow(x, y + 16, 34, 8);
    ctx.fillStyle = "#5a504a";
    ctx.fillRect(x - 20, y - 8, 40, 24);
    ctx.fillStyle = "#74665d";
    ctx.fillRect(x + 8, y - 18, 22, 20);
    ctx.fillStyle = "#f0b0b7";
    ctx.fillRect(x + 24, y - 8, 8, 6);
    ctx.fillStyle = "#161211";
    ctx.fillRect(x + 17, y - 13, 3, 3);
    if (Math.hypot(game.player.x - mole.x, game.player.y - mole.y) < 72) drawWorldHint(x, y - 36, "SPACJA");
  }

  function drawCaterpillars() {
    for (const c of game.caterpillars) {
      if (c.eaten) continue;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.dir);
      for (let i = 0; i < 5; i += 1) {
        ctx.fillStyle = i % 2 ? "#8fbf57" : "#b7d86a";
        ctx.beginPath();
        ctx.arc(-i * 8, Math.sin(c.phase + i) * 2, 6, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawUndergroundFog(size) {
    const px = game.player.x - camera.x;
    const py = game.player.y - camera.y;
    const g = ctx.createRadialGradient(px, py, 90, px, py, 285);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.55, "rgba(0,0,0,0.28)");
    g.addColorStop(1, "rgba(0,0,0,0.92)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size.w, size.h);
  }

  function drawForestWalls() {
    for (const wall of FOREST_WALL_RECTS) {
      const startX = Math.floor(wall.x / TILE) * TILE;
      const startY = Math.floor(wall.y / TILE) * TILE;
      const endX = wall.x + wall.w;
      const endY = wall.y + wall.h;
      ctx.save();
      ctx.fillStyle = "rgba(14, 34, 21, 0.94)";
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeStyle = "rgba(4, 9, 6, 0.7)";
      ctx.lineWidth = 2;
      ctx.strokeRect(wall.x + 0.5, wall.y + 0.5, wall.w - 1, wall.h - 1);
      ctx.beginPath();
      ctx.rect(wall.x, wall.y, wall.w, wall.h);
      ctx.clip();
      for (let y = startY; y < endY; y += TILE) {
        for (let x = startX; x < endX; x += TILE) {
          if (!rectsOverlap({ x, y, w: TILE, h: TILE }, wall)) continue;
          const mountain = x > 6200 || y > 4200;
          const clean = isRestoredAt(x + TILE / 2, y + TILE / 2) || game.state === "won";
          drawBushTile(x, y, mountain, clean);
        }
      }
      ctx.restore();
    }
  }

  function drawBushTile(x, y, mountain, clean) {
    const h = tileHash(x, y);
    const dark = clean ? "#1f7136" : "#15381f";
    const mid = clean ? "#38a346" : "#1f5f2d";
    const light = clean ? "#6de36a" : "#2a7a39";
    ctx.save();
    ctx.fillStyle = clean ? "#1c5f2d" : "#102719";
    ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(x + 20, y + 36, 20, 0, TAU);
    ctx.arc(x + 36, y + 25, 22, 0, TAU);
    ctx.arc(x + 47, y + 39, 18, 0, TAU);
    ctx.arc(x + 30, y + 46, 19, 0, TAU);
    ctx.fill();
    ctx.fillStyle = mid;
    ctx.beginPath();
    ctx.arc(x + 22, y + 34, 15, 0, TAU);
    ctx.arc(x + 38, y + 27, 16, 0, TAU);
    ctx.arc(x + 45, y + 41, 13, 0, TAU);
    ctx.fill();
    ctx.fillStyle = light;
    ctx.globalAlpha = 0.26 + h * 0.16;
    ctx.beginPath();
    ctx.arc(x + 24, y + 25, 8, 0, TAU);
    ctx.arc(x + 44, y + 32, 7, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (mountain) {
      ctx.fillStyle = "rgba(207, 216, 207, 0.28)";
      ctx.fillRect(x + 13, y + 10, 38, 7);
      ctx.fillRect(x + 22, y + 4, 20, 7);
    }
    ctx.strokeStyle = "rgba(4, 9, 6, 0.64)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    ctx.restore();
  }

  function drawDecor() {
    const sorted = decor.slice().sort((a, b) => a.y - b.y);
    for (const item of sorted) {
      const clean = isRestoredAt(item.x, item.y) || game.state === "won";
      if (item.type === "bush") drawBush(item, clean);
      if (item.type === "rock") drawRock(item, clean);
      if (item.type === "flower") drawTinyFlower(item, clean);
    }
  }

  function drawBush(item, clean) {
    const x = Math.round(item.x);
    const y = Math.round(item.y);
    const r = Math.round(item.r);
    if (item.chewed) {
      shadow(x, y + 10, r * 1.1, r * 0.22);
      ctx.fillStyle = "#2d7f39";
      ctx.fillRect(x - 18, y - 2, 36, 11);
      ctx.fillStyle = "#7ff06c";
      ctx.fillRect(x - 12, y - 10, 10, 8);
      ctx.fillRect(x + 4, y - 13, 12, 9);
      return;
    }
    const intense = item.chewable;
    const dark = intense ? "#16852d" : clean ? "#26743a" : "#1d4a2b";
    const mid = intense ? "#34c447" : clean ? "#3b9c4d" : "#2b6a38";
    const light = intense ? "#88ff76" : clean ? "#74d669" : "#3e8a48";
    shadow(x, y + r * 0.52, r * 1.25, r * 0.32);
    ctx.save();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(x - r * 0.42, y + r * 0.05, r * 0.58, 0, TAU);
    ctx.arc(x, y - r * 0.24, r * 0.68, 0, TAU);
    ctx.arc(x + r * 0.48, y + r * 0.02, r * 0.54, 0, TAU);
    ctx.arc(x + r * 0.05, y + r * 0.32, r * 0.58, 0, TAU);
    ctx.fill();
    ctx.fillStyle = mid;
    ctx.beginPath();
    ctx.arc(x - r * 0.28, y - r * 0.03, r * 0.36, 0, TAU);
    ctx.arc(x + r * 0.16, y - r * 0.28, r * 0.42, 0, TAU);
    ctx.arc(x + r * 0.42, y + r * 0.14, r * 0.34, 0, TAU);
    ctx.fill();
    ctx.fillStyle = light;
    ctx.globalAlpha = intense ? 0.42 : 0.2;
    ctx.beginPath();
    ctx.arc(x - r * 0.18, y - r * 0.28, r * 0.18, 0, TAU);
    ctx.arc(x + r * 0.34, y - r * 0.12, r * 0.16, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
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

  function drawVictoryFlowers() {
    if (!game.worldRestored) return;
    for (const flower of game.victoryFlowers) {
      const y = flower.y + Math.sin(game.time * 2 + flower.bob) * 2;
      drawFlowerPickup(flower.x, y, flower.species, 0.72);
    }
  }

  function drawWildlife() {
    if (!game.worldRestored) return;
    const animals = game.wildlife.slice().sort((a, b) => a.y - b.y);
    for (const animal of animals) drawWildAnimal(animal);
  }

  function drawWildAnimal(animal) {
    const x = Math.round(animal.x);
    const y = Math.round(animal.y + Math.sin(animal.phase) * 1.5);
    const r = animal.r;
    shadow(x, y + r * 0.8, r * 1.2, r * 0.3);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(Math.cos(animal.dir) < 0 ? -1 : 1, 1);
    if (animal.type === "deer") {
      ctx.fillStyle = "#9a6a3d";
      ctx.fillRect(-r, -r * 0.35, r * 1.8, r * 0.86);
      ctx.fillRect(r * 0.44, -r * 0.8, r * 0.74, r * 0.62);
      ctx.fillStyle = "#5b3b24";
      ctx.fillRect(r * 0.8, -r * 1.08, 5, 20);
      ctx.fillRect(r * 1.02, -r * 1.08, 5, 20);
      ctx.fillRect(-r * 0.7, r * 0.42, 6, 18);
      ctx.fillRect(r * 0.1, r * 0.42, 6, 18);
    } else if (animal.type === "hare") {
      ctx.fillStyle = "#b9a07d";
      ctx.fillRect(-r, -r * 0.35, r * 1.55, r * 0.9);
      ctx.fillRect(r * 0.3, -r * 0.72, r * 0.82, r * 0.74);
      ctx.fillRect(r * 0.52, -r * 1.6, 5, 18);
      ctx.fillRect(r * 0.82, -r * 1.58, 5, 18);
    } else if (animal.type === "fox") {
      ctx.fillStyle = "#c76c33";
      ctx.fillRect(-r, -r * 0.35, r * 1.65, r * 0.85);
      ctx.fillRect(r * 0.34, -r * 0.72, r * 0.8, r * 0.72);
      ctx.fillStyle = "#e8d6b8";
      ctx.fillRect(-r * 1.42, -r * 0.25, r * 0.64, 8);
    } else {
      ctx.fillStyle = "#5e5147";
      ctx.fillRect(-r, -r * 0.42, r * 1.8, r * 0.95);
      ctx.fillRect(r * 0.42, -r * 0.72, r * 0.72, r * 0.72);
      ctx.fillStyle = "#28201b";
      ctx.fillRect(r * 0.96, -r * 0.35, 9, 6);
    }
    ctx.fillStyle = "#1d1714";
    ctx.fillRect(r * 0.78, -r * 0.45, 4, 4);
    ctx.restore();
  }

  function drawPlanks() {
    for (const plank of game.planks) {
      if (plank.taken) continue;
      if (plank.bridgeStreamIndex !== null && plank.bridgeStreamIndex !== undefined) drawBridgePlank(plank);
      else drawPlank(plank.x, plank.y + Math.sin(plank.bob) * 3, plank.angle, 1);
    }
  }

  function drawBridgePlank(plank) {
    const stream = SMALL_STREAM_RECTS[plank.bridgeStreamIndex];
    if (!stream) return drawPlank(plank.x, plank.y, plank.angle, 1);
    const horizontal = stream.w > stream.h;
    ctx.save();
    ctx.translate(Math.round(plank.x), Math.round(plank.y));
    shadow(0, 13, 34, 7);
    ctx.fillStyle = palette.plank;
    if (horizontal) {
      ctx.fillRect(-9, -stream.h / 2 - 18, 18, stream.h + 36);
      ctx.fillStyle = "rgba(92, 57, 36, 0.48)";
      ctx.fillRect(-5, -stream.h / 2 - 10, 4, stream.h + 20);
      ctx.fillRect(3, -stream.h / 2 - 4, 4, stream.h + 8);
    } else {
      ctx.fillRect(-stream.w / 2 - 18, -9, stream.w + 36, 18);
      ctx.fillStyle = "rgba(92, 57, 36, 0.48)";
      ctx.fillRect(-stream.w / 2 - 10, -5, stream.w + 20, 4);
      ctx.fillRect(-stream.w / 2 - 4, 3, stream.w + 8, 4);
    }
    ctx.restore();
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

  function flowerInfo(id) {
    return FLOWER_LIBRARY.find((flower) => flower.id === id) || FLOWER_LIBRARY[0];
  }

  function drawPickups() {
    for (const pickup of game.pickups) {
      if (pickup.taken) continue;
      const y = pickup.y + Math.sin(pickup.bob) * 5;
      shadow(pickup.x, pickup.y + 15, pickup.type === "nut" ? 18 : 24, 7);
      if (pickup.type === "flower") drawFlowerPickup(pickup.x, y, pickup.species, 1.05);
      else if (pickup.type === "nut") drawNut(pickup.x, y, 1, pickup.bob * 0.2);
      else if (pickup.type === "elixir") drawElixir(pickup.x, y, 1);
      else drawSpinach(pickup.x, y, 1);
    }
  }

  function drawFlowerPickup(x, y, species, scale) {
    const flower = flowerInfo(species);
    if (species === "daisy") return drawDaisy(x, y, scale);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    ctx.fillStyle = palette.leafLight;
    ctx.fillRect(-2, 9, 4, 21);
    if (species === "bluebell") {
      ctx.fillRect(-2, -2, 14, 4);
      ctx.fillStyle = flower.petals;
      ctx.fillRect(7, 0, 10, 14);
      ctx.fillRect(-2, 4, 10, 14);
      ctx.fillRect(12, 15, 6, 5);
      ctx.fillRect(3, 19, 6, 5);
    } else if (species === "thistle") {
      ctx.fillStyle = "#4f9a49";
      ctx.fillRect(-10, 6, 20, 8);
      ctx.fillStyle = flower.petals;
      for (let i = -3; i <= 3; i += 1) ctx.fillRect(i * 3, -15 + Math.abs(i) * 2, 4, 18);
    } else if (species === "clover") {
      ctx.fillStyle = "#4dbb56";
      ctx.beginPath();
      ctx.arc(-7, -5, 7, 0, TAU);
      ctx.arc(7, -5, 7, 0, TAU);
      ctx.arc(0, 5, 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = flower.petals;
      ctx.fillRect(-4, -22, 8, 8);
    } else if (species === "dandelion") {
      ctx.fillStyle = flower.petals;
      for (let i = 0; i < 12; i += 1) {
        const a = i * TAU / 12;
        ctx.fillRect(Math.cos(a) * 10 - 2, Math.sin(a) * 10 - 2, 5, 12);
      }
    } else {
      ctx.fillStyle = flower.petals;
      ctx.beginPath();
      const petals = species === "cornflower" ? 8 : 5;
      for (let i = 0; i < petals; i += 1) {
        const a = i * TAU / petals;
        ctx.rect(Math.cos(a) * 10 - 5, Math.sin(a) * 10 - 5, 10, 10);
      }
      ctx.fill();
    }
    ctx.fillStyle = flower.center;
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
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

  function drawElixir(x, y, scale) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(126, 203, 119, 0.28)";
    ctx.fillRect(-18, 12, 36, 7);
    ctx.fillStyle = palette.aiViolet;
    ctx.fillRect(-10, -14, 20, 30);
    ctx.fillStyle = palette.leafLight;
    ctx.fillRect(-6, -7, 12, 18);
    ctx.fillStyle = palette.cream;
    ctx.fillRect(-7, -23, 14, 8);
    ctx.fillStyle = "rgba(245, 238, 209, 0.52)";
    ctx.fillRect(2, -5, 4, 13);
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


  function drawNut(x, y, scale = 1, angle = 0) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#9b6a35";
    ctx.beginPath();
    ctx.ellipse(0, 1, 9, 12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#d4a15b";
    ctx.fillRect(-5, -9, 10, 5);
    ctx.fillStyle = "rgba(92, 57, 36, 0.45)";
    ctx.fillRect(-4, 0, 8, 3);
    ctx.restore();
  }

  function drawBlockers() {
    for (const blocker of game.blockers) {
      if (game.worldRestored) {
        drawBlockerMeadow(blocker);
      } else if (blocker.destroyed) {
        drawBlockerRuin(blocker);
      } else {
        drawBlocker(blocker);
      }
    }
  }

  function drawBlockerMeadow(blocker) {
    ctx.save();
    ctx.fillStyle = "rgba(80, 132, 75, 0.6)";
    ctx.fillRect(blocker.x, blocker.y, blocker.w, blocker.h);
    for (let x = blocker.x + 20; x < blocker.x + blocker.w; x += 34) {
      for (let y = blocker.y + 24; y < blocker.y + blocker.h; y += 42) {
        drawTinyFlower({ x, y, phase: x + y }, true);
      }
    }
    ctx.restore();
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

  function drawGridRect(x, y, w, h, fill, stroke = "rgba(4, 9, 6, 0.52)") {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    if (!stroke) return;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    for (let gx = x; gx <= x + w; gx += TILE) {
      ctx.beginPath();
      ctx.moveTo(gx + 0.5, y);
      ctx.lineTo(gx + 0.5, y + h);
      ctx.stroke();
    }
    for (let gy = y; gy <= y + h; gy += TILE) {
      ctx.beginPath();
      ctx.moveTo(x, gy + 0.5);
      ctx.lineTo(x + w, gy + 0.5);
      ctx.stroke();
    }
  }

  function drawTechTile(x, y, pulse, color = palette.aiBlue) {
    ctx.fillStyle = "#20292c";
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = "#0f1518";
    ctx.fillRect(x + 10, y + 10, TILE - 20, 10);
    ctx.fillRect(x + 10, y + 34, TILE - 20, 8);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.32 + pulse * 0.4;
    ctx.fillRect(x + 14, y + 48, TILE - 28, 5);
    ctx.globalAlpha = 1;
  }

  function drawSmokeStack(x, y, phaseOffset) {
    ctx.fillStyle = "#252f31";
    ctx.fillRect(x, y, TILE, TILE * 2);
    ctx.fillStyle = "#3c4648";
    ctx.fillRect(x, y, TILE, 16);
    ctx.fillStyle = "#11171c";
    ctx.fillRect(x + 18, y + 22, 28, 70);
    for (let i = 0; i < 5; i += 1) {
      const drift = (game.time * 0.28 + i * 0.2 + phaseOffset) % 1;
      const puffX = x + TILE / 2 + Math.sin(game.time * 1.1 + i) * 12;
      const puffY = y - 8 - drift * 86;
      const size = 16 + i * 3 + drift * 14;
      ctx.fillStyle = `rgba(88, 91, 84, ${(1 - drift) * 0.24})`;
      ctx.fillRect(Math.round(puffX - size / 2), Math.round(puffY - size / 2), Math.round(size), Math.round(size));
    }
  }

  function drawServerInfrastructure(server, b, pulse) {
    const pathY = b.y + Math.floor(server.tilesH / 2) * TILE;
    const pathX = b.x + Math.floor(server.tilesW / 2) * TILE;
    ctx.save();

    drawGridRect(b.x - TILE * 4, pathY, TILE * 4, TILE, "#555d59");
    drawGridRect(b.x + b.w, pathY, TILE * 4, TILE, "#555d59");
    drawGridRect(pathX, b.y - TILE * 3, TILE, TILE * 3, "#555d59");
    drawGridRect(pathX, b.y + b.h, TILE, TILE * 3, "#555d59");

    ctx.fillStyle = "#6b746f";
    ctx.fillRect(b.x - TILE * 4, pathY + 10, TILE * 4, 9);
    ctx.fillRect(b.x + b.w, pathY + TILE - 19, TILE * 4, 9);
    ctx.fillRect(pathX + 10, b.y - TILE * 3, 9, TILE * 3);
    ctx.fillRect(pathX + TILE - 19, b.y + b.h, 9, TILE * 3);

    drawGridRect(b.x - TILE, b.y - TILE, b.w + TILE * 2, TILE, "#30393a");
    drawGridRect(b.x - TILE, b.y + b.h, b.w + TILE * 2, TILE, "#30393a");
    drawGridRect(b.x - TILE, b.y, TILE, b.h, "#30393a");
    drawGridRect(b.x + b.w, b.y, TILE, b.h, "#30393a");

    const glow = 0.2 + pulse * 0.36;
    ctx.fillStyle = `rgba(105, 215, 255, ${glow})`;
    ctx.fillRect(b.x - TILE * 4, pathY + 27, TILE * 4, 8);
    ctx.fillRect(b.x + b.w, pathY + 27, TILE * 4, 8);
    ctx.fillRect(pathX + 27, b.y - TILE * 3, 8, TILE * 3);
    ctx.fillRect(pathX + 27, b.y + b.h, 8, TILE * 3);
    ctx.fillStyle = `rgba(228, 84, 154, ${0.12 + pulse * 0.24})`;
    ctx.fillRect(b.x - TILE * 3, pathY + 41, b.w + TILE * 6, 6);

    const modules = [
      [b.x - TILE * 3, pathY - TILE],
      [b.x + b.w + TILE * 2, pathY - TILE],
      [pathX - TILE, b.y - TILE * 2],
      [pathX + TILE, b.y + b.h + TILE]
    ];
    for (let i = 0; i < modules.length; i += 1) {
      drawTechTile(modules[i][0], modules[i][1], pulse, i % 2 ? palette.aiPink : palette.aiBlue);
    }

    ctx.fillStyle = "#737a73";
    for (let i = 0; i < 5; i += 1) {
      ctx.fillRect(pathX - TILE + i * 16, b.y + b.h + TILE + i * 10, TILE * 2 - i * 32, 7);
    }

    drawSmokeStack(b.x - TILE * 2, b.y - TILE * 3, pulse);
    drawSmokeStack(b.x + b.w + TILE, b.y - TILE * 3, pulse + 0.3);
    ctx.restore();
  }

  function drawRecoveredInfrastructure(server, b) {
    const pathY = b.y + Math.floor(server.tilesH / 2) * TILE;
    const pathX = b.x + Math.floor(server.tilesW / 2) * TILE;
    ctx.save();
    drawGridRect(b.x - TILE * 4, pathY, TILE * 4, TILE, "rgba(80, 132, 75, 0.78)", "rgba(24, 80, 36, 0.44)");
    drawGridRect(b.x + b.w, pathY, TILE * 4, TILE, "rgba(80, 132, 75, 0.78)", "rgba(24, 80, 36, 0.44)");
    drawGridRect(pathX, b.y - TILE * 3, TILE, TILE * 3, "rgba(80, 132, 75, 0.78)", "rgba(24, 80, 36, 0.44)");
    drawGridRect(pathX, b.y + b.h, TILE, TILE * 3, "rgba(80, 132, 75, 0.78)", "rgba(24, 80, 36, 0.44)");
    ctx.fillStyle = "rgba(126, 203, 119, 0.42)";
    ctx.fillRect(b.x - TILE * 4, pathY + 28, b.w + TILE * 8, 8);
    ctx.fillRect(pathX + 28, b.y - TILE * 3, 8, b.h + TILE * 6);
    for (let x = b.x - TILE * 3; x <= b.x + b.w + TILE * 3; x += TILE) {
      drawTinyFlower({ x: x + 32, y: pathY + 32, phase: x }, true);
    }
    for (let y = b.y - TILE * 2; y <= b.y + b.h + TILE * 2; y += TILE) {
      drawTinyFlower({ x: pathX + 32, y: y + 32, phase: y }, true);
    }
    ctx.restore();
  }

  function drawRack(x, y, pulse, tall = true) {
    const h = tall ? TILE * 2 : TILE;
    ctx.fillStyle = "#10171c";
    ctx.fillRect(x, y, TILE, h);
    ctx.fillStyle = "#222b30";
    ctx.fillRect(x + 8, y + 8, TILE - 16, h - 16);
    ctx.fillStyle = palette.aiBlue;
    ctx.globalAlpha = 0.36 + pulse * 0.34;
    for (let yy = y + 18; yy < y + h - 10; yy += 22) {
      ctx.fillRect(x + 14, yy, 12, 6);
      ctx.fillRect(x + 36, yy, 14, 6);
    }
    ctx.globalAlpha = 1;
  }

  function drawServer(server) {
    const b = roomBounds(server);
    const pulse = Math.sin(game.time * 3 + server.pulse) * 0.5 + 0.5;
    shadow(server.x, server.y + server.h * 0.46, server.w * 0.54, 20);

    ctx.save();
    drawServerInfrastructure(server, b, pulse);

    drawGridRect(b.x, b.y, b.w, b.h, "#172024", "rgba(105, 215, 255, 0.12)");
    for (let y = b.y + server.wall; y < b.y + b.h - server.wall; y += TILE) {
      for (let x = b.x + server.wall; x < b.x + b.w - server.wall; x += TILE) {
        const h = tileHash(x, y);
        ctx.fillStyle = h > 0.52 ? "#263238" : "#202b30";
        ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
        ctx.fillStyle = "rgba(105, 215, 255, 0.08)";
        if (h > 0.66) ctx.fillRect(x + 12, y + 28, TILE - 24, 6);
      }
    }

    ctx.fillStyle = "#4b5256";
    for (const wall of roomWalls(server)) ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.strokeStyle = "rgba(245, 238, 209, 0.12)";
    ctx.lineWidth = 1;
    for (const wall of roomWalls(server)) ctx.strokeRect(wall.x + 0.5, wall.y + 0.5, wall.w - 1, wall.h - 1);

    const doorX = server.x - server.door / 2;
    ctx.fillStyle = "#6d5941";
    ctx.fillRect(doorX, b.y + b.h - server.wall, server.door, server.wall);
    ctx.fillStyle = "rgba(245, 238, 209, 0.14)";
    ctx.fillRect(doorX, b.y + b.h - server.wall + 8, server.door, 8);

    const coreX = b.x + (server.tilesW / 2 - 1) * TILE;
    const coreY = b.y + (server.tilesH / 2 - 1) * TILE;
    const rackColumns = [];
    for (let x = b.x + TILE * 2; x < b.x + b.w - TILE * 2; x += TILE * 2) rackColumns.push(x);
    for (const rackX of rackColumns) {
      for (let y = b.y + TILE; y < b.y + b.h - TILE * 2; y += TILE * 2) {
        if (rectsOverlap({ x: rackX, y, w: TILE, h: TILE * 2 }, { x: coreX - TILE, y: coreY - TILE, w: TILE * 4, h: TILE * 4 })) continue;
        drawRack(rackX, y, pulse, true);
      }
    }

    ctx.fillStyle = server.hp / server.maxHp > 0.35 ? "#2c3137" : "#46343b";
    ctx.fillRect(coreX, coreY, TILE * 2, TILE * 2);
    ctx.fillStyle = "#0b1014";
    ctx.fillRect(coreX + 14, coreY + 18, TILE * 2 - 28, 18);
    ctx.fillRect(coreX + 14, coreY + 55, TILE * 2 - 28, 18);
    ctx.fillRect(coreX + 14, coreY + 91, TILE * 2 - 28, 16);

    ctx.fillStyle = palette.aiBlue;
    ctx.globalAlpha = 0.45 + pulse * 0.35;
    for (let i = 0; i < 8; i += 1) {
      ctx.fillRect(coreX + 18 + i * 11, coreY + 24, 5, 8);
      ctx.fillRect(coreX + 18 + i * 11, coreY + 61, 5, 8);
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = server.powered ? `rgba(228, 84, 154, ${0.42 + pulse * 0.35})` : "rgba(126, 203, 119, 0.6)";
    ctx.lineWidth = 4;
    ctx.strokeRect(coreX + 0.5, coreY + 0.5, TILE * 2 - 1, TILE * 2 - 1);
    if (!server.powered) {
      ctx.fillStyle = "rgba(126, 203, 119, 0.82)";
      ctx.font = "900 12px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("OFF", coreX + TILE, coreY + TILE + 4);
      ctx.textAlign = "left";
    }

    ctx.fillStyle = "rgba(241, 91, 91, 0.82)";
    const hp = server.hp / server.maxHp;
    ctx.fillRect(coreX, coreY + TILE * 2 + 12, TILE * 2, 8);
    ctx.fillStyle = palette.leafLight;
    ctx.fillRect(coreX, coreY + TILE * 2 + 12, TILE * 2 * hp, 8);
    ctx.restore();
  }

  function drawServerRuin(server) {
    const b = roomBounds(server);
    const coreX = b.x + (server.tilesW / 2 - 1) * TILE;
    const coreY = b.y + (server.tilesH / 2 - 1) * TILE;
    shadow(server.x, server.y + server.h * 0.46, server.w * 0.5, 16);
    if (game.worldRestored) {
      drawNaturalServerMeadow(server, b);
      return;
    }
    ctx.save();
    drawRecoveredInfrastructure(server, b);
    drawGridRect(b.x, b.y, b.w, b.h, "#5b9658", "rgba(24, 80, 36, 0.38)");

    for (let y = b.y + TILE; y < b.y + b.h - TILE; y += TILE) {
      for (let x = b.x + TILE; x < b.x + b.w - TILE; x += TILE) {
        const h = tileHash(x, y);
        ctx.fillStyle = h > 0.25 ? "#2d6e39" : "#367d42";
        ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
        if (h > 0.58) drawTinyFlower({ x: x + 32, y: y + 30, phase: h * TAU }, true);
      }
    }

    ctx.fillStyle = "#426f45";
    for (const wall of roomWalls(server)) ctx.fillRect(wall.x, wall.y, wall.w, wall.h);

    ctx.fillStyle = palette.bark;
    ctx.fillRect(coreX + 52, coreY + 42, 24, 86);
    ctx.fillStyle = "#235c35";
    ctx.fillRect(coreX + 22, coreY - 8, 84, 58);
    ctx.fillRect(coreX + 36, coreY - 42, 56, 42);
    ctx.fillStyle = palette.leafLight;
    for (let i = 0; i < 10; i += 1) {
      const x = b.x + TILE + i * TILE;
      if (x > b.x + b.w - TILE * 2) break;
      drawTinyFlower({ x: x + 32, y: b.y + b.h - 32 - Math.sin(game.time * 1.7 + i) * 3, phase: i }, true);
    }
    ctx.restore();
  }

  function drawNaturalServerMeadow(server, b) {
    ctx.save();
    drawGridRect(b.x, b.y, b.w, b.h, "#5b9658", "rgba(24, 80, 36, 0.32)");
    for (let y = b.y; y < b.y + b.h; y += TILE) {
      for (let x = b.x; x < b.x + b.w; x += TILE) {
        const h = tileHash(x, y);
        ctx.fillStyle = h > 0.45 ? "#3f8f46" : "#357a3f";
        ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
        if (h > 0.54) drawTinyFlower({ x: x + 32, y: y + 32, phase: h * TAU }, true);
      }
    }
    if (server.tilesW >= 10) drawRestoredTree(server.x, server.y);
    ctx.restore();
  }

  function drawNpcs() {
    for (const npc of game.npcs) drawBeaverNpc(npc);
  }

  function drawBeaverNpc(npc) {
    const x = Math.round(npc.x);
    const y = Math.round(npc.y + Math.sin(npc.phase) * 1.5);
    const r = npc.r;
    shadow(x, y + r * 0.85, r * 1.25, r * 0.34);
    ctx.save();
    ctx.translate(x, y);
    const faceLeft = game.player.x < npc.x;
    ctx.scale(faceLeft ? -1 : 1, 1);
    ctx.fillStyle = palette.beaverDark;
    ctx.fillRect(-r - 18, -6, 24, 14);
    ctx.fillStyle = palette.beaver;
    ctx.fillRect(-r * 0.82, -r * 0.45, r * 1.45, r * 1.15);
    ctx.fillStyle = "#a36f43";
    ctx.fillRect(r * 0.28, -r * 0.82, r * 0.82, r * 0.86);
    ctx.fillStyle = "#1d1714";
    ctx.fillRect(r * 0.74, -r * 0.55, 4, 4);
    ctx.fillStyle = palette.cream;
    ctx.fillRect(r * 0.88, -r * 0.26, 8, 7);
    ctx.fillStyle = palette.beaverDark;
    ctx.fillRect(-r * 0.62, r * 0.52, 9, 12);
    ctx.fillRect(r * 0.05, r * 0.52, 9, 12);
    ctx.restore();

    if (Math.hypot(game.player.x - npc.x, game.player.y - npc.y) < 82) {
      ctx.fillStyle = "rgba(13, 18, 16, 0.78)";
      ctx.fillRect(x - 24, y - r - 30, 48, 18);
      ctx.fillStyle = palette.cream;
      ctx.font = "800 11px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SPACJA", x, y - r - 17);
    }
  }

  function drawFollowers() {
    for (const follower of followers) drawAnimal(follower, true);
  }

  function drawDolphins() {
    for (const dolphin of dolphins) drawDolphin(dolphin);
  }

  function drawDolphin(dolphin) {
    const progress = 1 - dolphin.life / dolphin.maxLife;
    const jump = Math.sin(progress * Math.PI);
    if (jump <= 0.04) return;
    const travel = (progress - 0.5) * dolphin.travel;
    const baseX = dolphin.x + Math.cos(dolphin.dir) * travel;
    const baseY = dolphin.y + Math.sin(dolphin.dir) * travel;
    const x = Math.round(baseX);
    const y = Math.round(baseY - jump * 58);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(progress * Math.PI * 2) * 0.18);
    ctx.scale(Math.cos(dolphin.dir) < 0 || Math.sin(dolphin.dir) < -0.5 ? -1 : 1, 1);
    ctx.fillStyle = "rgba(105, 215, 255, 0.34)";
    ctx.fillRect(Math.round(-34 - travel * 0.02), Math.round(jump * 50), 68, 6);
    ctx.fillRect(-18, Math.round(jump * 50 + 10), 36, 4);
    ctx.fillStyle = "#6aaec4";
    ctx.beginPath();
    ctx.ellipse(0, 0, 36, 14, -0.08, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#bfe8ef";
    ctx.beginPath();
    ctx.ellipse(8, 7, 23, 6, -0.05, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#5f9eb4";
    ctx.beginPath();
    ctx.moveTo(-12, -10);
    ctx.lineTo(3, -28);
    ctx.lineTo(9, -8);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-33, 0);
    ctx.lineTo(-52, -11);
    ctx.lineTo(-47, 8);
    ctx.fill();
    ctx.fillStyle = "#1b2b30";
    ctx.fillRect(21, -6, 4, 4);
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
      if (enemy.type === "cat" || enemy.type === "dog" || enemy.type === "squirrel") drawAnimal(enemy, false);
      else if (enemy.type === "drone") drawDrone(enemy);
      else drawRobot(enemy);
    }
  }

  function drawAnimal(enemy, friendly) {
    const y = Math.round(enemy.y + Math.sin(enemy.phase) * (friendly ? 1 : 2));
    const x = Math.round(enemy.x);
    const r = Math.round(enemy.r);
    shadow(x, y + r * 0.9, r * 1.18, r * 0.34);
    ctx.save();
    ctx.translate(x, y);
    const faceLeft = !friendly && enemy.aggro ? game.player.x < enemy.x : Math.sin(enemy.phase) < 0;
    ctx.scale(faceLeft ? -1 : 1, 1);

    if (enemy.type === "squirrel") {
      const body = friendly ? "#c77b3f" : enemy.hitFlash > 0 ? palette.cream : enemy.color;
      const tail = friendly ? "#e09a56" : "#6b7070";
      ctx.fillStyle = tail;
      ctx.beginPath();
      ctx.arc(-r * 0.95, -r * 0.45, r * 0.75, 0, TAU);
      ctx.arc(-r * 1.12, -r * 1.02, r * 0.48, 0, TAU);
      ctx.fill();
      ctx.fillStyle = body;
      ctx.fillRect(-r * 0.62, -r * 0.36, r * 1.1, r * 0.95);
      ctx.fillRect(r * 0.22, -r * 0.72, r * 0.72, r * 0.72);
      ctx.fillStyle = friendly ? "#1d1714" : palette.aiBlue;
      ctx.fillRect(r * 0.62, -r * 0.48, 4, 4);
      ctx.fillStyle = "#4d3726";
      ctx.fillRect(-r * 0.44, r * 0.44, 5, 8);
      ctx.fillRect(r * 0.12, r * 0.44, 5, 8);
      ctx.restore();
      return;
    }

    const body = friendly ? "#f4c27a" : enemy.hitFlash > 0 ? palette.cream : enemy.color;
    const dark = friendly ? "#c98445" : "#566164";
    ctx.fillStyle = body;
    ctx.fillRect(-r, -Math.round(r * 0.48), Math.round(r * 1.75), Math.round(r * 1.02));
    ctx.fillRect(Math.round(r * 0.42), -Math.round(r * 0.86), Math.round(r * 0.82), Math.round(r * 0.88));
    ctx.fillStyle = dark;
    ctx.fillRect(-Math.round(r * 0.72), Math.round(r * 0.45), 7, 10);
    ctx.fillRect(Math.round(r * 0.24), Math.round(r * 0.45), 7, 10);

    ctx.fillStyle = body;
    if (enemy.type === "cat") {
      ctx.fillRect(Math.round(r * 0.48), -Math.round(r * 1.2), 9, 10);
      ctx.fillRect(Math.round(r * 0.94), -Math.round(r * 1.12), 9, 10);
      ctx.fillStyle = dark;
      ctx.fillRect(-Math.round(r * 1.34), -Math.round(r * 0.42), Math.round(r * 0.56), 7);
    } else {
      ctx.fillStyle = dark;
      ctx.fillRect(Math.round(r * 0.98), -Math.round(r * 0.6), 9, 15);
      ctx.fillRect(-Math.round(r * 1.42), -Math.round(r * 0.22), Math.round(r * 0.58), 8);
    }

    ctx.fillStyle = friendly ? "#203b2c" : palette.aiBlue;
    ctx.fillRect(Math.round(r * 0.86), -Math.round(r * 0.5), 4, 4);
    if (!friendly) {
      ctx.fillStyle = "rgba(105, 215, 255, 0.45)";
      ctx.fillRect(-Math.round(r * 0.25), -Math.round(r * 0.24), Math.round(r * 0.76), 4);
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
    } else if (shot.type === "nut") {
      drawNut(shot.x, shot.y, 0.9, shot.angle + game.time * shot.spin);
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
    const tailLength = 18 + p.tailLevel * 13;
    const back = p.facing + Math.PI;
    if (!p.swimming) shadow(x, y + 16, 25, 7);

    ctx.save();
    ctx.translate(x, y);

    if (p.swimming) {
      ctx.fillStyle = "rgba(105, 215, 255, 0.34)";
      ctx.fillRect(-28, 5, 56, 9);
      ctx.fillRect(-20, 18, 40, 6);
    }

    if (tailLength > 20) {
      const segments = Math.ceil(tailLength / 14);
      for (let i = 1; i <= segments; i += 1) {
        const d = i * 12;
        const wave = Math.sin(game.time * 5 + i * 0.75 + p.step * 0.15) * Math.min(8, p.tailLevel * 0.9);
        const width = Math.max(7, 15 - i * 0.32);
        const tx = Math.cos(back) * d + Math.cos(back + Math.PI / 2) * wave;
        const ty = Math.sin(back) * d + Math.sin(back + Math.PI / 2) * wave;
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(back + Math.sin(game.time * 4 + i) * 0.08);
        ctx.fillStyle = i === segments ? palette.beaver : palette.beaverDark;
        ctx.fillRect(-7, -width / 2, 17, width);
        ctx.restore();
      }
      const endWave = Math.sin(game.time * 5 + segments * 0.75 + p.step * 0.15) * Math.min(8, p.tailLevel * 0.9);
      const ex = Math.cos(back) * (tailLength + 8) + Math.cos(back + Math.PI / 2) * endWave;
      const ey = Math.sin(back) * (tailLength + 8) + Math.sin(back + Math.PI / 2) * endWave;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(back + Math.sin(game.time * 4 + segments) * 0.12);
      ctx.fillStyle = palette.beaver;
      ctx.fillRect(-5, -12, 24, 24);
      ctx.fillStyle = "rgba(245, 238, 209, 0.12)";
      ctx.fillRect(0, -7, 14, 3);
      ctx.fillRect(0, 5, 14, 3);
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

    if (p.hat) {
      ctx.fillStyle = "#34463d";
      ctx.fillRect(faceX - 12, faceY - 25, 26, 7);
      ctx.fillRect(faceX - 6, faceY - 36, 14, 12);
    }
    if (p.boots && !p.swimming) {
      ctx.fillStyle = "#202018";
      ctx.fillRect(-15, 25, 12, 5);
      ctx.fillRect(4, 25, 12, 5);
    }

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

    glassPanel(18, 18, 430, 72);
    ctx.fillStyle = palette.cream;
    ctx.fillText("ZYCIE", 34, 40);
    for (let i = 0; i < p.maxHp; i += 1) {
      drawHeart(88 + i * 22, 40, i + 1 <= Math.ceil(p.hp), p.hp - i);
    }
    ctx.fillStyle = palette.cream;
    ctx.fillText("OGON", 310, 40);
    ctx.fillText(Math.round(35 + p.tailLevel * 8) + " CM", 358, 40);
    meter(310, 58, 104, 8, clamp(p.tailLevel / 12, 0, 1), palette.beaver);

    ctx.fillStyle = palette.cream;
    ctx.fillText(game.area === "underground" ? "PODZIEMIA" : "DZIEN " + game.days, 34, 68);
    ctx.fillText("RDZENIE", 142, 68);
    for (let i = 0; i < game.servers.length; i += 1) {
      const s = game.servers[i];
      ctx.fillStyle = s.destroyed ? palette.leafLight : palette.aiPink;
      ctx.beginPath();
      ctx.roundRect(207 + i * 23, 61, 15, 15, 4);
      ctx.fill();
    }

    const rightW = p.tailLevel > 0 || p.shield > 0 || p.heldPlank || p.nuts > 0 || audioMuted ? 236 : 118;
    glassPanel(size.w - rightW - 18, 18, rightW, 72);
    drawMiniMap(size.w - rightW, 31, rightW - 34, 44);

    if (p.tailLevel > 0) {
      drawTailIcon(36, size.h - 42, 0.82);
      meter(62, size.h - 55, 86, 9, clamp(p.tailLevel / 8, 0, 1), palette.beaver);
    }
    if (p.heldPlank) {
      drawPlank(size.w - 180, size.h - 42, -0.1, 0.64);
    }
    if (p.nuts > 0) {
      drawNut(size.w - 214, size.h - 42, 0.72, 0.2);
      ctx.font = "800 13px Inter, system-ui, sans-serif";
      ctx.fillStyle = palette.cream;
      ctx.fillText(String(p.nuts), size.w - 199, size.h - 42);
    }
    if (audioMuted) {
      ctx.font = "800 12px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(245, 238, 209, 0.72)";
      ctx.fillText("MUTE", size.w - 76, 104);
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
    if (game.area === "underground") {
      ctx.fillStyle = "rgba(126, 203, 119, 0.2)";
      for (const tunnel of UNDER_TUNNELS) ctx.fillRect(x + tunnel.x / UNDER_W * w, y + tunnel.y / UNDER_H * h, Math.max(2, tunnel.w / UNDER_W * w), Math.max(2, tunnel.h / UNDER_H * h));
      ctx.fillStyle = palette.cream;
      ctx.beginPath();
      ctx.arc(x + game.player.x / UNDER_W * w, y + game.player.y / UNDER_H * h, 3.2, 0, TAU);
      ctx.fill();
      ctx.restore();
      return;
    }
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
    const showingVictory = game.victoryTimer > 0;
    if (!showingVictory && game.messageTimer <= 0 && game.dialogTimer <= 0 && game.state === "play") return;

    ctx.save();
    ctx.textAlign = "center";
    if (game.state !== "play") {
      ctx.fillStyle = "rgba(6, 9, 8, 0.54)";
      ctx.fillRect(0, 0, size.w, size.h);
    } else if (showingVictory) {
      ctx.fillStyle = `rgba(6, 9, 8, ${0.18 + clamp(game.victoryTimer / 8, 0, 1) * 0.16})`;
      ctx.fillRect(0, 0, size.w, size.h);
    }

    const alpha = game.state === "play" ? clamp(Math.max(game.messageTimer, game.dialogTimer) / 0.7, 0, 1) : 1;
    ctx.globalAlpha = alpha;
    if (game.messageTimer > 0 || game.state !== "play") {
      ctx.font = "900 34px Inter, system-ui, sans-serif";
      ctx.fillStyle = palette.cream;
      ctx.fillText(game.message, size.w / 2, size.h * 0.2);
    }
    ctx.globalAlpha = 1;
    if (showingVictory) drawVictoryTransformation(size);
    if (game.dialogTimer > 0) drawDialog(size);

    if (game.state === "paused") {
      drawPausePanel(size);
    }
    if (game.state === "dead" || game.state === "won") {
      ctx.font = "700 14px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(245, 238, 209, 0.72)";
      ctx.fillText("R", size.w / 2, size.h * 0.2 + 44);
    }
    ctx.restore();
  }

  function drawVictoryTransformation(size) {
    const age = game.victoryAge;
    const progress = clamp((age - 1.2) / 3.2, 0, 1);
    const fade = clamp(game.victoryTimer / 1.2, 0, 1);
    ctx.save();
    ctx.globalAlpha = fade;
    drawLogo(size.w / 2, size.h / 2 - 8, Math.min(1.35, Math.max(0.92, size.w / 720)), progress);
    ctx.fillStyle = `rgba(126, 203, 119, ${0.25 + progress * 0.45})`;
    ctx.fillRect(size.w / 2 - 160, size.h / 2 + 34, 320 * progress, 4);
    ctx.font = "800 14px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(245, 238, 209, 0.78)";
    ctx.fillText(progress >= 1 ? "las oddycha bez maszyn" : "ostatnia kreska wraca na miejsce", size.w / 2, size.h / 2 + 72);
    ctx.restore();
  }

  function drawDialog(size) {
    const panelW = Math.min(680, size.w - 42);
    const panelX = size.w / 2 - panelW / 2;
    const panelY = size.h - Math.min(180, Math.max(118, size.h * 0.28));
    ctx.save();
    ctx.globalAlpha = clamp(game.dialogTimer / 0.4, 0, 1);
    ctx.fillStyle = "rgba(13, 18, 16, 0.88)";
    ctx.fillRect(panelX, panelY - 24, panelW, 164);
    ctx.strokeStyle = "rgba(126, 203, 119, 0.36)";
    ctx.strokeRect(panelX + 0.5, panelY - 23.5, panelW - 1, 163);
    ctx.textAlign = "left";
    ctx.font = "800 15px Inter, system-ui, sans-serif";
    ctx.fillStyle = palette.leafLight;
    ctx.fillText(game.message, panelX + 20, panelY + 4);
    ctx.font = "700 14px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(245, 238, 209, 0.86)";
    let y = panelY + 32;
    let drawn = 0;
    for (const line of game.dialogLines) {
      for (const part of wrapText(line, panelW - 40)) {
        if (drawn >= 7) break;
        ctx.fillText(part, panelX + 20, y);
        y += 20;
        drawn += 1;
      }
      if (drawn >= 7) break;
    }
    ctx.restore();
  }

  function wrapText(text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines.slice(0, 7);
  }

  function drawLogo(cx, y, scale = 1, naturalProgress = 0) {
    ctx.save();
    ctx.textAlign = "left";
    ctx.font = `${Math.round(54 * scale)}px Inter, system-ui, sans-serif`;
    ctx.font = `900 ${Math.round(54 * scale)}px Inter, system-ui, sans-serif`;
    const word = "NATURA";
    const wordW = ctx.measureText(word).width;
    const iW = 20 * scale;
    const x = cx - (wordW + iW + 10 * scale) / 2;
    ctx.fillStyle = palette.cream;
    ctx.fillText(word, x, y);
    const ix = x + wordW + 10 * scale;
    ctx.fillStyle = palette.leafLight;
    ctx.fillRect(ix + 7 * scale, y - 47 * scale, 6 * scale, 50 * scale);
    if (naturalProgress > 0) ctx.fillRect(ix + 7 * scale, y - 3 * scale, 20 * scale * clamp(naturalProgress, 0, 1), 6 * scale);
    ctx.restore();
  }

  function drawControlRows(panelX, y, panelW, rows) {
    ctx.font = "800 12px Inter, system-ui, sans-serif";
    for (let i = 0; i < rows.length; i += 1) {
      const rowY = y + i * 20;
      ctx.fillStyle = "rgba(126, 203, 119, 0.16)";
      ctx.fillRect(panelX + 22, rowY - 11, 112, 16);
      ctx.fillStyle = palette.cream;
      ctx.textAlign = "center";
      ctx.fillText(rows[i][0], panelX + 78, rowY - 1);
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(245, 238, 209, 0.78)";
      ctx.fillText(rows[i][1], panelX + 148, rowY - 1);
    }
  }

  function drawPausePanel(size) {
    const panelW = Math.min(560, size.w - 40);
    const panelH = Math.min(386, size.h - 70);
    const panelX = size.w / 2 - panelW / 2;
    const panelY = Math.max(56, size.h / 2 - panelH / 2 + 20);
    const rows = [
      ["WASD / STRZ", "ruch"],
      ["SPACJA", "rozmowa / gryz"],
      ["J", "wez / upusc deske"],
      ["K", "rzuc deske"],
      ["L", "rzuc orzeszek"],
      ["M", "dzwiek on/off"],
      ["ESC / P", "wroc"],
      ["R", "od nowa"],
      ["KWIAT", "ogon +"],
      ["SZPINAK", "tarcza"]
    ];

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(13, 18, 16, 0.86)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "rgba(245, 238, 209, 0.22)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);

    ctx.textAlign = "center";
    ctx.fillStyle = palette.cream;
    ctx.font = "900 28px Inter, system-ui, sans-serif";
    ctx.fillText("PAUZA", size.w / 2, panelY + 42);

    const actionY = panelY + 70;
    const actionW = Math.min(190, (panelW - 58) / 2);
    const leftX = panelX + panelW / 2 - actionW - 8;
    const rightX = panelX + panelW / 2 + 8;
    ctx.font = "800 13px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#1f3638";
    ctx.fillRect(leftX, actionY, actionW, 34);
    ctx.fillRect(rightX, actionY, actionW, 34);
    ctx.strokeStyle = "rgba(126, 203, 119, 0.55)";
    ctx.strokeRect(leftX + 0.5, actionY + 0.5, actionW - 1, 33);
    ctx.strokeRect(rightX + 0.5, actionY + 0.5, actionW - 1, 33);
    ctx.fillStyle = palette.cream;
    ctx.fillText("ESC / P  WROC", leftX + actionW / 2, actionY + 22);
    ctx.fillText("R  OD NOWA", rightX + actionW / 2, actionY + 22);

    ctx.textAlign = "left";
    ctx.fillStyle = palette.cream;
    ctx.font = "900 14px Inter, system-ui, sans-serif";
    ctx.fillText("STEROWANIE", panelX + 22, actionY + 66);
    drawControlRows(panelX, actionY + 90, panelW, rows);
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
    drawLogo(cx, panelY - 128, 1);
    ctx.font = "700 16px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(245, 238, 209, 0.72)";
    ctx.fillText("bobrowy sabotarz kontra system w lesie", cx, panelY - 94);

    ctx.fillStyle = palette.cream;
    ctx.font = "900 22px Inter, system-ui, sans-serif";
    ctx.fillText("START", cx, panelY - 38);

    ctx.fillStyle = "rgba(13, 18, 16, 0.72)";
    ctx.fillRect(panelX, panelY + 8, panelW, 250);
    ctx.strokeStyle = "rgba(245, 238, 209, 0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY + 8, panelW, 250);

    ctx.textAlign = "left";
    ctx.fillStyle = palette.cream;
    ctx.font = "900 14px Inter, system-ui, sans-serif";
    ctx.fillText("STEROWANIE", panelX + 22, panelY + 34);

    const rows = [
      ["WASD / STRZ", "ruch"],
      ["SPACJA", "rozmowa / gryz"],
      ["J", "wez / upusc deske"],
      ["K", "rzuc deske"],
      ["L", "rzuc orzeszek"],
      ["M", "dzwiek on/off"],
      ["KWIAT", "ogon +"],
      ["SZPINAK", "tarcza"],
      ["ESC / P", "pauza"],
      ["R", "restart"]
    ];

    drawControlRows(panelX, panelY + 58, panelW, rows);

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(245, 238, 209, 0.66)";
    ctx.font = "700 13px Inter, system-ui, sans-serif";
    ctx.fillText("najpierw porozmawiaj z bobrami; las jeszcze oddycha spokojnie", cx, panelY + 48);
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
        r: i % 2 ? 20 : 19,
        phase: rand() * TAU,
        life: 14
      });
    }
  }

  function coresLeftCount() {
    return game.servers.filter((server) => !server.destroyed).length;
  }

  function isRestoredAt(x, y) {
    if (game.worldRestored) return true;
    for (const server of game.servers) {
      if (server.destroyed && Math.hypot(x - server.x, y - server.y) < 330) return true;
    }
    return false;
  }

  function musicThreatLevel() {
    if (!game || game.area !== "surface" || game.worldRestored) return 0;
    const p = game.player;
    const dataCenter = { x: DATA_CENTER.x + DATA_CENTER.w / 2, y: DATA_CENTER.y + DATA_CENTER.h / 2 };
    const dataDistance = Math.hypot(p.x - dataCenter.x, p.y - dataCenter.y);
    const bossDistance = Math.hypot(p.x - game.boss.x, p.y - game.boss.y);
    if (!game.boss.defeated && (bossDistance < 760 || (coresLeftCount() === 0 && dataDistance < 1200))) return 2;
    if (dataDistance < 1450 || p.x > DATA_CENTER.x - TILE * 4) return 1;
    return 0;
  }

  function toggleMute() {
    audioMuted = !audioMuted;
    if (audio) {
      audio.master.gain.setTargetAtTime(audioMuted ? 0.0001 : 0.72, audio.context.currentTime, 0.08);
    }
    game.message = audioMuted ? "DZWIEK OFF" : "DZWIEK ON";
    game.messageTimer = 1.4;
  }

  function initAudio() {
    if (audio) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();

    const master = context.createGain();
    master.gain.value = audioMuted ? 0.0001 : 0.72;
    master.connect(context.destination);

    const musicGain = context.createGain();
    musicGain.gain.value = 0.72;
    const sfxGain = context.createGain();
    sfxGain.gain.value = 0.34;

    const musicFilter = context.createBiquadFilter();
    musicFilter.type = "lowpass";
    musicFilter.frequency.value = 1050;
    musicFilter.Q.value = 0.45;
    musicGain.connect(musicFilter);
    musicFilter.connect(master);
    sfxGain.connect(master);

    audio = { context, master, musicGain, sfxGain, nextNote: 0, index: 0 };
  }

  function playTone(type) {
    if (!audio || audioMuted) return;
    const { context, sfxGain } = audio;
    if (context.state === "suspended") context.resume();
    const now = context.currentTime;
    const table = {
      punch: { f: 185, to: 72, d: 0.075, w: "square", v: 0.18 },
      shoot: { f: 260, to: 145, d: 0.12, w: "triangle", v: 0.2 },
      nut: { f: 420, to: 310, d: 0.09, w: "sine", v: 0.14 },
      drop: { f: 175, to: 150, d: 0.08, w: "triangle", v: 0.11 },
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
    const { context, musicGain } = audio;
    if (context.state === "suspended") context.resume();
    if (audioMuted) {
      audio.master.gain.setTargetAtTime(0.0001, context.currentTime, 0.08);
      return;
    }
    audio.master.gain.setTargetAtTime(0.72, context.currentTime, 0.2);
    if (game.state === "dead" || game.state === "menu" || game.state === "paused") {
      musicGain.gain.setTargetAtTime(0.0001, context.currentTime, 0.4);
      return;
    }
    const clean = game.worldRestored || game.state === "won" ? 1 : (game.servers.length - coresLeftCount()) / game.servers.length;
    const threat = musicThreatLevel();
    const gainTarget = game.worldRestored ? 0.78 : threat === 2 ? 0.82 : threat === 1 ? 0.76 : 0.68;
    musicGain.gain.setTargetAtTime(gainTarget, context.currentTime, 0.8);
    if (context.currentTime < audio.nextNote) return;

    const minor = [147, 196, 220, 247, 294, 330, 392, 440];
    const major = [196, 247, 294, 330, 392, 440, 494, 587];
    const dataScale = [110, 147, 165, 196, 220, 247, 294, 330];
    const bossScale = [98, 123, 147, 165, 196, 220, 247, 294];
    const scale = threat === 2 ? bossScale : threat === 1 ? dataScale : clean > 0.55 ? major : minor;
    const phrase = threat === 2
      ? [0, 1, 3, 1, 4, 3, 1, 0, 5, 3, 2, 1]
      : threat === 1
        ? [0, 2, 1, 3, 4, 2, 1, 5, 3, 1, 2, 0]
        : clean > 0.55
          ? [0, 2, 4, 5, 7, 5, 4, 2, 1, 4, 6, 4]
          : [0, 2, 3, 5, 3, 2, 0, 4, 3, 1, 2, 5];
    const step = phrase[audio.index % phrase.length];
    const octave = threat === 2 ? (audio.index % 6 === 0 ? 0.5 : 1) : audio.index % 12 === 0 ? 0.5 : audio.index % 5 === 0 ? 1.5 : 1;
    const note = scale[step % scale.length] * octave;
    const now = context.currentTime;

    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = threat > 0 ? "triangle" : clean > 0.55 ? "triangle" : "sine";
    osc.frequency.value = note;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(threat === 2 ? 0.28 : threat === 1 ? 0.24 : 0.22, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (threat > 0 ? 0.72 : 0.9));
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(now);
    osc.stop(now + 0.94);

    if (audio.index % 3 === 1) {
      const echo = context.createOscillator();
      const echoGain = context.createGain();
      echo.type = "sine";
      echo.frequency.value = scale[(step + 2) % scale.length] * (octave >= 1.5 ? 1 : octave);
      echoGain.gain.setValueAtTime(0.0001, now + 0.18);
      echoGain.gain.exponentialRampToValueAtTime(0.09, now + 0.28);
      echoGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);
      echo.connect(echoGain);
      echoGain.connect(musicGain);
      echo.start(now + 0.18);
      echo.stop(now + 1.1);
    }

    if (audio.index % (threat > 0 ? 2 : 4) === 0) {
      const bass = context.createOscillator();
      const bassGain = context.createGain();
      bass.type = "triangle";
      bass.frequency.value = scale[0] * (threat === 2 ? 0.5 : 0.5);
      bassGain.gain.setValueAtTime(0.0001, now);
      bassGain.gain.exponentialRampToValueAtTime(threat === 2 ? 0.12 : threat === 1 ? 0.1 : 0.08, now + 0.06);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, now + (threat > 0 ? 0.82 : 1.15));
      bass.connect(bassGain);
      bassGain.connect(musicGain);
      bass.start(now);
      bass.stop(now + (threat > 0 ? 0.9 : 1.2));
    }

    audio.nextNote = now + (threat === 2 ? 0.48 : threat === 1 ? 0.56 : clean > 0.55 ? 0.62 : 0.74);
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
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "KeyE", "Escape", "KeyP", "KeyR", "KeyJ", "KeyK", "KeyL", "KeyM"].includes(event.code)) {
      event.preventDefault();
    }
    initAudio();
    if (event.code === "KeyM") {
      if (!event.repeat) toggleMute();
      return;
    }
    if ((event.code === "Escape" || event.code === "KeyP") && (game.state === "play" || game.state === "paused")) {
      if (!event.repeat) togglePause();
      return;
    }
    if (event.code === "KeyR" && (game.state === "paused" || game.state === "dead" || game.state === "won" || game.worldRestored)) {
      if (!event.repeat) {
        newGame();
        playTone("pickup");
      }
      return;
    }
    if (game.state === "menu" && (event.code === "Enter" || event.code === "Space")) {
      startGame();
      return;
    }
    if (game.state === "play" && !event.repeat) {
      if (event.code === "KeyJ") {
        handlePlankAction();
        return;
      }
      if (event.code === "KeyK") {
        throwPlank();
        return;
      }
      if (event.code === "KeyL") {
        throwNut();
        return;
      }
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
