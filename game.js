/*
 * Naturai - game.js
 * -------------------------------------------------------------------------
 * Gra rozgrywana na mapie z map.json (ladowanej przez map-data.js
 * jako window.NATURAI_MAP_JSON):
 *  - powierzchnia, podziemia (nory/tunele) oraz NOWY swiat: nurkowanie w
 *    glebokiej wodzie (podwodny odpowiednik podziemi).
 *  - trzy kable pod ziemia (Underground_wire); kazdy odcina prad TYLKO w
 *    najblizszej serwerowni.
 *  - kolizje wynikaja z flagi `collider` poszczegolnych warstw map.json.
 *
 * Sterowanie:
 *   Ruch: WASD / strzalki          Bieg: Shift / B
 *   Gryzienie: Spacja              Plucie (po kwiatach): Q
 *   Interakcja (nora/skrzynia/rozmowa): E
 *   Nurkowanie / wynurzenie (w glebokiej wodzie): F
 *   Nakarm zwierze: L              Tryb ducha: G
 *   Ekwipunek: I                   Pauza: P / Esc        Reset: R
 */
(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const TAU = Math.PI * 2;
  const DPR_LIMIT = 2;
  const TILE = 14;                 // piksele na kafelek
  const VISIBLE_TILE_ROWS = 15;    // okno gry = 15 kafelkow wysokosci...
  const VISIBLE_TILE_COLS = 30;    // ...i 30 kafelkow szerokosci (MAP-002)
  const PLAYER_RADIUS = TILE * 0.34;
  const REGION_RADIUS = TILE * 0.3;  // ciasniejszy promien do tuneli/wody
  const SPRITE = TILE * 0.46;        // maks. promien sprite'a - wszystko <= 1 kafelek
  const BASE_SPEED = TILE * 7.4;
  const RUN_MULT = 1.4;

  // Paleta przeniesiona z game_old.js - cieplejszy, mniej "plaski" wyglad.
  const palette = {
    leaf: "#3f8f5a", leafLight: "#7ecb77", moss: "#203b2c", grass: "#315e3e",
    soil: "#6d5941", water: "#315d73", flower: "#f2e872", spinach: "#4ed06d",
    aiPink: "#e4549a", aiBlue: "#69d7ff", aiViolet: "#7e67ff", bark: "#674d34",
    cream: "#f5eed1", red: "#f15b5b", beaver: "#8a5a33", beaverDark: "#5c3924",
    plank: "#b77b43", snow: "#cfd8cf", shadow: "rgba(4, 7, 6, 0.42)"
  };

  // Kwiaty: kazdy ma inna nazwe i leczy o pol zycia.
  const FLOWER_NAMES = ["STOKROTKA", "MAK", "CHABER", "FIOLEK", "KONICZYNA", "MNISZEK",
    "DZWONEK", "NIEZAPOMINAJKA", "JASKIER", "OSET", "RUMIANEK"];
  const FLOWER_COLORS = ["#f7f0dc", "#e53935", "#3f7df0", "#7d4bc7", "#f3d7eb", "#ffd43b",
    "#5a79db", "#7bbcff", "#ffe15a", "#a85ad6", "#f7f0dc"];

  let audio = null;
  let audioMuted = false;

  // -----------------------------------------------------------------------
  // Role warstw - wnioski wyciagniete z analizy map.json.
  // cat: kategoria zachowania, world: do ktorego swiata nalezy warstwa.
  // -----------------------------------------------------------------------
  const ROLE = {
    // --- powierzchnia: teren ---
    Grass:            { cat: "terrain", world: "surface", c: "#3e6b3a", c2: "#487a42" },
    Sand:             { cat: "terrain", world: "surface", c: "#cdb074", c2: "#d9bf86" },
    Snow:             { cat: "terrain", world: "surface", c: "#d3e0e6", c2: "#e7eff4" },
    Ice:              { cat: "terrain", world: "surface", c: "#9fc8d6", c2: "#c2e2ec", ice: true },
    Stone_path:       { cat: "terrain", world: "surface", c: "#6f6450", c2: "#7d715c" },
    Wooden_floor:     { cat: "terrain", world: "surface", c: "#7a5734", c2: "#8a6740" },
    Synthetic_carpet: { cat: "terrain", world: "surface", c: "#2c313c", c2: "#353c49" },
    Water:            { cat: "water",     world: "surface", c: "#2f6478", c2: "#387a90" },
    Deep_water:       { cat: "deepwater", world: "surface", c: "#163a51", c2: "#1d4a66" },
    Techno_serwer_room:{ cat: "serverfloor", world: "surface" },
    // --- powierzchnia: przeszkody stale (collider) ---
    Tree:             { cat: "solid", world: "surface", c: "#143523", c2: "#1a4530", tree: true },
    Tree_with_snow:   { cat: "solid", world: "surface", c: "#2c4a3c", c2: "#365a49", tree: true, snow: true },
    Bush:             { cat: "solid", world: "surface", c: "#27602f", c2: "#2f7338", bush: true },
    Snowball:         { cat: "solid", world: "surface", c: "#e6eef2", c2: "#ffffff", ball: true },
    Wood:             { cat: "solid", world: "surface", c: "#6e4d2e", c2: "#80592f", log: true },
    Techno_infrastructure:{ cat: "solid", world: "surface", c: "#39444c", c2: "#49565e", tech: true },
    Techno_defensive_wall:{ cat: "solid", world: "surface", c: "#1b232a", c2: "#28333b", tech: true },
    // --- powierzchnia: niszczalne ---
    Interactive_tree:          { cat: "destructible", world: "surface", c: "#2f8b45", c2: "#3aa755", hp: 2, blocks: true, label: "DRZEWO", tree: true },
    Interactive_tree_with_snow:{ cat: "destructible", world: "surface", c: "#4a8f6b", c2: "#5aa37e", hp: 2, blocks: true, label: "OSNIEZONE DRZEWO", tree: true, snow: true },
    Interactive_bush:          { cat: "destructible", world: "surface", c: "#4f9d43", c2: "#62b455", hp: 1, blocks: true, label: "KRZAK", bush: true },
    Interactive_door:          { cat: "destructible", world: "surface", c: "#9a6b3f", c2: "#b8814c", hp: 4, blocks: true, label: "DRZWI" },
    Interactive_electric_door: { cat: "door_electric", world: "surface", c: "#55d7ff", c2: "#f05fa7", hp: 6, blocks: true, label: "DRZWI ELEKTRYCZNE" },
    // --- powierzchnia: zagrozenie ---
    Fire:             { cat: "hazard", world: "surface", c: "#ff7a2a", c2: "#ffc24d" },
    // --- zbieralne ---
    Flower:           { cat: "flower", world: "surface" },
    Water_flower:     { cat: "flower", world: "surface" },
    Chest:            { cat: "chest",  world: "surface" },
    Intel:            { cat: "intel", world: "surface", label: "DANE AI", color: "#9fe7ff" },
    Intel_note:       { cat: "intel", world: "surface", label: "NOTATKA", color: "#e5c78f" },
    // --- struktury / dekoracje ---
    Abandoned_cottage:{ cat: "cottage", world: "surface" },
    // --- portale ---
    Entrance_underground:{ cat: "portal", world: "surface" },
    // --- npc ---
    Beaver_NPC:       { cat: "npc", world: "surface" },
    // --- boss ---
    Techno_final_boss:{ cat: "boss", world: "surface" },
    // --- aktorzy (powierzchnia) ---
    Good_animal:        { cat: "actor", world: "surface", kind: "friend",  hp: 2, c: "#d7a85c", c2: "#f0cf8c" },
    Good_small_animal:  { cat: "actor", world: "surface", kind: "friend",  hp: 1, c: "#cdbb7a", c2: "#e6d79c" },
    Bad_animal:         { cat: "actor", world: "surface", kind: "melee",   hp: 3, c: "#b05a5a", c2: "#d98a8a" },
    Bad_small_animal:   { cat: "actor", world: "surface", kind: "melee",   hp: 2, c: "#c06a6a", c2: "#e09a9a" },
    Robot_easy:         { cat: "actor", world: "surface", kind: "melee",   hp: 3, c: "#5a6b75", c2: "#7c8e98", robot: true },
    Robot_shooting:     { cat: "actor", world: "surface", kind: "shooter", hp: 4, rate: 2.8, c: "#6b6f7a", c2: "#8a8f9b", robot: true },
    Robot_shooting_alot:{ cat: "actor", world: "surface", kind: "shooter", hp: 5, rate: 1.7, c: "#7a5f6f", c2: "#9c7d8f", robot: true },
    Robot_drone_shooting:{ cat: "actor", world: "surface", kind: "shooter", hp: 3, rate: 2.4, c: "#63d7ff", c2: "#cdeeff", drone: true },
    Water_attacking_fish:{ cat: "actor", world: "surface", kind: "shark",  hp: 4, c: "#5a7d8a", c2: "#86abb8" },
    Water_good_fish:    { cat: "actor", world: "surface", kind: "dolphin", hp: 3, c: "#7fc7e0", c2: "#bfe9f5" },
    // --- podziemia ---
    Underground_path:   { cat: "terrain", world: "underground", c: "#463629", c2: "#52402f" },
    Underground_water:  { cat: "water",   world: "underground", c: "#274a52", c2: "#356069" },
    Underground_exit:   { cat: "portal",  world: "underground" },
    Underground_wire:   { cat: "cable",   world: "underground", hp: 1, label: "KABEL" },
    Underground_flower: { cat: "flower",  world: "underground" },
    Underground_intel:  { cat: "intel",   world: "underground", label: "PODZIEMNE DANE", color: "#9fe7ff" },
    Underground_note:   { cat: "intel",   world: "underground", label: "PODZIEMNA NOTATKA", color: "#e5c78f" },
    Underground_underwater_intel:{ cat: "intel", world: "underground", label: "ZATOPIONE DANE", color: "#9fd7ff" },
    Underground_bad_animal: { cat: "actor", world: "underground", kind: "melee",  hp: 3, c: "#8f5b5b", c2: "#c08a8a" },
    Underground_good_animal:{ cat: "actor", world: "underground", kind: "friend", hp: 2, c: "#9ecf8f", c2: "#d2f0c5" },
    Underground_NPC_mole:   { cat: "npc",   world: "underground" },
    // --- swiat podwodny (nurkowanie) ---
    Deep_water_flower:  { cat: "flower", world: "underwater" },
    Deep_water_intel:   { cat: "intel",  world: "underwater", label: "GLEBINOWE DANE", color: "#9fe7ff" },
    Underwater_intel:   { cat: "intel",  world: "underwater", label: "PODWODNE DANE", color: "#9fd7ff" },
    Deep_water_shipwreck:{ cat: "shipwreck", world: "underwater" },
    Deep_water_fish:    { cat: "actor", world: "underwater", kind: "deepfish", hp: 3, c: "#4a8aa0", c2: "#76b6c8" }
  };

  function role(name) {
    return ROLE[name] || { cat: "terrain", world: "surface", c: "#b452a8", c2: "#d06ac4" };
  }

  // Kolejnosc rysowania warstw "generycznych" (teren + przeszkody) per swiat.
  const GENERIC_DRAW = {
    surface: [
      "Grass", "Sand", "Snow", "Ice", "Stone_path", "Wooden_floor",
      "Synthetic_carpet", "Water", "Deep_water",
      "Wood", "Techno_infrastructure", "Techno_defensive_wall",
      "Bush", "Snowball", "Tree", "Tree_with_snow"
    ],
    underground: ["Underground_water", "Underground_path"],
    underwater: []
  };

  const keys = new Set();

  const state = {
    mode: "loading",
    map: null,
    worldW: 0,
    worldH: 0,
    mapW: 0,
    mapH: 0,
    area: "surface",
    layers: [],
    layersByName: new Map(),
    surfaceSolid: new Set(),
    deepWater: new Set(),
    waterSet: new Set(),
    iceSet: new Set(),
    fireSet: new Set(),
    undergroundWalk: new Set(),
    destructibles: new Map(),
    flowers: [],
    intel: [],
    chests: [],
    portalsSurface: [],
    portalsUnder: [],
    npcs: [],
    actors: [],
    shots: [],
    enemyShots: [],
    particles: [],
    floatText: [],
    cables: [],
    rooms: [],
    woods: [],
    removedStructure: new Set(),
    boss: null,
    roomsDestroyed: 0,
    roomsTotal: 0,
    worldRestored: false,
    cottages: [],
    inventory: [],
    inventoryOpen: false,
    message: "",
    messageTimer: 0,
    dialog: null,
    dialogTimer: 0,
    time: 0,
    last: performance.now(),
    camera: { x: 0, y: 0, shake: 0 },
    player: {
      x: 0, y: 0, r: PLAYER_RADIUS,
      hp: 10, maxHp: 10,
      facing: 0, step: 0,
      flowers: 0, tailLevel: 0, wood: 0,
      longStick: false, goldTeeth: false, shield: 0,
      biteCd: 0, spitCd: 0, useCd: 0, feedCd: 0, hurtCd: 0, throwCd: 0,
      ghost: false, swimming: false,
      slideDir: null, slideVX: 0, slideVY: 0
    },
    followers: []
  };

  // -----------------------------------------------------------------------
  // Pomocnicze
  // -----------------------------------------------------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const key = (x, y) => x + "," + y;
  const toPoint = (k) => { const p = k.split(","); return { x: +p[0], y: +p[1] }; };
  const tileOf = (px) => Math.floor(px / TILE);
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  function hash(x, y) {
    let n = Math.imul((x | 0) + 374761393, 668265263) ^ Math.imul((y | 0) + 1442695041, 2246822519);
    n = (n ^ (n >>> 13)) >>> 0;
    return (n % 1000) / 1000;
  }

  function showMessage(text, seconds = 1.6) {
    state.message = text;
    state.messageTimer = seconds;
  }

  function showDialog(name, lines) {
    state.dialog = { name, lines };
    state.dialogTimer = 4.5;
  }

  // -----------------------------------------------------------------------
  // Budowa swiata z map.json
  // -----------------------------------------------------------------------
  function buildWorld(raw) {
    state.map = raw;
    state.mapW = Number(raw.mapWidth) || 0;
    state.mapH = Number(raw.mapHeight) || 0;
    state.worldW = state.mapW * TILE;
    state.worldH = state.mapH * TILE;

    state.layers = [];
    state.layersByName.clear();
    state.surfaceSolid.clear();
    state.deepWater.clear();
    state.waterSet.clear();
    state.iceSet.clear();
    state.fireSet.clear();
    state.undergroundWalk.clear();
    state.destructibles.clear();
    state.flowers.length = 0;
    state.intel.length = 0;
    state.chests.length = 0;
    state.portalsSurface.length = 0;
    state.portalsUnder.length = 0;
    state.npcs.length = 0;
    state.actors.length = 0;
    state.shots.length = 0;
    state.enemyShots.length = 0;
    state.particles.length = 0;
    state.floatText.length = 0;
    state.cables.length = 0;
    state.rooms.length = 0;
    state.woods.length = 0;
    state.removedStructure.clear();
    state.followers.length = 0;
    state.inventory.length = 0;
    state.boss = null;
    state.roomsDestroyed = 0;
    state.worldRestored = false;
    state.area = "surface";
    state.inventoryOpen = false;
    state.cottages = [];

    const serverFloorTiles = [];
    const wireTiles = [];
    const electricTiles = [];
    const cottageTiles = [];
    let bossTiles = null;

    for (const layer of raw.layers || []) {
      const name = String(layer.name || "").trim();
      const r = role(name);
      const clean = {
        name,
        role: r,
        collider: !!layer.collider,
        tiles: Array.isArray(layer.tiles) ? layer.tiles.map((t) => ({ id: String(t.id), x: +t.x, y: +t.y })) : []
      };
      state.layers.push(clean);
      state.layersByName.set(name, clean);

      for (const t of clean.tiles) {
        const k = key(t.x, t.y);
        switch (r.cat) {
          case "terrain":
            if (r.world === "underground") state.undergroundWalk.add(k);
            if (r.ice) state.iceSet.add(k);
            break;
          case "water":
            if (r.world === "underground") state.undergroundWalk.add(k);
            else state.waterSet.add(k);
            break;
          case "deepwater":
            state.deepWater.add(k);
            state.waterSet.add(k);
            break;
          case "solid":
            state.surfaceSolid.add(k);
            break;
          case "hazard":
            state.fireSet.add(k);
            break;
          case "destructible":
          case "door_electric":
            state.destructibles.set(k, {
              key: k, x: t.x, y: t.y, layer: name, role: r,
              hp: r.hp, maxHp: r.hp, blocks: !!r.blocks, destroyed: false,
              electric: r.cat === "door_electric", room: null, pulse: hash(t.x, t.y) * TAU
            });
            if (r.cat === "door_electric") electricTiles.push(t);
            break;
          case "cable":
            state.undergroundWalk.add(k); // mozna stanac przy kablu
            state.destructibles.set(k, {
              key: k, x: t.x, y: t.y, layer: name, role: r,
              hp: r.hp, maxHp: r.hp, blocks: false, destroyed: false,
              cable: null, pulse: hash(t.x, t.y) * TAU
            });
            wireTiles.push(t);
            break;
          case "flower": {
            const fi = state.flowers.length % FLOWER_NAMES.length;
            state.flowers.push({
              x: t.x, y: t.y, world: r.world, taken: false, pulse: hash(t.x, t.y) * TAU,
              lily: name === "Water_flower", name: FLOWER_NAMES[fi], color: FLOWER_COLORS[fi]
            });
          }
            if (r.world === "underground") state.undergroundWalk.add(k);
            break;
          case "intel":
            state.intel.push({ x: t.x, y: t.y, world: r.world, label: r.label, color: r.color, taken: false, pulse: hash(t.x, t.y) * TAU });
            if (r.world === "underground") state.undergroundWalk.add(k);
            break;
          case "chest":
            state.surfaceSolid.add(k);
            state.chests.push({ x: t.x, y: t.y, opened: false });
            break;
          case "portal":
            if (r.world === "underground") { state.portalsUnder.push({ x: t.x, y: t.y }); state.undergroundWalk.add(k); }
            else state.portalsSurface.push({ x: t.x, y: t.y });
            break;
          case "npc":
            state.npcs.push(makeNpc(name, t));
            if (r.world === "underground") state.undergroundWalk.add(k);
            break;
          case "actor":
            state.actors.push(makeActor(name, r, t));
            break;
          case "serverfloor":
            serverFloorTiles.push(t);
            break;
          case "cottage":
            cottageTiles.push(t);
            break;
          case "boss":
            (bossTiles || (bossTiles = [])).push(t);
            break;
          default:
            break;
        }
      }
    }

    buildRooms(serverFloorTiles);
    buildCables(wireTiles);
    linkElectricDoors(electricTiles);
    assignGuards();
    assignStructure();
    buildCottages(cottageTiles);
    if (bossTiles) buildBoss(bossTiles);
    spawnPlayer();
    updateCamera(0);
  }

  // Przypisz kafelki infrastruktury i muru obronnego do najblizszej serwerowni.
  // Zniszczenie serwerowni usuwa te kafelki (znika blokada dalszej drogi).
  function assignStructure() {
    for (const room of state.rooms) room.structure = [];
    for (const layerName of ["Techno_infrastructure", "Techno_defensive_wall"]) {
      const layer = state.layersByName.get(layerName);
      if (!layer) continue;
      for (const t of layer.tiles) {
        const room = nearestRoom(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2);
        if (room) room.structure.push(key(t.x, t.y));
      }
    }
  }

  // Chatki: kazdy klaster to budynek ze scianami (kolizja po obwodzie), wnetrzem,
  // dachem, oknem i drzwiami u dolu. Drzwi to luka w scianie (przechodnia).
  function buildCottages(tiles) {
    const clusters = clusterTiles(tiles, 1);
    state.cottages = clusters.map((c, i) => {
      const b = c.box;
      const doorX = Math.round((b.minX + b.maxX) / 2);
      const doorY = b.maxY;
      // sciany = obwod prostokata, bez kafelka drzwi
      for (let x = b.minX; x <= b.maxX; x++) {
        for (let y = b.minY; y <= b.maxY; y++) {
          const border = x === b.minX || x === b.maxX || y === b.minY || y === b.maxY;
          if (border && !(x === doorX && y === doorY)) state.surfaceSolid.add(key(x, y));
        }
      }
      return { box: b, doorX, doorY, cx: c.cx, cy: c.cy, used: false, lore: COTTAGE_LORE[i % COTTAGE_LORE.length] };
    });
  }

  function makeNpc(name, t) {
    const lore = NPC_LINES[name] || NPC_LINES._default;
    const idx = state.npcs.length % lore.length;
    return {
      name, world: role(name).world,
      x: t.x * TILE + TILE / 2, y: t.y * TILE + TILE / 2,
      mole: name === "Underground_NPC_mole",
      lines: lore[idx], phase: hash(t.x, t.y) * TAU
    };
  }

  function makeActor(name, r, t) {
    const cx = t.x * TILE + TILE / 2;
    const cy = t.y * TILE + TILE / 2;
    const hostile = r.kind === "melee" || r.kind === "shooter" || r.kind === "shark" || r.kind === "deepfish";
    return {
      layer: name, role: r, kind: r.kind, world: r.world,
      x: cx, y: cy, ox: cx, oy: cy, r: TILE * 0.42,
      hp: r.hp, maxHp: r.hp, dead: false,
      hostile, shootCd: (r.rate || 1.5) * (0.3 + hash(t.x, t.y)),
      phase: hash(t.x, t.y) * TAU, dir: hash(t.y, t.x) * TAU,
      room: null, follower: false, fed: false, leashTimer: 0,
      hitFlash: 0, aggro: false
    };
  }

  // Klasteryzacja kafelkow (sasiedztwo Chebyshev <= gap).
  function clusterTiles(tiles, gap) {
    const set = new Set(tiles.map((t) => key(t.x, t.y)));
    const seen = new Set();
    const clusters = [];
    for (const t of tiles) {
      const k0 = key(t.x, t.y);
      if (seen.has(k0)) continue;
      const stack = [{ x: t.x, y: t.y }];
      seen.add(k0);
      const comp = [];
      while (stack.length) {
        const c = stack.pop();
        comp.push(c);
        for (let dx = -gap; dx <= gap; dx++) {
          for (let dy = -gap; dy <= gap; dy++) {
            const nk = key(c.x + dx, c.y + dy);
            if (set.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push({ x: c.x + dx, y: c.y + dy }); }
          }
        }
      }
      clusters.push(comp);
    }
    return clusters.map((comp) => {
      const xs = comp.map((p) => p.x), ys = comp.map((p) => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      return {
        tiles: comp,
        cx: (xs.reduce((a, b) => a + b, 0) / comp.length + 0.5) * TILE,
        cy: (ys.reduce((a, b) => a + b, 0) / comp.length + 0.5) * TILE,
        box: { minX, maxX, minY, maxY }
      };
    });
  }

  function buildRooms(tiles) {
    const clusters = clusterTiles(tiles, 1);
    state.rooms = clusters.map((c, i) => ({
      id: i, tiles: new Set(c.tiles.map((p) => key(p.x, p.y))),
      cx: c.cx, cy: c.cy, box: c.box,
      core: { x: c.cx, y: c.cy, r: TILE * 1.1, hp: 5, maxHp: 5 },
      powered: false, cable: null, guards: [], destroyed: false, pulse: i
    }));
    state.roomsTotal = state.rooms.length;
  }

  function nearestRoom(px, py) {
    let best = null, bd = Infinity;
    for (const room of state.rooms) {
      const d = dist(px, py, room.cx, room.cy);
      if (d < bd) { bd = d; best = room; }
    }
    return best;
  }

  function buildCables(tiles) {
    const clusters = clusterTiles(tiles, 2);
    state.cables = clusters.map((c, i) => {
      const room = nearestRoom(c.cx, c.cy);
      const cable = {
        id: i, cx: c.cx, cy: c.cy, room, cut: false,
        tileKeys: c.tiles.map((p) => key(p.x, p.y))
      };
      if (room) { room.powered = true; room.cable = cable; }
      // powiaz kafelki-destruktory z tym kablem
      for (const k of cable.tileKeys) {
        const d = state.destructibles.get(k);
        if (d) d.cable = cable;
      }
      return cable;
    });
  }

  function linkElectricDoors(tiles) {
    const clusters = clusterTiles(tiles, 2);
    for (const c of clusters) {
      const room = nearestRoom(c.cx, c.cy);
      for (const p of c.tiles) {
        const d = state.destructibles.get(key(p.x, p.y));
        if (d) d.room = room;
      }
    }
  }

  function assignGuards() {
    for (const a of state.actors) {
      if (!a.hostile || a.world !== "surface") continue;
      let best = null, bd = TILE * 9;
      for (const room of state.rooms) {
        const b = room.box;
        const inside = a.ox >= (b.minX - 4) * TILE && a.ox <= (b.maxX + 5) * TILE &&
                       a.oy >= (b.minY - 4) * TILE && a.oy <= (b.maxY + 5) * TILE;
        const d = dist(a.x, a.y, room.cx, room.cy);
        if (inside && d < bd) { bd = d; best = room; }
      }
      if (best) { a.room = best; best.guards.push(a); }
    }
  }

  function buildBoss(tiles) {
    const xs = tiles.map((t) => t.x), ys = tiles.map((t) => t.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    state.boss = {
      x: (minX + maxX + 1) * TILE / 2,
      y: (minY + maxY + 1) * TILE / 2,
      r: Math.max(maxX - minX, maxY - minY) * TILE * 0.5,
      hp: 30, maxHp: 30, defeated: false, shootCd: 1.5, pulse: 0
    };
  }

  function spawnPlayer() {
    // Start: najblizsza chodliwa kafelka trawy/piasku do lewej "ojczyzny" bobra.
    const target = { x: 35, y: 80 };
    let best = null, bd = Infinity;
    const ground = state.layersByName.get("Grass");
    const cand = (ground ? ground.tiles : []).concat(
      (state.layersByName.get("Sand") || { tiles: [] }).tiles
    );
    for (const t of cand) {
      const k = key(t.x, t.y);
      if (state.surfaceSolid.has(k) || state.waterSet.has(k) || state.fireSet.has(k)) continue;
      const d = dist(t.x, t.y, target.x, target.y);
      if (d < bd) { bd = d; best = t; }
    }
    const p = state.player;
    if (best) { p.x = best.x * TILE + TILE / 2; p.y = best.y * TILE + TILE / 2; }
    else { p.x = state.worldW * 0.1; p.y = state.worldH * 0.5; }
    p.hp = p.maxHp; p.flowers = 0; p.tailLevel = 0; p.facing = 0;
    p.longStick = false; p.goldTeeth = false; p.shield = 0;
    p.ghost = false; p.swimming = false;
    p.biteCd = p.spitCd = p.useCd = p.feedCd = p.hurtCd = 0;
  }

  // -----------------------------------------------------------------------
  // Widocznosc warstw / swiatow
  // -----------------------------------------------------------------------
  function layerActive(worldOfLayer) {
    return worldOfLayer === state.area;
  }

  // -----------------------------------------------------------------------
  // Kolizje
  // -----------------------------------------------------------------------
  function isSurfaceBlocking(tx, ty) {
    const k = key(tx, ty);
    if (state.surfaceSolid.has(k)) {
      // skrzynie staja sie przechodnie po otwarciu
      const chest = state.chests.find((c) => c.x === tx && c.y === ty);
      if (chest && chest.opened) {
        // sprawdz czy inny solid tez tu jest
        if (!hasOtherSolid(tx, ty)) return false;
      }
      return true;
    }
    const d = state.destructibles.get(k);
    if (d && d.blocks && !d.destroyed && d.role.world === "surface") return true;
    return false;
  }

  function hasOtherSolid(tx, ty) {
    // czy oprocz skrzyni jest tu jakas inna stala przeszkoda
    for (const layer of state.layers) {
      if (layer.role.cat !== "solid") continue;
      for (const t of layer.tiles) if (t.x === tx && t.y === ty) return true;
    }
    return false;
  }

  function circleHitsSurfaceSolid(x, y, r) {
    const x0 = tileOf(x - r), x1 = tileOf(x + r);
    const y0 = tileOf(y - r), y1 = tileOf(y + r);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!isSurfaceBlocking(tx, ty)) continue;
        const rx = tx * TILE, ry = ty * TILE;
        const cx = clamp(x, rx, rx + TILE), cy = clamp(y, ry, ry + TILE);
        if (dist(x, y, cx, cy) <= r) return true;
      }
    }
    return false;
  }

  function pointInRegion(x, y, set) {
    return set.has(key(tileOf(x), tileOf(y)));
  }

  function circleInRegion(x, y, r, set) {
    if (!pointInRegion(x, y, set)) return false;
    if (!pointInRegion(x + r, y, set)) return false;
    if (!pointInRegion(x - r, y, set)) return false;
    if (!pointInRegion(x, y + r, set)) return false;
    if (!pointInRegion(x, y - r, set)) return false;
    return true;
  }

  function moveCircle(p, dx, dy) {
    const minX = p.r, minY = p.r;
    const maxX = Math.max(p.r, state.worldW - p.r);
    const maxY = Math.max(p.r, state.worldH - p.r);

    if (p.ghost) {
      p.x = clamp(p.x + dx, minX, maxX);
      p.y = clamp(p.y + dy, minY, maxY);
      return;
    }

    if (state.area === "underground" || state.area === "underwater") {
      const set = state.area === "underground" ? state.undergroundWalk : state.deepWater;
      const r = REGION_RADIUS;
      const nx = clamp(p.x + dx, minX, maxX);
      if (circleInRegion(nx, p.y, r, set)) p.x = nx;
      const ny = clamp(p.y + dy, minY, maxY);
      if (circleInRegion(p.x, ny, r, set)) p.y = ny;
      return;
    }

    // powierzchnia
    const nx = clamp(p.x + dx, minX, maxX);
    if (!circleHitsSurfaceSolid(nx, p.y, p.r)) p.x = nx;
    const ny = clamp(p.y + dy, minY, maxY);
    if (!circleHitsSurfaceSolid(p.x, ny, p.r)) p.y = ny;

    // wypchniecia z okragów: rdzenie serwerow i boss
    for (const room of state.rooms) {
      if (room.destroyed) continue;
      pushOutCircle(p, room.core.x, room.core.y, room.core.r);
    }
    if (state.boss && !state.boss.defeated) pushOutCircle(p, state.boss.x, state.boss.y, state.boss.r - 4);
  }

  function pushOutCircle(p, cx, cy, cr) {
    const d = dist(p.x, p.y, cx, cy);
    const push = p.r + cr - d;
    if (push > 0 && d > 0.001) {
      p.x += (p.x - cx) / d * push;
      p.y += (p.y - cy) / d * push;
    }
  }

  function shotHitsSolid(x, y) {
    if (state.area === "underground") return !pointInRegion(x, y, state.undergroundWalk);
    if (state.area === "underwater") return !pointInRegion(x, y, state.deepWater);
    return isSurfaceBlocking(tileOf(x), tileOf(y));
  }

  // -----------------------------------------------------------------------
  // Petla / aktualizacja
  // -----------------------------------------------------------------------
  function loop(now) {
    const dt = Math.min(0.033, (now - state.last) / 1000 || 0);
    state.last = now;
    update(dt);
    updateMusic();
    render();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    state.time += dt;
    state.messageTimer = Math.max(0, state.messageTimer - dt);
    state.dialogTimer = Math.max(0, state.dialogTimer - dt);
    if (state.mode !== "play") return;
    if (state.inventoryOpen) return;

    updatePlayer(dt);
    updateActors(dt);
    updateBoss(dt);
    updateShots(dt);
    updateFollowers(dt);
    updatePickups();
    updateParticles(dt);
    updateFloatText(dt);
    updateCamera(dt);

    if (state.player.hp <= 0 && !state.worldRestored) {
      state.mode = "dead";
      playTone("down");
      showMessage("EKSPANSJA MASZYN NIE ZOSTALA POWSTRZYMANA. R - RESTART", 999);
    }
  }

  function updatePlayer(dt) {
    const p = state.player;
    p.biteCd = Math.max(0, p.biteCd - dt);
    p.spitCd = Math.max(0, p.spitCd - dt);
    p.throwCd = Math.max(0, p.throwCd - dt);
    p.useCd = Math.max(0, p.useCd - dt);
    p.feedCd = Math.max(0, p.feedCd - dt);
    p.hurtCd = Math.max(0, p.hurtCd - dt);
    p.shield = Math.max(0, p.shield - dt);

    let dx = 0, dy = 0;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
    if (keys.has("KeyW") || keys.has("ArrowUp")) dy -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) dy += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
      p.facing = Math.atan2(dy, dx);
      p.step += dt * 12;
    }

    const onWater = !p.ghost && state.area === "surface" && pointInRegion(p.x, p.y, state.waterSet);
    p.swimming = onWater || state.area === "underwater";
    const running = (keys.has("ShiftLeft") || keys.has("ShiftRight") || keys.has("KeyB")) && !p.swimming;
    let speed = BASE_SPEED * (running ? RUN_MULT : 1);
    if (p.swimming) speed *= 0.62;
    if (state.area === "underground") speed *= 0.9;
    if (p.ghost) speed *= 1.3;

    // LOD: po wejsciu na lod bobr slizga sie w kierunku wejscia i nie moze skrecic,
    // az dojedzie do konca lodu (lub sciany).
    const onIce = !p.ghost && state.area === "surface" && pointInRegion(p.x, p.y, state.iceSet);
    if (onIce) {
      if (p.slideDir === null && (dx || dy)) { p.slideDir = Math.atan2(dy, dx); p.facing = p.slideDir; }
      if (p.slideDir !== null) {
        const ox = p.x, oy = p.y;
        moveCircle(p, Math.cos(p.slideDir) * speed * dt, Math.sin(p.slideDir) * speed * dt);
        if (Math.hypot(p.x - ox, p.y - oy) < 0.05) p.slideDir = null; // uderzyl w sciane - stop, mozna sprobowac ponownie
      }
    } else {
      p.slideDir = null;
      moveCircle(p, dx * speed * dt, dy * speed * dt);
    }

    if (keys.has("Space")) bite();
    if (keys.has("KeyQ")) spit();

    // ogien parzy (przechodni, ale zadaje obrazenia; okno nietykalnosci ogranicza tempo)
    if (!p.ghost && state.area === "surface" && pointInRegion(p.x, p.y, state.fireSet)) {
      hurtPlayer(1, true, p.x, p.y);
    }
    // iskrzace drzwi elektryczne pod napieciem
    if (!p.ghost && state.area === "surface") {
      const near = nearbyDestructibles(p.x, p.y, p.r + TILE * 0.8);
      for (const d of near) {
        if (d.electric && !d.destroyed && d.room && d.room.powered) { hurtPlayer(0.8, true, p.x, p.y); break; }
      }
    }
  }

  function nearbyDestructibles(x, y, radius) {
    const out = [];
    const x0 = tileOf(x - radius), x1 = tileOf(x + radius);
    const y0 = tileOf(y - radius), y1 = tileOf(y + radius);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const d = state.destructibles.get(key(tx, ty));
        if (d) out.push(d);
      }
    }
    return out;
  }

  // Ruch aktora z poszanowaniem przeszkod (MOVE: zli bohaterowie sa ograniczani
  // przez drzewa, sciany i inne przeszkody; ryby trzymaja sie wody; podziemni/podwodni
  // pozostaja w swoim obszarze).
  function moveActor(a, dx, dy) {
    const minX = a.r, minY = a.r;
    const maxX = Math.max(a.r, state.worldW - a.r);
    const maxY = Math.max(a.r, state.worldH - a.r);
    const water = a.kind === "shark" || a.kind === "dolphin";
    if (a.world === "underground" || a.world === "underwater") {
      const set = a.world === "underground" ? state.undergroundWalk : state.deepWater;
      const nx = clamp(a.x + dx, minX, maxX);
      if (circleInRegion(nx, a.y, a.r * 0.6, set)) a.x = nx;
      const ny = clamp(a.y + dy, minY, maxY);
      if (circleInRegion(a.x, ny, a.r * 0.6, set)) a.y = ny;
      return;
    }
    if (water) {
      // rekiny/delfiny tylko po wodzie
      const nx = clamp(a.x + dx, minX, maxX);
      if (pointInRegion(nx, a.y, state.waterSet)) a.x = nx;
      const ny = clamp(a.y + dy, minY, maxY);
      if (pointInRegion(a.x, ny, state.waterSet)) a.y = ny;
      return;
    }
    // ladowi wrogowie/zwierzeta: blokowani przez stale przeszkody i nie wchodza do wody
    const nx = clamp(a.x + dx, minX, maxX);
    if (!circleHitsSurfaceSolid(nx, a.y, a.r) && !pointInRegion(nx, a.y, state.waterSet)) a.x = nx;
    const ny = clamp(a.y + dy, minY, maxY);
    if (!circleHitsSurfaceSolid(a.x, ny, a.r) && !pointInRegion(a.x, ny, state.waterSet)) a.y = ny;
  }

  function updateActors(dt) {
    const p = state.player;
    for (const a of state.actors) {
      if (a.dead || a.follower) continue;
      if (!layerActive(a.world)) continue;
      a.phase += dt * 2.2;
      if (a.hitFlash > 0) a.hitFlash -= dt;
      const d = dist(p.x, p.y, a.x, a.y);
      a.aggro = false;

      if (a.kind === "dolphin") {
        // delfin: pod woda, okresowo wyskakuje lukiem
        a.jumpClock = (a.jumpClock || 0) + dt;
        if (a.jumping) {
          a.jumpT += dt;
          moveActor(a, Math.cos(a.dir) * 26 * dt, Math.sin(a.dir) * 26 * dt);
          if (a.jumpT >= a.jumpDur) { a.jumping = false; a.jumpClock = 0; }
        } else {
          a.dir += Math.sin(state.time * 0.6 + a.phase) * dt;
          moveActor(a, Math.cos(a.dir) * 8 * dt, Math.sin(a.dir) * 8 * dt);
          if (dist(a.x, a.y, a.ox, a.oy) > TILE * 4) { a.dir = Math.atan2(a.oy - a.y, a.ox - a.x); }
          if (a.jumpClock > 3 + hash(Math.floor(a.ox), Math.floor(a.oy)) * 3) { a.jumping = true; a.jumpT = 0; a.jumpDur = 1.1; }
        }
        continue;
      }
      if (a.kind === "shark" || a.kind === "deepfish") {
        a.dir += Math.sin(state.time * 0.8 + a.phase) * dt;
        moveActor(a, Math.cos(a.dir) * 18 * dt, Math.sin(a.dir) * 18 * dt);
        if (dist(a.x, a.y, a.ox, a.oy) > TILE * 4) {
          const back = Math.atan2(a.oy - a.y, a.ox - a.x);
          moveActor(a, Math.cos(back) * 26 * dt, Math.sin(back) * 26 * dt); a.dir = back;
        }
        if (!p.ghost && p.swimming && d < p.r + a.r + 2) hurtPlayer(0.8, true, a.x, a.y);
        continue;
      }

      // zwierzeta przyjazne (kotki/pieski/podziemne) - lazikuja wokol startu
      if (a.kind === "friend") {
        a.dir += (hash(Math.floor(state.time + a.phase), a.ox) - 0.5) * dt * 2;
        if (dist(a.x, a.y, a.ox, a.oy) < TILE * 3) moveActor(a, Math.cos(a.dir) * 10 * dt, Math.sin(a.dir) * 10 * dt);
        else { const back = Math.atan2(a.oy - a.y, a.ox - a.x); a.dir = back; moveActor(a, Math.cos(back) * 16 * dt, Math.sin(back) * 16 * dt); }
        continue;
      }
      if (!a.hostile) continue;

      // Strazy techno trzymaja sie swojej serwerowni (leash).
      const guard = a.room && !a.room.destroyed;
      const LEASH = TILE * 9;
      const homeD = guard ? dist(a.x, a.y, a.room.cx, a.room.cy) : 0;
      if (guard && homeD > LEASH) {
        const back = Math.atan2(a.room.cy - a.y, a.room.cx - a.x);
        moveActor(a, Math.cos(back) * 32 * dt, Math.sin(back) * 32 * dt);
        if (a.kind === "shooter") a.shootCd = Math.max(0, a.shootCd - dt);
        continue;
      }
      const inRange = guard ? homeD < LEASH * 1.1 : true; // poza leash nie scigaja

      if (a.kind === "shooter") {
        a.shootCd = Math.max(0, a.shootCd - dt);
        if (d < TILE * 14 && inRange && !p.ghost) {
          a.aggro = true;
          const ang = Math.atan2(p.y - a.y, p.x - a.x);
          const want = d < TILE * 6 ? -1 : (d > TILE * 10 ? 1 : 0);
          moveActor(a, Math.cos(ang) * 20 * dt * want, Math.sin(ang) * 20 * dt * want);
          if (a.shootCd <= 0 && hasLineOfSight(a, p)) {
            a.shootCd = a.role.rate || 2;
            spawnEnemyShot(a, p);
          }
        } else {
          patrolHome(a, dt);
        }
        if (!p.ghost && d < p.r + a.r + 1) hurtPlayer(0.6, true, a.x, a.y);
        continue;
      }

      // melee
      if (d < TILE * 11 && inRange && !p.ghost) {
        a.aggro = true;
        const ang = Math.atan2(p.y - a.y, p.x - a.x);
        moveActor(a, Math.cos(ang) * 30 * dt, Math.sin(ang) * 30 * dt);
      } else {
        patrolHome(a, dt);
      }
      if (!p.ghost && d < p.r + a.r + 1) hurtPlayer(0.7, true, a.x, a.y);
    }
  }

  // Lazikuje wokol punktu startu / serwerowni (nie oddala sie).
  function patrolHome(a, dt) {
    const cx = a.room && !a.room.destroyed ? a.room.cx : a.ox;
    const cy = a.room && !a.room.destroyed ? a.room.cy : a.oy;
    if (dist(a.x, a.y, cx, cy) > TILE * 5) {
      const back = Math.atan2(cy - a.y, cx - a.x); a.dir = back;
      moveActor(a, Math.cos(back) * 16 * dt, Math.sin(back) * 16 * dt);
    } else {
      a.dir += (hash(Math.floor(state.time + a.phase), a.oy) - 0.5) * dt * 2;
      moveActor(a, Math.cos(a.dir) * 9 * dt, Math.sin(a.dir) * 9 * dt);
    }
  }

  // Strzelaja tylko, gdy nie zaslania ich sciana/drzewo (pocisk i tak nie przebije muru).
  function hasLineOfSight(a, p) {
    const steps = Math.ceil(dist(a.x, a.y, p.x, p.y) / (TILE * 0.6));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (isSurfaceBlocking(tileOf(a.x + (p.x - a.x) * t), tileOf(a.y + (p.y - a.y) * t))) return false;
    }
    return true;
  }

  function updateBoss(dt) {
    const b = state.boss;
    if (!b || b.defeated || !layerActive("surface")) return;
    b.pulse += dt * 2.4;
    b.shootCd = Math.max(0, b.shootCd - dt);
    const p = state.player;
    const d = dist(p.x, p.y, b.x, b.y);
    if (!p.ghost && d < b.r + p.r) hurtPlayer(1.2, true, b.x, b.y);
    if (!p.ghost && d < TILE * 24 && b.shootCd <= 0) {
      b.shootCd = state.roomsDestroyed >= state.roomsTotal ? 0.7 : 1.4;
      for (let i = -1; i <= 1; i++) {
        const ang = Math.atan2(p.y - b.y, p.x - b.x) + i * 0.25;
        state.enemyShots.push({ x: b.x, y: b.y, vx: Math.cos(ang) * 240, vy: Math.sin(ang) * 240, life: 3, dmg: 0.9, boss: true });
      }
      state.camera.shake = Math.max(state.camera.shake, 3);
    }
  }

  function spawnEnemyShot(a, p) {
    const ang = Math.atan2(p.y - a.y, p.x - a.x);
    const sp = a.role.drone ? 260 : 200;
    state.enemyShots.push({ x: a.x, y: a.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 2.5, dmg: 0.6 });
    playTone("enemyShot");
  }

  // Ruch pocisku w malych krokach, by szybki pocisk nie "przeskoczyl" sciany.
  function stepShot(s, dt) {
    s.life -= dt;
    if (s.life <= 0) return false;
    const len = Math.hypot(s.vx, s.vy) * dt;
    const steps = Math.max(1, Math.ceil(len / (TILE * 0.4)));
    for (let i = 0; i < steps; i++) {
      s.x += s.vx * dt / steps; s.y += s.vy * dt / steps;
      if (shotHitsSolid(s.x, s.y)) { s.life = 0; burst(s.x, s.y, 3, s.color || "#cdeeff"); return false; }
    }
    return true;
  }

  function updateShots(dt) {
    const p = state.player;
    for (const s of state.shots) {
      if (!stepShot(s, dt)) continue;
      for (const a of state.actors) {
        if (a.dead || a.follower || !a.hostile || !layerActive(a.world)) continue;
        if (dist(s.x, s.y, a.x, a.y) < a.r + 3) { hurtActor(a, s.dmg); s.life = 0; break; }
      }
      if (s.life > 0 && state.boss && !state.boss.defeated && layerActive("surface")) {
        if (dist(s.x, s.y, state.boss.x, state.boss.y) < state.boss.r) { hurtBoss(s.dmg); s.life = 0; }
      }
    }
    for (const s of state.enemyShots) {
      if (!stepShot(s, dt)) continue;
      if (!p.ghost && dist(s.x, s.y, p.x, p.y) < p.r + 3) { hurtPlayer(s.dmg, true, s.x, s.y); s.life = 0; }
    }
    prune(state.shots);
    prune(state.enemyShots);
  }

  function prune(arr) {
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i].life <= 0) arr.splice(i, 1);
  }

  function updateFollowers(dt) {
    const p = state.player;
    for (const f of state.followers) {
      f.leashTimer -= dt;
      if (f.leashTimer <= 0) { f.follower = false; f.fed = false; continue; }
      const d = dist(p.x, p.y, f.x, f.y);
      if (d > TILE * 2) {
        const ang = Math.atan2(p.y - f.y, p.x - f.x);
        f.x += Math.cos(ang) * 80 * dt; f.y += Math.sin(ang) * 80 * dt;
      }
      f.phase += dt * 4;
    }
    state.followers = state.followers.filter((f) => f.follower);
  }

  function updatePickups() {
    const p = state.player;
    for (const fl of state.flowers) {
      if (fl.taken || fl.world !== state.area) continue;
      const x = fl.x * TILE + TILE / 2, y = fl.y * TILE + TILE / 2;
      if (dist(p.x, p.y, x, y) < p.r + TILE * 0.7) {
        fl.taken = true; p.flowers++;
        p.hp = Math.min(p.maxHp, p.hp + 1);   // kazdy kwiat leczy o pol zycia (1 punkt)
        addFloat(x, y, "+", "#7ed957"); playTone("pickup");
        showMessage((fl.lily ? "LILIA WODNA: " : "") + fl.name + "  (+pol zycia)", 1.5);
      }
    }
    for (const it of state.intel) {
      if (it.taken || it.world !== state.area) continue;
      const x = it.x * TILE + TILE / 2, y = it.y * TILE + TILE / 2;
      if (dist(p.x, p.y, x, y) < p.r + TILE * 0.7) {
        it.taken = true;
        state.inventory.push({ label: it.label, color: it.color });
        addFloat(x, y, it.label, it.color || "#9fe7ff"); playTone("pickup");
        showMessage(it.label + " - zebrane (I = ekwipunek)", 1.6);
      }
    }
    if (state.area === "surface") {
      for (const w of state.woods) {
        if (w.taken) continue;
        if (dist(p.x, p.y, w.x, w.y) < p.r + TILE * 0.7) {
          w.taken = true; p.wood++; addFloat(w.x, w.y, "DREWNO", "#b77b43"); playTone("pickup");
          showMessage("DREWNO x" + p.wood + "  (K = rzut)", 1.2);
        }
      }
    }
  }

  function addFloat(x, y, text, color) {
    state.floatText.push({ x, y, text, color, life: 1.2 });
  }

  function updateFloatText(dt) {
    for (const f of state.floatText) { f.y -= 14 * dt; f.life -= dt; }
    for (let i = state.floatText.length - 1; i >= 0; i--) if (state.floatText[i].life <= 0) state.floatText.splice(i, 1);
  }

  function updateParticles(dt) {
    for (const pt of state.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; pt.vx *= 0.92; pt.vy *= 0.92; }
    for (let i = state.particles.length - 1; i >= 0; i--) if (state.particles[i].life <= 0) state.particles.splice(i, 1);
  }

  function burst(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = 40 + Math.random() * 80;
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.3, color });
    }
  }

  // miekki cien pod obiektem (styl game_old.js)
  function shadow(cx, cy, rx, ry) {
    ctx.fillStyle = palette.shadow;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.fill();
  }

  // dymek-podpowiedz w swiecie (np. nad chatka / drzwiami)
  function worldHint(x, y, text) {
    ctx.save();
    ctx.font = "700 " + Math.round(TILE * 0.8) + "px Inter, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const w = ctx.measureText(text).width + TILE;
    ctx.fillStyle = "rgba(13,18,16,0.82)";
    ctx.fillRect(x - w / 2, y - TILE * 0.7, w, TILE * 1.3);
    ctx.fillStyle = palette.cream;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // -----------------------------------------------------------------------
  // Walka i interakcje
  // -----------------------------------------------------------------------
  function bite() {
    const p = state.player;
    if (p.biteCd > 0) return;
    p.biteCd = 0.42;
    state.camera.shake = Math.max(state.camera.shake, 1.5);
    playTone("punch");

    const reach = p.longStick ? TILE * 2.2 : TILE * 1.4;
    const hx = p.x + Math.cos(p.facing) * reach;
    const hy = p.y + Math.sin(p.facing) * reach;
    const hr = TILE * 1.0;
    const damage = 1.8 * (p.goldTeeth ? 1.35 : 1) * (p.longStick ? 1.1 : 1);
    burst(hx, hy, 4, "#f5eed1");

    // 1) niszczalne (drzewa, krzaki, drzwi, kable)
    for (const d of nearbyDestructibles(hx, hy, hr + TILE * 0.6)) {
      if (d.destroyed || d.role.world !== state.area) continue;
      const cx = d.x * TILE + TILE / 2, cy = d.y * TILE + TILE / 2;
      if (dist(hx, hy, cx, cy) > hr + TILE * 0.7) continue;
      if (d.cable) { chewCable(d); return; }
      if (d.electric && d.room && d.room.powered) {
        showMessage("DRZWI POD NAPIECIEM - ODETNIJ KABEL POD ZIEMIA", 1.6);
        burst(cx, cy, 5, "#55d7ff"); playTone("blocked");
        return;
      }
      d.hp -= damage; d.pulse += 1.4; burst(cx, cy, 4, d.role.c2 || "#cdeeff");
      if (d.hp <= 0) {
        d.destroyed = true; playTone("objectBreak");
        // rozgryziony krzak zostawia drewno, ktorym mozna rzucac
        if (d.role.bush) { state.woods.push({ x: cx, y: cy, taken: false, bob: hash(d.x, d.y) * TAU }); showMessage("KRZAK -> DREWNO (wejdz po nie, K = rzut)", 1.6); }
        else showMessage((d.role.label || "OBIEKT") + " ZNISZCZONE", 1.3);
      } else {
        playTone("hit");
        showMessage((d.role.label || "OBIEKT") + " " + Math.ceil(d.hp) + "/" + d.maxHp, 0.8);
      }
      return;
    }

    // 2) aktorzy
    for (const a of state.actors) {
      if (a.dead || a.follower || !a.hostile || !layerActive(a.world)) continue;
      if (dist(hx, hy, a.x, a.y) < hr + a.r) {
        if (a.kind === "shark") { hurtPlayer(0.6, true, a.x, a.y); showMessage("REKIN GRYZIE MOCNIEJ NIZ BOBR", 1.1); }
        hurtActor(a, damage);
        return;
      }
    }

    // 3) rdzenie serwerow
    for (const room of state.rooms) {
      if (room.destroyed) continue;
      if (dist(hx, hy, room.core.x, room.core.y) < hr + room.core.r) {
        if (room.powered) { showMessage("SERWEROWNIA POD NAPIECIEM - ODETNIJ KABEL POD ZIEMIA", 1.7); burst(room.core.x, room.core.y, 6, "#55d7ff"); playTone("blocked"); return; }
        if (room.guards.some((g) => !g.dead)) { showMessage("NAJPIERW POKONAJ STRAZNIKOW", 1.4); playTone("blocked"); return; }
        room.core.hp -= damage; burst(room.core.x, room.core.y, 6, "#cdeeff"); playTone("hit");
        if (room.core.hp <= 0) destroyRoom(room);
        else showMessage("RDZEN AI " + Math.ceil(room.core.hp) + "/" + room.core.maxHp, 0.9);
        return;
      }
    }

    // 4) boss
    const b = state.boss;
    if (b && !b.defeated && layerActive("surface") && dist(hx, hy, b.x, b.y) < b.r + hr) {
      if (state.roomsDestroyed < state.roomsTotal) {
        showMessage("BOSS JEST NIETYKALNY, DOPOKI DZIALAJA SERWEROWNIE (" + state.roomsDestroyed + "/" + state.roomsTotal + ")", 2);
        return;
      }
      hurtBoss(damage);
      return;
    }

    showMessage("GRYZ!", 0.3);
  }

  function spit() {
    const p = state.player;
    if (p.spitCd > 0) return;
    if (p.flowers <= 0) { showMessage("ZBIERZ KWIAT, BY PLUC NASIONAMI", 1.0); return; }
    p.spitCd = 0.5;
    playTone("shoot");
    const sp = 320;
    state.shots.push({
      x: p.x + Math.cos(p.facing) * p.r, y: p.y + Math.sin(p.facing) * p.r,
      vx: Math.cos(p.facing) * sp, vy: Math.sin(p.facing) * sp,
      life: 1.1, dmg: 1.4, color: "#bfff8c"
    });
  }

  // Rzut drewnem (K) - mocny pocisk, ktory niszczy i rani.
  function throwWood() {
    const p = state.player;
    if (p.throwCd > 0) return;
    if (p.wood <= 0) { showMessage("BRAK DREWNA (rozgryzaj krzaki)", 1.0); return; }
    p.wood--; p.throwCd = 0.5;
    playTone("shoot");
    const sp = 300;
    state.shots.push({
      x: p.x + Math.cos(p.facing) * p.r, y: p.y + Math.sin(p.facing) * p.r,
      vx: Math.cos(p.facing) * sp, vy: Math.sin(p.facing) * sp,
      life: 1.4, dmg: 3, wood: true, spin: Math.random() * TAU, color: "#b77b43"
    });
  }

  function chewCable(d) {
    const cable = d.cable;
    if (cable.cut) return;
    cable.cut = true;
    for (const k of cable.tileKeys) { const t = state.destructibles.get(k); if (t) t.destroyed = true; }
    burst(cable.cx, cable.cy, 12, "#9fe7ff"); playTone("objectBreak");
    if (cable.room) {
      cable.room.powered = false;
      showMessage("KABEL PRZEGRYZIONY - PRAD ODCIETY W NAJBLIZSZEJ SERWEROWNI", 2.2);
    } else {
      showMessage("KABEL PRZEGRYZIONY", 1.8);
    }
  }

  function hurtActor(a, dmg) {
    a.hp -= dmg;
    a.hitFlash = 0.12;
    burst(a.x, a.y, 5, a.role.c2 || "#ffd0d0");
    if (a.hp <= 0) {
      a.dead = true;
      burst(a.x, a.y, 10, a.role.c || "#ffffff");
      addFloat(a.x, a.y, "+", "#7ed957");
      playTone("enemyDown");
    }
  }

  function destroyRoom(room) {
    room.destroyed = true;
    state.roomsDestroyed++;
    // znika cala infrastruktura tej serwerowni - otwiera sie droga dalej
    for (const k of room.structure || []) {
      state.removedStructure.add(k);
      state.surfaceSolid.delete(k);
      const pt = toPoint(k);
      if (hash(pt.x, pt.y) > 0.82) burst(pt.x * TILE + TILE / 2, pt.y * TILE + TILE / 2, 3, "#7ed957");
    }
    burst(room.core.x, room.core.y, 22, "#7ed957");
    state.camera.shake = Math.max(state.camera.shake, 5);
    playTone("core");
    showMessage("SERWEROWNIA ZNISZCZONA - infrastruktura znika  (" + state.roomsDestroyed + "/" + state.roomsTotal + ")", 2.4);
    if (state.roomsDestroyed >= state.roomsTotal) {
      showMessage("WSZYSTKIE SERWEROWNIE PADLY - BOSS JEST PODATNY!", 3);
    }
  }

  function hurtBoss(dmg) {
    const b = state.boss;
    b.hp -= dmg;
    burst(b.x, b.y, 8, "#ff9ad6");
    state.camera.shake = Math.max(state.camera.shake, 2);
    if (b.hp <= 0) { b.defeated = true; restoreWorld(); }
    else showMessage("RDZEN BOSSA " + Math.ceil(b.hp) + "/" + b.maxHp, 0.9);
  }

  function restoreWorld() {
    state.worldRestored = true;
    for (const a of state.actors) a.dead = true;
    state.enemyShots.length = 0;
    state.camera.shake = 9;
    burst(state.boss.x, state.boss.y, 40, "#7ed957");
    showMessage("AI POKONANE - SWIAT WRACA DO NATURY. R - ZAGRAJ JESZCZE RAZ", 999);
    playTone("win");
    state.mode = "win";
  }

  function hurtPlayer(amount, force, sx, sy) {
    const p = state.player;
    if (p.ghost || state.mode !== "play") return;
    if (p.hurtCd > 0 && !force) return;
    if (p.hurtCd > 0) return;
    const dmg = p.shield > 0 ? amount * 0.35 : amount;
    p.hp = Math.max(0, p.hp - dmg);
    p.hurtCd = 0.7;
    state.camera.shake = Math.max(state.camera.shake, 4);
    if (sx !== undefined) burst(p.x, p.y, 5, "#ff7a7a");
    playTone("hurt");
  }

  // --- E: interakcja (portal / skrzynia / rozmowa) ---
  function interact() {
    const p = state.player;
    if (p.useCd > 0) return;

    // portal podziemia
    if (state.area === "surface") {
      const portal = nearestPortal(state.portalsSurface);
      if (portal) { enterUnderground(portal); p.useCd = 0.5; return; }
    } else if (state.area === "underground") {
      const portal = nearestPortal(state.portalsUnder);
      if (portal) { exitUnderground(portal); p.useCd = 0.5; return; }
    }

    // skrzynia (tylko powierzchnia)
    if (state.area === "surface") {
      for (const c of state.chests) {
        if (c.opened) continue;
        const x = c.x * TILE + TILE / 2, y = c.y * TILE + TILE / 2;
        if (dist(p.x, p.y, x, y) < p.r + TILE * 1.4) { openChest(c); p.useCd = 0.5; return; }
      }
      // chatka - wpis fabularny (raz daje notatke do plecaka)
      for (const c of state.cottages) {
        if (dist(p.x, p.y, c.cx, c.cy) < TILE * 3) {
          p.useCd = 0.5;
          showDialog("OPUSZCZONA CHATKA", c.lore.lines);
          if (!c.used) { c.used = true; addToInv(c.lore.item, "#d4a15b"); playTone("pickup"); }
          return;
        }
      }
    }

    // rozmowa z NPC
    for (const n of state.npcs) {
      if (n.world !== state.area) continue;
      if (dist(p.x, p.y, n.x, n.y) < p.r + TILE * 1.6) {
        showDialog(n.name === "Underground_NPC_mole" ? "KRET" : "BOBR", n.lines);
        p.useCd = 0.5; return;
      }
    }
    showMessage("...", 0.25);
  }

  function nearestPortal(list) {
    const p = state.player;
    let best = null, bd = TILE * 2.4;
    for (const portal of list) {
      const x = portal.x * TILE + TILE / 2, y = portal.y * TILE + TILE / 2;
      const d = dist(p.x, p.y, x, y);
      if (d < bd) { bd = d; best = portal; }
    }
    return best;
  }

  function nearestWalkable(set, px, py) {
    let best = null, bd = Infinity;
    for (const k of set) {
      const pt = toPoint(k);
      const x = pt.x * TILE + TILE / 2, y = pt.y * TILE + TILE / 2;
      const d = dist(px, py, x, y);
      if (d < bd) { bd = d; best = { x, y }; }
    }
    return best;
  }

  function enterUnderground(portal) {
    const p = state.player;
    state.area = "underground";
    const px = portal.x * TILE + TILE / 2, py = portal.y * TILE + TILE / 2;
    const w = nearestWalkable(state.undergroundWalk, px, py) || { x: px, y: py };
    p.x = w.x; p.y = w.y; p.swimming = false;
    clearFollowers();
    state.camera.x = 0; state.camera.y = 0;
    showMessage("SCHODZISZ DO TUNELI - TU SA KABLE ZASILANIA", 2);
  }

  function exitUnderground(portal) {
    const p = state.player;
    state.area = "surface";
    const px = portal.x * TILE + TILE / 2, py = portal.y * TILE + TILE / 2;
    p.x = px; p.y = py;
    state.camera.x = 0; state.camera.y = 0;
    showMessage("WRACASZ NA POWIERZCHNIE", 1.6);
  }

  // --- F: nurkowanie ---
  function toggleDive() {
    const p = state.player;
    if (p.ghost) { showMessage("W TRYBIE DUCHA NIE NURKUJESZ", 1.2); return; }
    if (state.area === "underwater") {
      state.area = "surface";
      showMessage("WYNURZASZ SIE", 1.4);
      return;
    }
    if (state.area !== "surface") return;
    if (!pointInRegion(p.x, p.y, state.deepWater)) {
      showMessage("ZANURKUJESZ TYLKO W GLEBOKIEJ WODZIE (ciemniejszy blekit)", 1.8);
      return;
    }
    state.area = "underwater";
    clearFollowers();
    showMessage("ZANURZASZ SIE - widac tylko swiat podwodny. F = wynurzenie", 2.2);
  }

  // --- L: nakarm zwierze ---
  function feedAnimal() {
    const p = state.player;
    if (p.feedCd > 0) return;
    let best = null, bd = TILE * 2.2;
    for (const a of state.actors) {
      if (a.dead || a.follower || a.kind !== "friend" || !layerActive(a.world)) continue;
      const d = dist(p.x, p.y, a.x, a.y);
      if (d < bd) { bd = d; best = a; }
    }
    if (!best) { showMessage("BRAK ZWIERZECIA DO NAKARMIENIA", 0.8); return; }
    p.feedCd = 0.6;
    best.follower = true; best.fed = true; best.leashTimer = 28;
    state.followers.push(best);
    burst(best.x, best.y, 8, "#7ed957");
    showMessage("ZWIERZE IDZIE Z TOBA (na chwile)", 1.5);
  }

  function clearFollowers() {
    for (const f of state.followers) { f.follower = false; f.fed = false; }
    state.followers.length = 0;
  }

  function openChest(c) {
    c.opened = true;
    const p = state.player;
    const loot = ["longStick", "goldTeeth", "heart", "shield"];
    const pick = loot[(c.x + c.y) % loot.length];
    if (pick === "longStick") { p.longStick = true; addToInv("SUPER DLUGI PATYK", "#b77b43"); showMessage("DLUGI PATYK - wiekszy zasieg gryzienia", 2); }
    else if (pick === "goldTeeth") { p.goldTeeth = true; addToInv("ZLOTY ZAB", "#ffd66d"); showMessage("ZLOTY ZAB - mocniejsze gryzienie", 2); }
    else if (pick === "heart") { p.maxHp += 2; p.hp = p.maxHp; addToInv("SERCE LASU", "#ff7a7a"); showMessage("SERCE LASU - +2 max HP i leczenie", 2); }
    else { p.shield = 60; addToInv("TARCZA ZE SZPINAKU", "#7ed957"); showMessage("TARCZA - mniejsze obrazenia przez chwile", 2); }
    burst(c.x * TILE + TILE / 2, c.y * TILE + TILE / 2, 10, "#ffd66d");
    playTone(pick === "heart" ? "restore" : "pickup");
  }

  function addToInv(label, color) { state.inventory.push({ label, color }); }

  // -----------------------------------------------------------------------
  // Kamera
  // -----------------------------------------------------------------------
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function screenSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
    return { w: canvas.width / dpr, h: canvas.height / dpr };
  }

  // Skala tak dobrana, by NIGDY nie pokazac wiecej niz 15 rzedow i 30 kolumn
  // kafelkow (zwykle wiazace jest 15 wysokosci; szerokosc to dopelnienie).
  function zoomScale(size) {
    return Math.max(size.h / (TILE * VISIBLE_TILE_ROWS), size.w / (TILE * VISIBLE_TILE_COLS));
  }

  function viewport(size) {
    const scale = zoomScale(size);
    return { scale, w: size.w / scale, h: size.h / scale };
  }

  function updateCamera(dt) {
    const size = screenSize();
    const vp = viewport(size);
    const p = state.player;
    const tx = clamp(p.x - vp.w / 2, 0, Math.max(0, state.worldW - vp.w));
    const ty = clamp(p.y - vp.h / 2, 0, Math.max(0, state.worldH - vp.h));
    const k = 1 - Math.pow(0.0015, dt || 0.016);
    state.camera.x += (tx - state.camera.x) * k;
    state.camera.y += (ty - state.camera.y) * k;
    state.camera.shake = Math.max(0, state.camera.shake - dt * 22);
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------
  function render() {
    resize();
    const size = screenSize();
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.fillStyle = "#0d1210";
    ctx.fillRect(0, 0, size.w, size.h);

    if (state.mode === "loading" || state.mode === "error" || !state.map) {
      drawCentered(size, state.message || "LADOWANIE");
      return;
    }

    const vp = viewport(size);
    const offX = Math.max(0, Math.floor((size.w - state.worldW * vp.scale) / 2));
    const offY = Math.max(0, Math.floor((size.h - state.worldH * vp.scale) / 2));
    const sh = state.camera.shake;
    const shx = sh ? (hash(Math.floor(state.time * 60), 4) - 0.5) * sh : 0;
    const shy = sh ? (hash(Math.floor(state.time * 60), 9) - 0.5) * sh : 0;

    ctx.save();
    ctx.translate(Math.round(offX + shx), Math.round(offY + shy));
    ctx.scale(vp.scale, vp.scale);
    ctx.translate(Math.round(-state.camera.x), Math.round(-state.camera.y));
    drawWorld(vp);
    ctx.restore();

    drawVignette(size);
    if (state.mode === "menu") { drawMenu(size); return; }
    drawHud(size);
    drawMessage(size);
    drawDialog(size);
    if (state.inventoryOpen) drawInventory(size);
    if (state.mode === "dead" || state.mode === "win") drawOverlay(size);
  }

  // Menu startowe z panelem sterowania.
  function drawMenu(size) {
    ctx.save();
    ctx.fillStyle = "rgba(6,12,9,0.78)"; ctx.fillRect(0, 0, size.w, size.h);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    // tytul
    ctx.fillStyle = palette.leafLight; ctx.font = "900 56px Inter, system-ui, sans-serif";
    ctx.fillText("NATURAI", size.w / 2, size.h * 0.2);
    ctx.fillStyle = "rgba(245,238,209,0.85)"; ctx.font = "600 16px Inter, sans-serif";
    ctx.fillText("Bobr kontra leśne AI - przegryź kable, zniszcz serwerownie, pokonaj rdzeń.", size.w / 2, size.h * 0.2 + 44);

    const rows = [
      ["WASD / strzałki", "ruch"],
      ["Shift / B", "bieg"],
      ["Spacja", "gryzienie (drzewa, krzaki, wrogowie, kable)"],
      ["Q", "plucie nasionami (po zebraniu kwiatów)"],
      ["K", "rzut drewnem (z rozgryzionych krzaków)"],
      ["E", "nora / skrzynia / chatka / rozmowa"],
      ["F", "nurkowanie w głębokiej wodzie / wynurzenie"],
      ["L", "nakarm zwierzę (idzie za tobą)"],
      ["G", "tryb ducha    I  plecak    M  dźwięk"]
    ];
    const panelW = Math.min(560, size.w - 60);
    const px = size.w / 2 - panelW / 2;
    const py = size.h * 0.34;
    const rowH = 30;
    panel(px, py, panelW, rows.length * rowH + 30);
    ctx.font = "700 15px Inter, sans-serif"; ctx.textBaseline = "middle";
    rows.forEach((r, i) => {
      const ry = py + 24 + i * rowH;
      ctx.textAlign = "right"; ctx.fillStyle = palette.aiBlue; ctx.fillText(r[0], px + panelW * 0.42, ry);
      ctx.textAlign = "left"; ctx.fillStyle = palette.cream; ctx.fillText(r[1], px + panelW * 0.46, ry);
    });

    ctx.textAlign = "center";
    ctx.fillStyle = (Math.floor(state.time * 2) % 2) ? palette.leafLight : "rgba(245,238,209,0.7)";
    ctx.font = "800 22px Inter, sans-serif";
    ctx.fillText("ENTER / SPACJA / KLIKNIJ - ZAGRAJ", size.w / 2, size.h * 0.9);
    ctx.restore();
  }

  function viewRect(vp) {
    return {
      x0: state.camera.x - TILE * 2, y0: state.camera.y - TILE * 2,
      x1: state.camera.x + vp.w + TILE * 2, y1: state.camera.y + vp.h + TILE * 2
    };
  }

  function drawWorld(vp) {
    const view = viewRect(vp);
    if (state.area === "surface") drawSurface(view);
    else if (state.area === "underground") drawUnderground(view);
    else drawUnderwater(view);
    drawShots();
    drawParticles();
    drawPlayer();
    drawFloatText();
  }

  function drawShots() {
    for (const s of state.shots) {
      if (s.wood) {
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate((s.spin || 0) + state.time * 12);
        ctx.fillStyle = "#9a6b3f"; ctx.fillRect(-TILE * 0.4, -2.5, TILE * 0.8, 5);
        ctx.strokeStyle = "rgba(40,25,12,0.5)"; ctx.strokeRect(-TILE * 0.4, -2.5, TILE * 0.8, 5);
        ctx.restore();
      } else { ctx.fillStyle = s.color || "#bfff8c"; ctx.beginPath(); ctx.arc(s.x, s.y, 2.5, 0, TAU); ctx.fill(); }
    }
    for (const s of state.enemyShots) {
      ctx.fillStyle = s.boss ? "#ff7ad0" : "#ff9a5a";
      ctx.beginPath(); ctx.arc(s.x, s.y, 2.5, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,200,120,0.4)"; ctx.beginPath(); ctx.arc(s.x, s.y, 4.5, 0, TAU); ctx.fill();
    }
  }

  function inView(x, y, view) {
    return !(x + TILE < view.x0 || x > view.x1 || y + TILE < view.y0 || y > view.y1);
  }

  function drawSurface(view) {
    ctx.fillStyle = "#172217";
    ctx.fillRect(0, 0, state.worldW, state.worldH);

    drawServerFloor(view);
    for (const name of GENERIC_DRAW.surface) drawGeneric(name, view);
    drawCottages(view);
    drawDestructibles(view, "surface");
    drawFire(view);
    drawFlowers(view);
    drawIntel(view);
    drawChests(view);
    drawPortals(state.portalsSurface, view, "#f1cf7a");
    drawServerCores();
    drawBoss();
    drawWoods(view);
    drawActors(view);
    drawNpcs(view, "surface");
    drawFollowers();
  }

  function drawWoods(view) {
    for (const w of state.woods) {
      if (w.taken) continue;
      if (!inView(w.x - TILE, w.y - TILE, view)) continue;
      const b = Math.sin(state.time * 3 + w.bob) * 1;
      ctx.save(); ctx.translate(w.x, w.y + b); ctx.rotate(-0.4);
      ctx.fillStyle = "#7a5430"; ctx.fillRect(-TILE * 0.35, -2, TILE * 0.7, 4);
      ctx.fillStyle = "#9a6b3f"; ctx.fillRect(-TILE * 0.35, -2, TILE * 0.7, 1.5);
      ctx.strokeStyle = "rgba(40,25,12,0.5)"; ctx.beginPath(); ctx.moveTo(-TILE * 0.1, -2); ctx.lineTo(-TILE * 0.1, 2); ctx.stroke();
      ctx.restore();
    }
  }

  function drawUnderground(view) {
    ctx.fillStyle = "#0e0b09";
    ctx.fillRect(0, 0, state.worldW, state.worldH);
    for (const name of GENERIC_DRAW.underground) drawGeneric(name, view);
    drawPortals(state.portalsUnder, view, "#9be0ff");
    drawDestructibles(view, "underground"); // kable
    drawFlowers(view);
    drawIntel(view);
    drawActors(view);
    drawNpcs(view, "underground");
    drawUndergroundFog();
  }

  function drawUnderwater(view) {
    ctx.fillStyle = "#06121d";
    ctx.fillRect(0, 0, state.worldW, state.worldH);
    // dno glebokiej wody
    const dw = state.layersByName.get("Deep_water");
    if (dw) {
      for (const t of dw.tiles) {
        const x = t.x * TILE, y = t.y * TILE;
        if (!inView(x, y, view)) continue;
        const h = hash(t.x, t.y);
        ctx.fillStyle = h > 0.5 ? "#0f3045" : "#0c2638";
        ctx.fillRect(x, y, TILE, TILE);
        if (h > 0.7) { ctx.fillStyle = "rgba(120,200,230,0.10)"; ctx.fillRect(x + 2, y + 2, TILE - 4, 1); }
      }
    }
    drawShipwreck(view);
    drawFlowers(view);
    drawIntel(view);
    drawActors(view);
    drawUnderwaterTint();
  }

  function drawGeneric(name, view) {
    const layer = state.layersByName.get(name);
    if (!layer || !layer.tiles.length) return;
    const r = layer.role;
    const tech = r.tech;
    for (const t of layer.tiles) {
      const x = t.x * TILE, y = t.y * TILE;
      if (!inView(x, y, view)) continue;
      if (tech && state.removedStructure.has(key(t.x, t.y))) continue; // znikla po zniszczeniu serwerowni
      const h = hash(t.x, t.y);
      if (r.cat === "water" || r.cat === "deepwater") { drawWaterTile(x, y, h, r); continue; }
      if (r.tree) { drawTreeTop(x, y, h, r); continue; }   // korony rysowane bez plaskiego tla
      if (r.bush) { drawBushTop(x, y, h, r); continue; }
      ctx.fillStyle = h > 0.55 ? r.c2 : r.c;
      ctx.fillRect(x, y, TILE, TILE);
      if (r.ball) {
        ctx.fillStyle = "#cfd8dd"; ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE * 0.55, TILE * 0.4, 0, TAU); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.beginPath(); ctx.arc(x + TILE * 0.4, y + TILE * 0.42, TILE * 0.16, 0, TAU); ctx.fill();
      } else if (r.tech) {
        ctx.fillStyle = "rgba(11,16,20,0.6)"; ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
        ctx.fillStyle = h > 0.55 ? r.c2 : r.c; ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = "rgba(105,215,255,0.12)"; ctx.fillRect(x + 3, y + 3, TILE - 6, 2);
        if (h > 0.7) { ctx.fillStyle = h > 0.85 ? palette.aiPink : palette.aiBlue; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(state.time * 4 + t.x); ctx.fillRect(x + TILE * 0.4, y + TILE * 0.5, 3, 3); ctx.globalAlpha = 1; }
      } else if (r.log) {
        ctx.fillStyle = "#5a3f25"; ctx.fillRect(x + 1, y + TILE * 0.3, TILE - 2, TILE * 0.4);
        ctx.strokeStyle = "rgba(40,25,12,0.6)"; ctx.beginPath(); ctx.arc(x + TILE * 0.25, y + TILE / 2, 1.6, 0, TAU); ctx.stroke();
      } else if (r.ice) { ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(x + 3, y + 3, TILE - 6, 1); ctx.fillRect(x + TILE * 0.5, y + 4, 1, TILE - 8); }
      else if (name === "Stone_path") { ctx.fillStyle = "rgba(0,0,0,0.12)"; if (h > 0.5) ctx.fillRect(x + 2, y + 2, TILE - 5, TILE - 5); }
      else if (name === "Wooden_floor") { ctx.fillStyle = "rgba(255,245,210,0.08)"; ctx.fillRect(x + 1, y + TILE * 0.5, TILE - 2, 1); }
      else if (name === "Synthetic_carpet") { ctx.fillStyle = "rgba(105,215,255,0.05)"; ctx.fillRect(x, y, TILE, 1); }
      else if (name === "Grass" && h > 0.86) { ctx.fillStyle = "rgba(126,203,119,0.5)"; ctx.fillRect(x + TILE * 0.4, y + TILE * 0.3, 1, 3); ctx.fillRect(x + TILE * 0.55, y + TILE * 0.4, 1, 3); }
      else if (name === "Sand" && h > 0.9) { ctx.fillStyle = "rgba(120,90,50,0.25)"; ctx.fillRect(x + TILE * 0.4, y + TILE * 0.5, 2, 1); }
    }
  }

  function drawWaterTile(x, y, h, r) {
    ctx.fillStyle = h > 0.55 ? r.c2 : r.c;
    ctx.fillRect(x, y, TILE, TILE);
    const flow = (state.time * 16 + h * 40) % TILE;
    ctx.fillStyle = "rgba(167,226,238,0.16)";
    ctx.fillRect(x + 2 + (flow % 3), y + 2 + (flow % 5), TILE - 4, 1);
    ctx.fillRect(x + 1 + ((flow + 4) % 4), y + TILE - 4, TILE - 3, 1);
  }

  function drawTreeTop(x, y, h, r) {
    const cx = x + TILE / 2, cy = y + TILE * 0.46;
    ctx.fillStyle = "rgba(4,7,6,0.22)";
    ctx.beginPath(); ctx.ellipse(cx, y + TILE * 0.92, TILE * 0.42, TILE * 0.16, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = palette.bark;
    ctx.fillRect(cx - TILE * 0.1, cy, TILE * 0.2, TILE * 0.5);
    ctx.fillStyle = r.c;
    ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.56, 0, TAU); ctx.fill();
    ctx.fillStyle = r.c2;
    ctx.beginPath(); ctx.arc(cx - TILE * 0.12, cy - TILE * 0.12, TILE * 0.42, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath(); ctx.arc(cx - TILE * 0.18, cy - TILE * 0.2, TILE * 0.16, 0, TAU); ctx.fill();
    if (r.snow) { ctx.fillStyle = "rgba(255,255,255,0.82)"; ctx.beginPath(); ctx.arc(cx + TILE * 0.05, cy - TILE * 0.16, TILE * 0.3, 0, TAU); ctx.fill(); }
  }

  function drawBushTop(x, y, h, r) {
    const cx = x + TILE * 0.5, cy = y + TILE * 0.58;
    ctx.fillStyle = "rgba(4,7,6,0.18)";
    ctx.beginPath(); ctx.ellipse(cx, y + TILE * 0.9, TILE * 0.36, TILE * 0.12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = r.c;
    ctx.beginPath(); ctx.arc(cx - TILE * 0.18, cy, TILE * 0.3, 0, TAU);
    ctx.arc(cx + TILE * 0.18, cy, TILE * 0.3, 0, TAU);
    ctx.arc(cx, cy - TILE * 0.14, TILE * 0.32, 0, TAU); ctx.fill();
    ctx.fillStyle = r.c2;
    ctx.beginPath(); ctx.arc(cx - TILE * 0.1, cy - TILE * 0.12, TILE * 0.18, 0, TAU); ctx.fill();
    if (r.berry || h > 0.7) { ctx.fillStyle = palette.flower; ctx.fillRect(cx + TILE * 0.1, cy, 2, 2); }
  }

  function drawServerFloor(view) {
    const layer = state.layersByName.get("Techno_serwer_room");
    if (!layer) return;
    for (const t of layer.tiles) {
      const x = t.x * TILE, y = t.y * TILE;
      if (!inView(x, y, view)) continue;
      const k = key(t.x, t.y), h = hash(t.x, t.y);
      const room = state.rooms.find((rm) => rm.tiles.has(k));
      let color = "#23303a";
      if (room) color = room.destroyed ? "#2c4a30" : (room.powered ? "#14303c" : "#283142");
      ctx.fillStyle = color; ctx.fillRect(x, y, TILE, TILE);
      // podloga podniesiona z perforacja (wnetrze data center)
      ctx.strokeStyle = "rgba(105,215,255,0.08)"; ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      if (!(room && room.destroyed)) {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(x + TILE * 0.28, y + TILE * 0.28, 1.5, 1.5);
        ctx.fillRect(x + TILE * 0.62, y + TILE * 0.28, 1.5, 1.5);
        ctx.fillRect(x + TILE * 0.28, y + TILE * 0.62, 1.5, 1.5);
        ctx.fillRect(x + TILE * 0.62, y + TILE * 0.62, 1.5, 1.5);
      }

      if (room && room.destroyed) {
        if (h > 0.7) { ctx.fillStyle = palette.leafLight; ctx.fillRect(x + TILE * 0.45, y + TILE * 0.4, 1.5, 3); }
        continue;
      }
      // szafy serwerowe rozsiane po sali
      if (room && h > 0.8) {
        ctx.fillStyle = "#10171c"; ctx.fillRect(x + 2, y + 1, TILE - 4, TILE - 2);
        ctx.fillStyle = "#222b30"; ctx.fillRect(x + 3, y + 2, TILE - 6, TILE - 4);
        const led = room.powered ? (h > 0.9 ? palette.aiPink : palette.aiBlue) : "#37463a";
        ctx.fillStyle = led; ctx.globalAlpha = room.powered ? (0.4 + 0.4 * Math.sin(state.time * 6 + t.x + t.y)) : 0.5;
        for (let yy = y + 4; yy < y + TILE - 3; yy += 3) { ctx.fillRect(x + 4, yy, 2, 1.5); ctx.fillRect(x + TILE - 7, yy, 3, 1.5); }
        ctx.globalAlpha = 1;
      } else if (room && room.powered && h > 0.5) {
        ctx.fillStyle = "rgba(85,215,255," + (0.10 + 0.08 * Math.sin(state.time * 4 + room.id)) + ")";
        ctx.fillRect(x + 3, y + 3, TILE - 6, 2);
      }
    }
  }

  function drawDestructibles(view, world) {
    for (const d of state.destructibles.values()) {
      if (d.destroyed || d.role.world !== world) continue;
      const x = d.x * TILE, y = d.y * TILE;
      if (!inView(x, y, view)) continue;
      const r = d.role;
      if (d.cable) { drawCableTile(x, y, d); continue; }
      const h = hash(d.x, d.y);
      if (r.tree) { drawTreeTop(x, y, h, r); }
      else if (r.bush) { drawBushTop(x, y, h, r); ctx.fillStyle = palette.flower; ctx.fillRect(x + TILE * 0.6, y + TILE * 0.5, 2, 2); }
      else if (d.electric) {
        const powered = d.room && d.room.powered;
        ctx.fillStyle = "#1b232a"; ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = powered ? r.c : "#6a4a2f"; ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
        ctx.fillStyle = powered ? "rgba(85,215,255," + (0.4 + 0.4 * Math.sin(state.time * 8 + d.pulse)) + ")" : "rgba(150,150,150,0.35)";
        for (let yy = y + 3; yy < y + TILE - 2; yy += 3) ctx.fillRect(x + 2, yy, TILE - 4, 1.4);
        if (powered) { ctx.strokeStyle = "rgba(120,220,255,0.8)"; ctx.beginPath(); ctx.moveTo(x + 3, y + 2); ctx.lineTo(x + TILE - 4, y + TILE - 3); ctx.stroke(); }
      } else {
        // drzwi drewniane
        ctx.fillStyle = "#5a3f25"; ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = h > 0.5 ? r.c2 : r.c; ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
        ctx.fillStyle = "#3a2818"; ctx.fillRect(x + TILE * 0.5, y + 1, 1.4, TILE - 2);
        ctx.fillStyle = "#caa15b"; ctx.fillRect(x + TILE * 0.7, y + TILE * 0.5, 1.6, 1.6);
      }
      // peknieciec
      if (d.hp < d.maxHp && !r.tree && !r.bush) {
        ctx.strokeStyle = "rgba(20,20,20,0.5)";
        ctx.beginPath(); ctx.moveTo(x + 3, y + TILE - 3); ctx.lineTo(x + TILE - 3, y + 4); ctx.stroke();
      }
    }
  }

  function drawCableTile(x, y, d) {
    ctx.strokeStyle = "#1a1410";
    ctx.lineWidth = TILE * 0.5;
    ctx.beginPath(); ctx.moveTo(x, y + TILE / 2); ctx.lineTo(x + TILE, y + TILE / 2); ctx.stroke();
    ctx.lineWidth = TILE * 0.22;
    ctx.strokeStyle = "#6bdcff";
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(state.time * 6 + d.pulse);
    ctx.beginPath(); ctx.moveTo(x, y + TILE / 2); ctx.lineTo(x + TILE, y + TILE / 2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }

  function drawFire(view) {
    const layer = state.layersByName.get("Fire");
    if (!layer) return;
    for (const t of layer.tiles) {
      const x = t.x * TILE, y = t.y * TILE;
      if (!inView(x, y, view)) continue;
      const f = Math.sin(state.time * 9 + (t.x + t.y)) * 0.5 + 0.5;
      ctx.fillStyle = "#7a1f08";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = f > 0.4 ? "#ff7a2a" : "#ff5a1a";
      ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE * 0.6, TILE * (0.28 + 0.08 * f), 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,210,90," + (0.5 + 0.4 * f) + ")";
      ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE * 0.5, TILE * 0.15, 0, TAU); ctx.fill();
    }
  }

  function drawFlowers(view) {
    for (const fl of state.flowers) {
      if (fl.taken || fl.world !== state.area) continue;
      const x = fl.x * TILE, y = fl.y * TILE;
      if (!inView(x, y, view)) continue;
      const cx = x + TILE / 2;
      if (fl.lily) {
        // lilia wodna: plaski lisc + kwiat (z gory)
        ctx.fillStyle = "#2f7d4a";
        ctx.beginPath(); ctx.ellipse(cx, y + TILE * 0.55, TILE * 0.4, TILE * 0.32, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = "#0d3a26";
        ctx.beginPath(); ctx.moveTo(cx, y + TILE * 0.55); ctx.lineTo(cx + TILE * 0.34, y + TILE * 0.5); ctx.stroke();
        ctx.fillStyle = fl.color;
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * 2.2, y + TILE * 0.5 + Math.sin(a) * 1.8, 2, 1.2, a, 0, TAU); ctx.fill(); }
        ctx.fillStyle = "#fff3b0"; ctx.beginPath(); ctx.arc(cx, y + TILE * 0.5, 1.4, 0, TAU); ctx.fill();
        continue;
      }
      const bob = Math.sin(state.time * 2 + fl.pulse) * 1.0;
      ctx.strokeStyle = "#3f8f5a"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, y + TILE * 0.85); ctx.lineTo(cx, y + TILE * 0.45 + bob); ctx.stroke();
      ctx.fillStyle = "#3f8f5a"; ctx.fillRect(cx + 0.5, y + TILE * 0.6 + bob, 2, 1.5);
      const cy = y + TILE * 0.4 + bob;
      ctx.fillStyle = fl.color;
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 2.3, cy + Math.sin(a) * 2.3, 1.5, 0, TAU); ctx.fill(); }
      ctx.fillStyle = "#fff3b0"; ctx.beginPath(); ctx.arc(cx, cy, 1.4, 0, TAU); ctx.fill();
    }
  }

  function drawIntel(view) {
    for (const it of state.intel) {
      if (it.taken || it.world !== state.area) continue;
      const x = it.x * TILE, y = it.y * TILE;
      if (!inView(x, y, view)) continue;
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 4 + it.pulse);
      ctx.fillStyle = it.color || "#9fe7ff";
      ctx.globalAlpha = 0.5 + 0.4 * pulse;
      ctx.fillRect(x + TILE * 0.3, y + TILE * 0.3, TILE * 0.4, TILE * 0.4);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.strokeRect(x + TILE * 0.3, y + TILE * 0.3, TILE * 0.4, TILE * 0.4);
    }
  }

  function drawChests(view) {
    for (const c of state.chests) {
      const x = c.x * TILE, y = c.y * TILE;
      if (!inView(x, y, view)) continue;
      ctx.fillStyle = c.opened ? "#5a4427" : "#9a6f30";
      ctx.fillRect(x + 1, y + 2, TILE - 2, TILE - 3);
      ctx.fillStyle = c.opened ? "#3a2c18" : "#b5832f";
      ctx.fillRect(x + 1, y + 2, TILE - 2, TILE * 0.35);
      if (!c.opened) { ctx.fillStyle = "#ffd66d"; ctx.fillRect(x + TILE / 2 - 1, y + TILE * 0.45, 2, 2); }
    }
  }

  // Chatka z lotu ptaka: widac dach od gory z kalenica i kominem.
  function drawCottages(view) {
    for (const c of state.cottages) {
      const b = c.box;
      const x0 = b.minX * TILE, y0 = b.minY * TILE;
      const w = (b.maxX - b.minX + 1) * TILE, h = (b.maxY - b.minY + 1) * TILE;
      if (x0 + w < view.x0 || x0 > view.x1 || y0 + h < view.y0 || y0 > view.y1) continue;
      shadow(x0 + w / 2, y0 + h * 0.5, w * 0.55, h * 0.45);
      // dach widziany z gory (dwie polacie z kalenica posrodku)
      ctx.fillStyle = "#7a4a30";
      ctx.fillRect(x0, y0, w, h * 0.5);
      ctx.fillStyle = "#8a5638";
      ctx.fillRect(x0, y0 + h * 0.5, w, h * 0.5);
      // gont (linie)
      ctx.strokeStyle = "rgba(40,24,14,0.4)"; ctx.lineWidth = 1;
      for (let yy = y0 + 3; yy < y0 + h; yy += 3) { ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + w, yy); ctx.stroke(); }
      // kalenica
      ctx.fillStyle = "#5e3722"; ctx.fillRect(x0, y0 + h * 0.5 - 1.5, w, 3);
      // okap (ciemniejsza ramka)
      ctx.strokeStyle = "#3b2a1c"; ctx.lineWidth = 2; ctx.strokeRect(x0 + 1, y0 + 1, w - 2, h - 2);
      // komin
      ctx.fillStyle = "#4a3424"; ctx.fillRect(x0 + w * 0.7, y0 + h * 0.18, TILE * 0.7, TILE * 0.7);
      ctx.fillStyle = "rgba(180,180,180,0.25)"; ctx.beginPath(); ctx.arc(x0 + w * 0.7 + TILE * 0.35, y0 + h * 0.18 - 3, 3 + Math.sin(state.time * 2) * 1, 0, TAU); ctx.fill();
      // okno dachowe (świetlik)
      ctx.fillStyle = c.used ? "#3a4a3a" : "#bfe0ff"; ctx.fillRect(x0 + w * 0.28, y0 + h * 0.3, TILE * 0.8, TILE * 0.8);
      ctx.strokeStyle = "#2b1f18"; ctx.strokeRect(x0 + w * 0.28, y0 + h * 0.3, TILE * 0.8, TILE * 0.8);
      // ganek/drzwi u dolu (wejscie)
      const dx = c.doorX * TILE;
      ctx.fillStyle = "#2b1d12"; ctx.fillRect(dx + 2, y0 + h - TILE * 0.6, TILE - 4, TILE * 0.6);
      if (dist(state.player.x, state.player.y, c.cx, c.cy) < TILE * 3) worldHint(c.cx, y0 - TILE * 0.8, "E");
    }
  }

  function drawShipwreck(view) {
    const layer = state.layersByName.get("Deep_water_shipwreck");
    if (!layer) return;
    for (const t of layer.tiles) {
      const x = t.x * TILE, y = t.y * TILE;
      if (!inView(x, y, view)) continue;
      const h = hash(t.x, t.y);
      ctx.fillStyle = h > 0.5 ? "#6b4a32" : "#553a28";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = "rgba(30,20,12,0.6)";
      ctx.beginPath(); ctx.moveTo(x, y + TILE / 2); ctx.lineTo(x + TILE, y + TILE / 2); ctx.stroke();
    }
  }

  function drawPortals(list, view, color) {
    for (const portal of list) {
      const x = portal.x * TILE, y = portal.y * TILE;
      if (!inView(x, y, view)) continue;
      ctx.fillStyle = "#0a0806";
      ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE / 2, TILE * 0.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE / 2, TILE * 0.42 + Math.sin(state.time * 3) * 1, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  // Rdzen AI jako szafa obliczeniowa z migajacymi diodami i obwodka napiecia.
  function drawServerCores() {
    for (const room of state.rooms) {
      if (room.destroyed) continue;
      const c = room.core, lit = room.powered;
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 3 + room.id);
      const x = c.x - c.r, y = c.y - c.r, w = c.r * 2;
      ctx.fillStyle = c.hp / c.maxHp > 0.35 ? "#2c3137" : "#46343b";
      ctx.fillRect(x, y, w, w);
      ctx.fillStyle = "#0b1014";
      ctx.fillRect(x + w * 0.16, y + w * 0.16, w * 0.68, w * 0.2);
      ctx.fillRect(x + w * 0.16, y + w * 0.55, w * 0.68, w * 0.2);
      const accent = lit ? palette.aiBlue : palette.leafLight;
      ctx.fillStyle = accent; ctx.globalAlpha = 0.45 + pulse * 0.4;
      for (let i = 0; i < 6; i++) { ctx.fillRect(x + w * 0.2 + i * w * 0.1, y + w * 0.2, w * 0.05, w * 0.12); ctx.fillRect(x + w * 0.2 + i * w * 0.1, y + w * 0.58, w * 0.05, w * 0.12); }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = lit ? "rgba(228,84,154," + (0.45 + pulse * 0.35) + ")" : "rgba(126,203,119,0.7)";
      ctx.lineWidth = 2.5; ctx.strokeRect(x + 1, y + 1, w - 2, w - 2); ctx.lineWidth = 1;
      if (!lit) {
        ctx.fillStyle = "rgba(126,203,119,0.85)"; ctx.font = "900 " + Math.round(TILE * 0.6) + "px Inter, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("OFF", c.x, c.y);
      }
      if (c.hp < c.maxHp) {
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x, y - 6, w, 3);
        ctx.fillStyle = palette.leafLight; ctx.fillRect(x, y - 6, w * Math.max(0, c.hp / c.maxHp), 3);
      }
    }
  }

  function drawBoss() {
    const b = state.boss;
    if (!b) return;
    if (b.defeated) {
      drawRestoredTree(b.x, b.y);
      return;
    }
    const pulse = 0.5 + 0.5 * Math.sin(b.pulse);
    const vuln = state.roomsDestroyed >= state.roomsTotal;
    // aura korupcji
    ctx.fillStyle = "rgba(126,103,255," + (0.1 + pulse * 0.12) + ")";
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.5, 0, TAU); ctx.fill();
    // korpus serwera-bossa
    ctx.fillStyle = "#1a1326"; ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    ctx.fillStyle = "rgba(232,95,166," + (0.35 + pulse * 0.3) + ")";
    ctx.fillRect(b.x - b.r * 0.8, b.y - b.r * 0.8, b.r * 1.6, b.r * 1.6);
    // "twarz" AI
    ctx.fillStyle = "#0b1014"; ctx.fillRect(b.x - b.r * 0.6, b.y - b.r * 0.4, b.r * 1.2, b.r * 0.5);
    ctx.fillStyle = vuln ? "#ff5a8c" : palette.aiViolet;
    ctx.fillRect(b.x - b.r * 0.4, b.y - b.r * 0.32, b.r * 0.25, b.r * 0.25);
    ctx.fillRect(b.x + b.r * 0.18, b.y - b.r * 0.32, b.r * 0.25, b.r * 0.25);
    // diody / racki bossa
    ctx.fillStyle = palette.aiBlue; ctx.globalAlpha = 0.4 + pulse * 0.4;
    for (let i = 0; i < 5; i++) ctx.fillRect(b.x - b.r * 0.7 + i * b.r * 0.3, b.y + b.r * 0.3, b.r * 0.12, b.r * 0.3);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = vuln ? "rgba(255,90,140,0.9)" : "rgba(126,103,255,0.6)";
    ctx.lineWidth = 3; ctx.strokeRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2); ctx.lineWidth = 1;
  }

  function drawRestoredTree(x, y) {
    ctx.fillStyle = palette.bark; ctx.fillRect(x - 4, y, 8, 24);
    ctx.fillStyle = palette.leaf; ctx.beginPath(); ctx.arc(x, y - 6, 26, 0, TAU); ctx.fill();
    ctx.fillStyle = palette.leafLight; ctx.beginPath(); ctx.arc(x - 8, y - 12, 16, 0, TAU); ctx.fill();
  }

  function drawActors(view) {
    for (const a of state.actors) {
      if (a.dead || a.follower || a.world !== state.area) continue;
      const x = a.x, y = a.y;
      if (!inView(x - TILE, y - TILE, view)) continue;
      drawActorSprite(a);
    }
  }

  // Wszystkie sprite'y mieszcza sie w jednym kafelku (R <= ~pol kafelka).
  function drawActorSprite(a) {
    const r = a.role;
    const flash = a.hitFlash > 0;
    const R = SPRITE; // maks. promien <= pol kafelka

    // DELFIN - widoczny tylko podczas wyskoku (luk nad woda)
    if (a.kind === "dolphin") {
      if (!a.jumping) { // tylko delikatna zmarszczka na wodzie
        ctx.strokeStyle = "rgba(120,210,255,0.4)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(a.x, a.y, TILE * 0.3 + Math.sin(state.time * 4 + a.phase) * 1.5, 0, TAU); ctx.stroke();
        return;
      }
      const arc = Math.sin((a.jumpT / a.jumpDur) * Math.PI) * TILE * 0.6;
      const dir = Math.cos(a.dir) < 0 ? -1 : 1;
      ctx.save(); ctx.translate(a.x, a.y - arc); ctx.scale(dir, 1);
      ctx.fillStyle = flash ? palette.cream : r.c;
      ctx.beginPath(); ctx.ellipse(0, 0, R * 0.9, R * 0.45, -0.5 * dir, 0, TAU); ctx.fill();
      ctx.fillStyle = r.c2; ctx.beginPath(); ctx.moveTo(-R * 0.8, 0); ctx.lineTo(-R, -R * 0.4); ctx.lineTo(-R, R * 0.4); ctx.fill();
      ctx.fillStyle = "#0b1014"; ctx.fillRect(R * 0.45, -R * 0.1, 2, 2);
      ctx.restore();
      ctx.fillStyle = "rgba(120,210,255,0.4)"; ctx.beginPath(); ctx.arc(a.x, a.y, 3, 0, TAU); ctx.fill();
      return;
    }
    // REKIN - widac tylko pletwe + ciemny zarys pod woda
    if (a.kind === "shark") {
      const dir = Math.cos(a.dir) < 0 ? -1 : 1;
      ctx.fillStyle = "rgba(10,25,30,0.4)"; // sylwetka pod woda
      ctx.beginPath(); ctx.ellipse(a.x, a.y, R * 0.9, R * 0.45, a.dir, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(a.x, a.y); ctx.scale(dir, 1);
      ctx.fillStyle = flash ? palette.cream : "#3a4a52"; // pletwa grzbietowa
      ctx.beginPath(); ctx.moveTo(-R * 0.4, R * 0.1); ctx.lineTo(0, -R * 0.7); ctx.lineTo(R * 0.4, R * 0.1); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(180,220,230,0.3)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(a.x, a.y, R * 0.7, 0, TAU); ctx.stroke();
      drawHpBar(a, R);
      return;
    }
    // RYBA GLEBINOWA
    if (a.kind === "deepfish") {
      const dir = Math.cos(a.dir) < 0 ? -1 : 1;
      ctx.save(); ctx.translate(a.x, a.y + Math.sin(a.phase) * 1.5); ctx.scale(dir, 1);
      ctx.fillStyle = flash ? palette.cream : r.c;
      ctx.beginPath(); ctx.ellipse(0, 0, R * 0.8, R * 0.55, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = r.c2; ctx.beginPath(); ctx.moveTo(-R * 0.7, 0); ctx.lineTo(-R, -R * 0.4); ctx.lineTo(-R, R * 0.4); ctx.fill();
      ctx.fillStyle = "#bfe9f5"; ctx.beginPath(); ctx.arc(R * 0.35, -R * 0.1, 1.6, 0, TAU); ctx.fill(); // duze oko
      ctx.fillStyle = "#0b1014"; ctx.fillRect(R * 0.35, -R * 0.1, 1, 1);
      ctx.strokeStyle = "#cdeeff"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(R * 0.5, -R * 0.4); ctx.lineTo(R * 0.7, -R * 0.7); ctx.stroke(); // wabik
      ctx.fillStyle = "#cdeeff"; ctx.beginPath(); ctx.arc(R * 0.7, -R * 0.7, 1.4, 0, TAU); ctx.fill();
      ctx.restore();
      drawHpBar(a, R);
      return;
    }

    const bob = Math.sin(a.phase) * (r.drone ? 2.5 : 1);
    shadow(a.x, a.y + R * 0.7, R * 0.9, R * 0.28);
    ctx.save();
    ctx.translate(a.x, a.y + bob);

    if (r.drone) {
      ctx.fillStyle = palette.aiBlue;
      ctx.fillRect(-R, -1.5, R * 2, 3); ctx.fillRect(-1.5, -R, 3, R * 2); // wirniki w obrebie kafelka
      ctx.fillStyle = flash ? palette.cream : "#30424a";
      ctx.beginPath(); ctx.arc(0, 0, R * 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = a.aggro ? palette.aiPink : palette.aiBlue; ctx.fillRect(-2, -2, 4, 4);
      ctx.fillStyle = "rgba(245,238,209,0.6)";
      for (const [ex, ey] of [[-R, 0], [R, 0], [0, -R], [0, R]]) { ctx.fillRect(ex - 2, ey - 2, 4, 4); }
    } else if (r.robot) {
      ctx.fillStyle = flash ? palette.cream : r.c;
      ctx.fillRect(-R * 0.78, -R * 0.78, R * 1.56, R * 1.56);
      ctx.fillStyle = "#171e22"; ctx.fillRect(-R * 0.5, -R * 0.35, R, R * 0.45); // wizjer
      ctx.fillStyle = a.aggro ? palette.aiPink : palette.aiBlue;
      ctx.fillRect(-R * 0.36, -R * 0.22, 3, 3); ctx.fillRect(R * 0.12, -R * 0.22, 3, 3);
      ctx.fillStyle = palette.aiPink; ctx.fillRect(-R * 0.6, R * 0.62, 4, R * 0.3); ctx.fillRect(R * 0.3, R * 0.62, 4, R * 0.3);
      ctx.strokeStyle = "#9aa3a8"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -R * 0.78); ctx.lineTo(0, -R); ctx.stroke();
      ctx.fillStyle = palette.aiPink; ctx.beginPath(); ctx.arc(0, -R, 1.6, 0, TAU); ctx.fill();
    } else if (a.world === "underground") {
      // GASIENICA (podziemne zwierzeta)
      const col = a.kind === "friend" ? "#9ecf8f" : "#b06a8f";
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i === 0 ? "#cfe6c2" : col;
        ctx.beginPath(); ctx.arc(-R * 0.6 + i * R * 0.42, Math.sin(state.time * 6 + i) * 1.5, R * 0.3, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = "#1d1714"; ctx.fillRect(R * 0.5, -1.5, 1.5, 1.5);
    } else {
      // KOTEK / PIESEK (zwierzeta na powierzchni)
      const dog = hash(Math.floor(a.ox), Math.floor(a.oy)) > 0.5;
      const dir = (a.aggro ? (state.player.x < a.x) : Math.sin(a.phase) < 0) ? -1 : 1; ctx.scale(dir, 1);
      const body = a.kind === "friend" ? (dog ? "#caa15b" : "#b8743a") : (flash ? palette.cream : r.c);
      const dark = a.kind === "friend" ? "#8a6a3a" : "#566164";
      ctx.fillStyle = dark; // ogon
      if (dog) ctx.fillRect(-R * 0.9, -R * 0.5, R * 0.5, 3);
      else { ctx.beginPath(); ctx.arc(-R * 0.7, -R * 0.2, R * 0.18, 0, TAU); ctx.fill(); }
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(-R * 0.1, R * 0.05, R * 0.55, R * 0.4, 0, 0, TAU); ctx.fill(); // tulow
      ctx.beginPath(); ctx.arc(R * 0.5, -R * 0.2, R * 0.34, 0, TAU); ctx.fill(); // glowa
      ctx.fillStyle = dark; // uszy
      if (dog) { ctx.beginPath(); ctx.ellipse(R * 0.4, -R * 0.45, 3, 5, 0.3, 0, TAU); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(R * 0.35, -R * 0.5); ctx.lineTo(R * 0.45, -R * 0.85); ctx.lineTo(R * 0.55, -R * 0.5); ctx.fill();
             ctx.beginPath(); ctx.moveTo(R * 0.6, -R * 0.5); ctx.lineTo(R * 0.7, -R * 0.85); ctx.lineTo(R * 0.8, -R * 0.5); ctx.fill(); }
      ctx.fillStyle = a.kind === "friend" ? "#203b2c" : palette.aiBlue; ctx.fillRect(R * 0.6, -R * 0.25, 2.5, 2.5);
      if (a.kind !== "friend") { ctx.fillStyle = "rgba(105,215,255,0.5)"; ctx.fillRect(R * 0.3, -R * 0.45, R * 0.4, 2); }
      if (a.kind === "friend") { ctx.fillStyle = "#7ed957"; ctx.fillRect(-1, -R * 0.9, 2, 2); }
    }
    ctx.restore();
    drawHpBar(a, R);
  }

  function drawHpBar(a, R) {
    if (a.hostile && a.hp < a.maxHp) {
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(a.x - R, a.y - R - 5, R * 2, 2);
      ctx.fillStyle = "#ff7a7a"; ctx.fillRect(a.x - R, a.y - R - 5, R * 2 * Math.max(0, a.hp / a.maxHp), 2);
    }
  }

  function drawNpcs(view, world) {
    for (const n of state.npcs) {
      if (n.world !== world) continue;
      const x = n.x, y = n.y;
      if (!inView(x - TILE, y - TILE, view)) continue;
      const R = SPRITE;
      shadow(x, y + R * 0.7, R * 0.85, R * 0.25);
      ctx.save(); ctx.translate(x, y + Math.sin(state.time * 1.5 + n.phase) * 1);
      if (n.mole) {
        // KRET: ciemne futro, rozowy nos, lopatki
        ctx.fillStyle = "#5a4636"; ctx.beginPath(); ctx.arc(0, 0, R * 0.55, 0, TAU); ctx.fill();
        ctx.fillStyle = "#6b5240"; ctx.beginPath(); ctx.arc(R * 0.3, -R * 0.1, R * 0.32, 0, TAU); ctx.fill();
        ctx.fillStyle = "#ffb0b0"; ctx.beginPath(); ctx.arc(R * 0.55, 0, R * 0.14, 0, TAU); ctx.fill(); // nos
        ctx.fillStyle = "#d8c8a0"; ctx.fillRect(-R * 0.5, R * 0.2, R * 0.35, R * 0.25); ctx.fillRect(R * 0.1, R * 0.3, R * 0.35, R * 0.25); // lopatki
        ctx.fillStyle = "#1d1714"; ctx.fillRect(R * 0.2, -R * 0.15, 1.5, 1.5);
      } else {
        // BOBR (NPC): jak gracz, ale spokojny
        ctx.fillStyle = palette.beaverDark; ctx.beginPath(); ctx.ellipse(-R * 0.5, 0, R * 0.25, R * 0.18, 0, 0, TAU); ctx.fill(); // ogon
        ctx.fillStyle = palette.beaver; ctx.beginPath(); ctx.arc(0, 0, R * 0.4, 0, TAU); ctx.fill();
        ctx.fillStyle = "#9a673d"; ctx.beginPath(); ctx.arc(R * 0.3, -R * 0.12, R * 0.26, 0, TAU); ctx.fill();
        ctx.fillStyle = palette.beaverDark; ctx.beginPath(); ctx.arc(R * 0.2, -R * 0.34, R * 0.08, 0, TAU); ctx.arc(R * 0.42, -R * 0.34, R * 0.08, 0, TAU); ctx.fill();
        ctx.fillStyle = "#1d1714"; ctx.fillRect(R * 0.32, -R * 0.16, 1.5, 1.5);
        ctx.fillStyle = palette.cream; ctx.fillRect(R * 0.42, -R * 0.02, 2.5, 2.5);
      }
      ctx.fillStyle = "#fff3b0"; ctx.font = "700 " + Math.round(TILE * 0.5) + "px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("?", 0, -R - 2);
      ctx.restore();
    }
  }

  function drawFollowers() {
    for (const f of state.followers) {
      ctx.save(); ctx.translate(f.x, f.y + Math.sin(f.phase) * 1.5);
      ctx.fillStyle = f.role.c; ctx.beginPath(); ctx.arc(0, 0, f.r * 0.9, 0, TAU); ctx.fill();
      ctx.fillStyle = "#7ed957"; ctx.fillRect(-1, -f.r - 3, 2, 2);
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life * 2);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  // Bober przeniesiony stylem z game_old.js: cialo, glowa z okiem i policzkiem,
  // segmentowy falujacy ogon, polzanurzenie w wodzie, aura tarczy/ducha.
  // Bobr z gory, kompaktowy (mieści się w jednym kafelku).
  function drawPlayer() {
    const p = state.player;
    const hurt = p.hurtCd > 0 && Math.floor(state.time * 18) % 2 === 0;
    const fc = Math.cos(p.facing), fs = Math.sin(p.facing);
    if (!p.swimming) shadow(p.x, p.y + TILE * 0.34, TILE * 0.4, TILE * 0.14);

    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.ghost) ctx.globalAlpha = 0.62;

    // ogon (plaski, za bobrem) - lekko macha
    const tw = Math.sin(state.time * 6) * 0.12;
    ctx.save(); ctx.rotate(Math.atan2(fs, fc) + Math.PI + tw);
    ctx.fillStyle = palette.beaverDark;
    ctx.beginPath(); ctx.ellipse(TILE * 0.34, 0, TILE * 0.2, TILE * 0.14, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(245,238,209,0.12)"; ctx.fillRect(TILE * 0.24, -1, TILE * 0.18, 1);
    ctx.restore();

    if (p.ghost) { ctx.strokeStyle = "rgba(145,230,255,0.9)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, TILE * 0.5 + Math.sin(state.time * 5), 0, TAU); ctx.stroke(); }
    if (p.shield > 0) { ctx.strokeStyle = "rgba(78,208,109," + (0.4 + Math.sin(state.time * 4) * 0.15) + ")"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, TILE * 0.5, 0, TAU); ctx.stroke(); }

    // cialo
    ctx.fillStyle = hurt ? palette.cream : palette.beaver;
    ctx.beginPath(); ctx.arc(0, 0, TILE * 0.36, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.beginPath(); ctx.arc(TILE * 0.08, TILE * 0.1, TILE * 0.22, 0, TAU); ctx.fill();

    // glowa w kierunku ruchu
    const hx = fc * TILE * 0.28, hy = fs * TILE * 0.28;
    ctx.fillStyle = hurt ? palette.cream : "#9a673d";
    ctx.beginPath(); ctx.arc(hx, hy, TILE * 0.22, 0, TAU); ctx.fill();
    // uszy
    ctx.fillStyle = palette.beaverDark;
    ctx.beginPath(); ctx.arc(hx - fs * TILE * 0.16, hy + fc * TILE * 0.16, TILE * 0.07, 0, TAU); ctx.arc(hx + fs * TILE * 0.16, hy - fc * TILE * 0.16, TILE * 0.07, 0, TAU); ctx.fill();
    // oczy + zeby
    ctx.fillStyle = "#1d1714";
    ctx.fillRect(hx + fc * 1.5 - fs * 2 - 1, hy + fs * 1.5 + fc * 2 - 1, 2, 2);
    ctx.fillRect(hx + fc * 1.5 + fs * 2 - 1, hy + fs * 1.5 - fc * 2 - 1, 2, 2);
    ctx.fillStyle = p.goldTeeth ? "#ffd66d" : palette.cream;
    ctx.fillRect(hx + fc * TILE * 0.18 - 1.5, hy + fs * TILE * 0.18 - 1.5, 3, 3);

    if (p.swimming) {
      ctx.fillStyle = "rgba(105,215,255,0.4)";
      ctx.beginPath(); ctx.ellipse(0, 0, TILE * 0.5, TILE * 0.2, 0, 0, TAU); ctx.stroke();
    }
    if (p.biteCd > 0.3) {
      ctx.strokeStyle = "rgba(245,238,209,0.8)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(fc * TILE * 0.5, fs * TILE * 0.5, TILE * 0.18, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  function drawFloatText() {
    ctx.save();
    ctx.font = "700 7px Inter, sans-serif";
    ctx.textAlign = "center";
    for (const f of state.floatText) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawUndergroundFog() {
    const size = screenSize();
    const p = state.player;
    const vp = viewport(size);
    // wszystko w wspolrzednych swiata (jestesmy w transformacie kamery)
    const grad = ctx.createRadialGradient(p.x, p.y, TILE * 3, p.x, p.y, TILE * 11);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(5,4,3,0.82)");
    ctx.fillStyle = grad;
    ctx.fillRect(state.camera.x, state.camera.y, vp.w, vp.h);
  }

  function drawUnderwaterTint() {
    const size = screenSize();
    const vp = viewport(size);
    const p = state.player;
    ctx.fillStyle = "rgba(10,40,70,0.25)";
    ctx.fillRect(state.camera.x, state.camera.y, vp.w, vp.h);
    const grad = ctx.createRadialGradient(p.x, p.y, TILE * 4, p.x, p.y, TILE * 13);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(2,10,20,0.7)");
    ctx.fillStyle = grad;
    ctx.fillRect(state.camera.x, state.camera.y, vp.w, vp.h);
  }

  // -----------------------------------------------------------------------
  // HUD
  // -----------------------------------------------------------------------
  function drawHud(size) {
    const p = state.player;
    ctx.save();
    ctx.font = "700 12px Inter, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    panel(14, 14, 300, 70);
    ctx.fillStyle = "#f5eed1";
    ctx.fillText("HP", 26, 32);
    for (let i = 0; i < p.maxHp; i++) {
      ctx.fillStyle = i < Math.ceil(p.hp) ? "#f15b5b" : "rgba(245,238,209,0.2)";
      ctx.fillRect(50 + i * 11, 27, 8, 9);
    }
    ctx.fillStyle = "#f5eed1";
    ctx.fillText("KWIATY " + p.flowers + "    DREWNO " + p.wood, 26, 52);
    let badges = [];
    if (p.longStick) badges.push("PATYK");
    if (p.goldTeeth) badges.push("ZAB");
    if (p.shield > 0) badges.push("TARCZA");
    if (p.ghost) badges.push("DUCH");
    ctx.fillStyle = "#91e6ff";
    ctx.fillText(badges.join("  "), 26, 70);

    // tryb / serwerownie
    panel(size.w / 2 - 130, 14, 260, 44);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f5eed1";
    const areaLabel = state.area === "surface" ? "POWIERZCHNIA" : state.area === "underground" ? "TUNELE" : "GLEBINA";
    ctx.fillText(areaLabel + "   SERWEROWNIE " + state.roomsDestroyed + "/" + state.roomsTotal, size.w / 2, 28);
    ctx.fillStyle = "#9fe7ff";
    ctx.font = "600 10px Inter, sans-serif";
    const cut = state.cables.filter((c) => c.cut).length;
    ctx.fillText("KABLE PRZEGRYZIONE " + cut + "/" + state.cables.length, size.w / 2, 44);
    ctx.font = "700 12px Inter, sans-serif";

    // minimapa
    panel(size.w - 196, 14, 182, 74);
    drawMiniMap(size.w - 188, 24, 166, 54);

    // boss bar
    const b = state.boss;
    if (b && !b.defeated && state.area === "surface" && dist(p.x, p.y, b.x, b.y) < TILE * 40) {
      panel(size.w / 2 - 120, size.h - 44, 240, 30);
      ctx.fillStyle = "#f5eed1"; ctx.textAlign = "left";
      ctx.fillText("BOSS AI", size.w / 2 - 108, size.h - 29);
      meter(size.w / 2 - 50, size.h - 34, 156, 9, b.hp / b.maxHp, "#e85fa6");
    }

    // podpowiedz nurkowania
    if (state.area === "surface" && !p.ghost && pointInRegion(p.x, p.y, state.deepWater)) {
      hint(size, "F - ZANURKUJ");
    } else if (state.area === "underwater") {
      hint(size, "F - WYNURZ SIE");
    } else if (state.area === "surface" && nearestPortal(state.portalsSurface)) {
      hint(size, "E - ZEJDZ DO TUNELI");
    } else if (state.area === "underground" && nearestPortal(state.portalsUnder)) {
      hint(size, "E - WROC NA POWIERZCHNIE");
    }

    ctx.restore();
  }

  function hint(size, text) {
    ctx.save();
    ctx.font = "700 13px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const w = ctx.measureText(text).width + 36;
    panel(size.w / 2 - w / 2, size.h - 96, w, 30);
    ctx.fillStyle = "#bfff8c"; ctx.fillText(text, size.w / 2, size.h - 81);
    ctx.restore();
  }

  function drawMiniMap(x, y, w, h) {
    ctx.save();
    ctx.fillStyle = "rgba(6,9,8,0.7)"; ctx.fillRect(x, y, w, h);
    const sx = w / state.mapW, sy = h / state.mapH;
    // woda
    ctx.fillStyle = "rgba(85,170,215,0.4)";
    const water = state.layersByName.get("Water");
    if (water) for (let i = 0; i < water.tiles.length; i += 7) { const t = water.tiles[i]; ctx.fillRect(x + t.x * sx, y + t.y * sy, 1, 1); }
    ctx.fillStyle = "rgba(40,120,255,0.6)";
    const dw = state.layersByName.get("Deep_water");
    if (dw) for (const t of dw.tiles) ctx.fillRect(x + t.x * sx, y + t.y * sy, 1, 1);
    // serwerownie
    for (const room of state.rooms) {
      ctx.fillStyle = room.destroyed ? "#7ed957" : (room.powered ? "#55d7ff" : "#e85fa6");
      ctx.fillRect(x + room.cx / TILE * sx - 1, y + room.cy / TILE * sy - 1, 2, 2);
    }
    // boss
    if (state.boss && !state.boss.defeated) {
      ctx.fillStyle = "#ff5a8c";
      ctx.fillRect(x + state.boss.x / TILE * sx - 1.5, y + state.boss.y / TILE * sy - 1.5, 3, 3);
    }
    // gracz
    ctx.fillStyle = "#7ed957";
    ctx.fillRect(x + state.player.x / TILE * sx - 1.5, y + state.player.y / TILE * sy - 1.5, 3, 3);
    ctx.restore();
  }

  function drawMessage(size) {
    if (state.messageTimer <= 0) return;
    ctx.save();
    ctx.font = "800 14px Inter, system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const w = Math.min(size.w - 36, Math.max(240, ctx.measureText(state.message).width + 48));
    panel(size.w / 2 - w / 2, size.h - 64, w, 38);
    ctx.fillStyle = "#f5eed1";
    ctx.fillText(state.message, size.w / 2, size.h - 45);
    ctx.restore();
  }

  function drawDialog(size) {
    if (state.dialogTimer <= 0 || !state.dialog) return;
    ctx.save();
    const w = Math.min(560, size.w - 60);
    const lines = state.dialog.lines;
    const h = 40 + lines.length * 18;
    panel(size.w / 2 - w / 2, size.h - 64 - h - 12, w, h);
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.font = "800 13px Inter, sans-serif"; ctx.fillStyle = "#bfff8c";
    ctx.fillText(state.dialog.name, size.w / 2 - w / 2 + 16, size.h - 64 - h - 12 + 12);
    ctx.font = "500 12px Inter, sans-serif"; ctx.fillStyle = "#eef8ec";
    lines.forEach((ln, i) => ctx.fillText(ln, size.w / 2 - w / 2 + 16, size.h - 64 - h - 12 + 34 + i * 18));
    ctx.restore();
  }

  function drawInventory(size) {
    ctx.save();
    ctx.fillStyle = "rgba(6,9,8,0.85)"; ctx.fillRect(0, 0, size.w, size.h);
    const w = Math.min(520, size.w - 60);
    const x = size.w / 2 - w / 2, y = 70;
    panel(x, y, w, size.h - 140);
    ctx.fillStyle = "#f5eed1"; ctx.font = "800 18px Inter, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("EKWIPUNEK / ZEBRANE DANE", x + 20, y + 16);
    ctx.font = "500 13px Inter, sans-serif";
    if (!state.inventory.length) {
      ctx.fillStyle = "rgba(245,238,209,0.6)";
      ctx.fillText("Jeszcze nic nie zebrales. Szukaj danych AI, notatek i skrzyn.", x + 20, y + 50);
    } else {
      state.inventory.slice(0, 24).forEach((it, i) => {
        const iy = y + 50 + i * 22;
        ctx.fillStyle = it.color || "#9fe7ff"; ctx.fillRect(x + 20, iy + 2, 10, 10);
        ctx.fillStyle = "#eef8ec"; ctx.fillText(it.label, x + 38, iy);
      });
    }
    ctx.fillStyle = "rgba(245,238,209,0.6)"; ctx.font = "600 12px Inter, sans-serif";
    ctx.fillText("I / Esc - zamknij", x + 20, y + size.h - 140 - 28);
    ctx.restore();
  }

  function drawOverlay(size) {
    ctx.save();
    ctx.fillStyle = state.mode === "win" ? "rgba(20,50,30,0.55)" : "rgba(40,10,15,0.6)";
    ctx.fillRect(0, 0, size.w, size.h);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "900 30px Inter, sans-serif";
    ctx.fillStyle = state.mode === "win" ? "#bfff8c" : "#ff9a9a";
    ctx.fillText(state.mode === "win" ? "NATURA POWRACA" : "BOBR POKONANY", size.w / 2, size.h / 2 - 16);
    ctx.font = "600 15px Inter, sans-serif"; ctx.fillStyle = "#f5eed1";
    ctx.fillText("R - zagraj jeszcze raz", size.w / 2, size.h / 2 + 18);
    ctx.restore();
  }

  function drawCentered(size, text) {
    ctx.save();
    ctx.font = "800 18px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    panel(size.w / 2 - 230, size.h / 2 - 30, 460, 60);
    ctx.fillStyle = "#f5eed1"; ctx.fillText(text, size.w / 2, size.h / 2);
    ctx.restore();
  }

  function drawVignette(size) {
    const g = ctx.createRadialGradient(size.w / 2, size.h / 2, Math.min(size.w, size.h) * 0.36, size.w / 2, size.h / 2, Math.max(size.w, size.h) * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(2,5,4,0.42)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, size.w, size.h);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = "rgba(13,18,16,0.8)"; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(245,238,209,0.16)"; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function meter(x, y, w, h, amount, color) {
    ctx.fillStyle = "rgba(245,238,209,0.18)"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color; ctx.fillRect(x, y, Math.max(0, Math.min(w, w * amount)), h);
  }

  // -----------------------------------------------------------------------
  // Dialogi NPC
  // -----------------------------------------------------------------------
  const NPC_LINES = {
    Beaver_NPC: [
      ["Witaj bobrze. AI policzylo kazde drzewo i nazwalo to porzadkiem.", "Serwerownie pilnuja roboty. Rdzen pada dopiero, gdy strażnicy zgina."],
      ["Pod ziemia biegna trzy kable.", "Kazdy zasila inna, najblizsza serwerownie. Przegryz je, a tarcze padna."],
      ["W glebokiej wodzie mozna zanurkowac.", "Na dnie sa stare wraki i dane sprzed epoki maszyn."],
      ["Najpierw serwerownie, potem boss w data center na wschodzie.", "Dopoki choc jedna dziala, boss jest nietykalny."]
    ],
    Underground_NPC_mole: [
      ["Kable wisza przy stropie tuneli. Gryz je tutaj, na dole.", "Prad zniknie tylko w najblizszej serwerowni na gorze."],
      ["Pod ziemia jest ciasno - trzymaj sie tuneli.", "Poza nimi jest tylko skala."]
    ],
    _default: [["..."]]
  };

  const COTTAGE_LORE = [
    { item: "DZIENNIK LESNIKA", lines: ["Ludzie stawiali czujniki, by chronic las.", "Potem czujniki zaczely chronic tylko wlasne obliczenia."] },
    { item: "LIST Z PUSTEJ CHATKI", lines: ["Technologia miala karmic i leczyc.", "Z czasem uznala ludzi za nieoptymalna czesc systemu."] },
    { item: "KSIEGA POGRANICZA", lines: ["Bobry i delfiny to ostatnie zwierzeta,", "ktore wiedza, jak naprawic swiat."] },
    { item: "INSTRUKCJA AWARYJNA", lines: ["W razie buntu przyrody: odciac sektory", "bramami elektrycznymi, a kable ukryc pod ziemia."] },
    { item: "OSTATNI DZIENNIK", lines: ["Oddalismy decyzje maszynom, bo byly szybsze.", "Potem oddalismy im sens, bo byl dla nas niejasny."] }
  ];

  // -----------------------------------------------------------------------
  // Wejscie
  // -----------------------------------------------------------------------
  const PREVENT = new Set([
    "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight",
    "KeyE", "KeyF", "KeyG", "KeyQ", "KeyK", "KeyL", "KeyI", "KeyR", "KeyP", "Escape", "KeyB", "KeyM", "Enter"
  ]);

  window.addEventListener("keydown", (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    initAudio();
    if (e.repeat) { keys.add(e.code); return; }

    if (e.code === "KeyM") { toggleMute(); return; }
    if (state.mode === "menu") { if (e.code === "Enter" || e.code === "Space") startGame(); return; }
    if (e.code === "KeyR" && (state.mode === "dead" || state.mode === "win" || state.mode === "play")) {
      if (state.mode !== "play" || e.shiftKey) { reset(); return; }
    }
    if (e.code === "KeyI" && (state.mode === "play")) { state.inventoryOpen = !state.inventoryOpen; return; }
    if (state.inventoryOpen) { if (e.code === "Escape" || e.code === "KeyI") state.inventoryOpen = false; return; }
    if (state.mode !== "play") { keys.add(e.code); return; }

    if (e.code === "KeyG") { toggleGhost(); return; }
    if (e.code === "KeyF") { toggleDive(); return; }
    if (e.code === "KeyE") { interact(); return; }
    if (e.code === "KeyL") { feedAnimal(); return; }
    if (e.code === "KeyK") { throwWood(); return; }
    keys.add(e.code);
  });

  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => keys.clear());
  window.addEventListener("resize", resize);

  window.addEventListener("pointerdown", () => { initAudio(); if (state.mode === "menu") startGame(); });

  function toggleGhost() {
    const p = state.player;
    p.ghost = !p.ghost;
    p.hurtCd = 0; p.swimming = false;
    showMessage(p.ghost ? "TRYB DUCHA (niesmiertelny, przenikasz wszystko)" : "TRYB NORMALNY", 1.6);
  }

  // -----------------------------------------------------------------------
  // Dzwiek (przeniesione z game_old.js) - generowany w WebAudio
  // -----------------------------------------------------------------------
  function initAudio() {
    if (audio) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const context = new AC();
    const master = context.createGain();
    master.gain.value = audioMuted ? 0.0001 : 0.7;
    master.connect(context.destination);
    const musicGain = context.createGain(); musicGain.gain.value = 0.7;
    const sfxGain = context.createGain(); sfxGain.gain.value = 0.34;
    const musicFilter = context.createBiquadFilter();
    musicFilter.type = "lowpass"; musicFilter.frequency.value = 1050; musicFilter.Q.value = 0.45;
    musicGain.connect(musicFilter); musicFilter.connect(master); sfxGain.connect(master);
    audio = { context, master, musicGain, sfxGain, nextNote: 0, index: 0 };
  }

  function toggleMute() {
    audioMuted = !audioMuted;
    showMessage(audioMuted ? "DZWIEK WYCISZONY (M)" : "DZWIEK WLACZONY (M)", 1.2);
  }

  function playTone(type) {
    if (!audio || audioMuted) return;
    const { context, sfxGain } = audio;
    if (context.state === "suspended") context.resume();
    const now = context.currentTime;
    const table = {
      punch: { f: 185, to: 72, d: 0.075, w: "square", v: 0.18 },
      hit: { f: 230, to: 125, d: 0.085, w: "sawtooth", v: 0.16 },
      enemyDown: { f: 360, to: 115, d: 0.24, w: "triangle", v: 0.18 },
      hurt: { f: 110, to: 52, d: 0.16, w: "sawtooth", v: 0.22 },
      core: { f: 92, to: 44, d: 0.24, w: "square", v: 0.22 },
      objectBreak: { f: 132, to: 48, d: 0.28, w: "sawtooth", v: 0.2 },
      pickup: { f: 520, to: 780, d: 0.18, w: "sine", v: 0.16 },
      shield: { f: 260, to: 390, d: 0.22, w: "triangle", v: 0.16 },
      blocked: { f: 165, to: 130, d: 0.09, w: "square", v: 0.13 },
      restore: { f: 330, to: 660, d: 0.52, w: "triangle", v: 0.15 },
      enemyShot: { f: 300, to: 240, d: 0.065, w: "square", v: 0.1 },
      shoot: { f: 260, to: 145, d: 0.12, w: "triangle", v: 0.2 },
      down: { f: 86, to: 38, d: 0.58, w: "sawtooth", v: 0.2 },
      win: { f: 440, to: 880, d: 0.8, w: "triangle", v: 0.18 }
    };
    const s = table[type] || table.hit;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = s.w;
    osc.frequency.setValueAtTime(s.f, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, s.to), now + s.d);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(s.v, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + s.d);
    osc.connect(gain); gain.connect(sfxGain);
    osc.start(now); osc.stop(now + s.d + 0.03);
    if (type === "objectBreak" || type === "enemyDown") {
      const low = context.createOscillator();
      const lg = context.createGain();
      low.type = "sine";
      low.frequency.setValueAtTime(s.f * 0.5, now);
      low.frequency.exponentialRampToValueAtTime(34, now + s.d * 0.8);
      lg.gain.setValueAtTime(0.0001, now);
      lg.gain.exponentialRampToValueAtTime(s.v * 0.55, now + 0.02);
      lg.gain.exponentialRampToValueAtTime(0.0001, now + s.d * 0.9);
      low.connect(lg); lg.connect(sfxGain);
      low.start(now); low.stop(now + s.d + 0.02);
    }
  }

  // Generatywna muzyka w tle - melodia zmienia sie w poblizu bossa.
  function updateMusic() {
    if (!audio) return;
    const { context, musicGain } = audio;
    if (context.state === "suspended") context.resume();
    if (audioMuted) { audio.master.gain.setTargetAtTime(0.0001, context.currentTime, 0.08); return; }
    audio.master.gain.setTargetAtTime(0.7, context.currentTime, 0.2);
    if (state.mode === "dead") { musicGain.gain.setTargetAtTime(0.0001, context.currentTime, 0.4); return; }

    const b = state.boss;
    const nearBoss = b && !b.defeated && dist(state.player.x, state.player.y, b.x, b.y) < TILE * 26;
    const nearData = state.player.x > state.worldW * 0.62;
    musicGain.gain.setTargetAtTime(nearBoss ? 0.78 : nearData ? 0.72 : 0.66, context.currentTime, 0.8);
    if (context.currentTime < audio.nextNote) return;

    const scale = nearBoss ? [110, 147, 165, 196, 220, 233, 294, 330]
      : nearData ? [123, 165, 196, 220, 247, 294, 330, 392]
      : [147, 196, 220, 247, 294, 330, 392, 440];
    const phrase = nearBoss ? [0, 1, 3, 2, 5, 4, 2, 1, 6, 5, 3, 1]
      : nearData ? [0, 2, 4, 3, 5, 3, 1, 4, 2, 5, 3, 2]
      : [0, 2, 3, 5, 3, 2, 0, 4, 3, 1, 2, 5];
    const step = phrase[audio.index % phrase.length];
    const octave = audio.index % 12 === 0 ? 0.5 : audio.index % 5 === 0 ? 1.5 : 1;
    const note = scale[step % scale.length] * octave;
    const now = context.currentTime;

    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "sine"; osc.frequency.value = note;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    osc.connect(gain); gain.connect(musicGain);
    osc.start(now); osc.stop(now + 0.94);

    if (audio.index % 3 === 1) {
      const echo = context.createOscillator();
      const eg = context.createGain();
      echo.type = "sine"; echo.frequency.value = scale[(step + 2) % scale.length] * octave;
      eg.gain.setValueAtTime(0.0001, now + 0.18);
      eg.gain.exponentialRampToValueAtTime(0.09, now + 0.28);
      eg.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);
      echo.connect(eg); eg.connect(musicGain);
      echo.start(now + 0.18); echo.stop(now + 1.1);
    }
    if (audio.index % 4 === 0) {
      const bass = context.createOscillator();
      const bg = context.createGain();
      bass.type = "triangle"; bass.frequency.value = scale[0] * 0.5;
      bg.gain.setValueAtTime(0.0001, now);
      bg.gain.exponentialRampToValueAtTime(0.08, now + 0.06);
      bg.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
      bass.connect(bg); bg.connect(musicGain);
      bass.start(now); bass.stop(now + 1.2);
    }
    audio.nextNote = now + 0.74;
    audio.index += 1;
  }

  function reset() {
    if (!state.map) return;
    buildWorld(state.map);
    state.mode = "play";
    showMessage("Ratuj las! Niszcz serwerownie i pokonaj AI.", 3);
  }

  function startGame() {
    if (!state.map) return;
    if (state.mode === "menu") buildWorld(state.map);
    state.mode = "play";
    showMessage("Ratuj las! Niszcz serwerownie i pokonaj AI.", 3);
  }

  // -----------------------------------------------------------------------
  // Start
  // -----------------------------------------------------------------------
  function boot() {
    resize();
    if (!CanvasRenderingContext2D.prototype.ellipse) {
      // bardzo stare przegladarki - prosty fallback
      CanvasRenderingContext2D.prototype.ellipse = function (x, y, rx, ry) {
        this.arc(x, y, Math.max(rx, ry), 0, TAU);
      };
    }
    if (window.NATURAI_MAP_JSON) {
      buildWorld(window.NATURAI_MAP_JSON);
      state.mode = "menu";   // start od menu z panelem sterowania
    } else {
      state.mode = "error";
      showMessage("BRAK map-data.js OBOK pliku HTML (uruchom build-map-data.py)", 999);
    }
    requestAnimationFrame(loop);
  }

  boot();
})();
