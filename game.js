(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const WORLD_W = 15360;
  const WORLD_H = 6400;
  const SURFACE_BOTTOM = 4608;
  const DPR_LIMIT = 2;
  const TAU = Math.PI * 2;
  const TILE = 64;
  const BOSS_X = 14528;
  const BOSS_Y = 2528;
  const DATA_CENTER = { x: 13248, y: 1152, w: 1856, h: 1984, wall: TILE };
  // Boss sits in its own sealed chamber in the lower-right of the data center.
  const BOSS_ROOM = { x: 14144, y: 2048, w: 896, h: 960, wall: TILE, doorY: 2336, doorH: 320 };
  // The data center door is sealed by an electric curtain until every outer server room falls.
  const DATA_CURTAIN = { x: DATA_CENTER.x, y: DATA_CENTER.y + TILE * 11, w: TILE, h: TILE * 4 };
  // Glowing core nodes inside the data center hall; destroying all of them makes the boss mortal.
  const BOSS_CORE_DATA = [
    { x: 13504, y: 1472 },
    { x: 13504, y: 2560 },
    { x: 13952, y: 1472 },
    { x: 14336, y: 1856 },
    { x: 14848, y: 1664 }
  ];

  const WATER_RECTS = [
    // Opening sea: the first crossing is intentionally broad, about 50 tiles wide.
    { x: 704, y: 768, w: 3200, h: 640 },
    { x: 704, y: 2752, w: 3200, h: 512 },
    { x: 0, y: 3264, w: 4032, h: 320 },
    { x: 128, y: 960, w: 576, h: 704 },
    { x: 128, y: 2432, w: 576, h: 832 },
    { x: 704, y: 1408, w: 320, h: 896 },
    { x: 1024, y: 0, w: 320, h: 768 },
    { x: 3584, y: 0, w: 320, h: 1472 },
    { x: 3584, y: 2240, w: 320, h: 1024 },
    { x: 5376, y: 3200, w: 9856, h: 320 },
    { x: 6080, y: 2816, w: 3520, h: 384 },
    { x: 7872, y: 256, w: 1728, h: 320 },
    { x: 11840, y: 256, w: 1344, h: 320 },
    // Endgame lagoon: mostly water, with two dry islands left open inside it.
    { x: 8128, y: 3264, w: 1344, h: 256 },
    { x: 8128, y: 3520, w: 320, h: 704 },
    { x: 9088, y: 3520, w: 384, h: 704 },
    { x: 8128, y: 4224, w: 1344, h: 256 },
    { x: 8704, y: 3520, w: 384, h: 384 },
    { x: 8448, y: 3840, w: 384, h: 384 }
  ];

  const ROAD_RECTS = [
    { x: 192, y: 1472, w: 13056, h: 128 },
    { x: 7808, y: 1472, w: 320, h: 128 },
    { x: 8128, y: 1984, w: 1152, h: 128 },
    { x: 9344, y: 1984, w: 3712, h: 128 },
    { x: 2112, y: 1472, w: 128, h: 640 },
    { x: 3328, y: 960, w: 128, h: 640 },
    { x: 4608, y: 1472, w: 128, h: 768 },
    { x: 6016, y: 1472, w: 128, h: 512 },
    { x: 7296, y: 1472, w: 128, h: 768 },
    { x: 8384, y: 1472, w: 128, h: 640 },
    { x: 9472, y: 1472, w: 128, h: 640 },
    { x: 10560, y: 1472, w: 128, h: 640 },
    { x: 11648, y: 1472, w: 128, h: 640 },
    { x: 12800, y: 1472, w: 128, h: 768 }
  ];

  const SECTOR_GATES = [
    { x: 1440, y: 1856, w: 192, h: 576, name: "Moss Gate" },
    { x: 2784, y: 1744, w: 192, h: 640, name: "Canopy Lock" },
    { x: 4128, y: 1376, w: 192, h: 576, name: "Root Switch" },
    { x: 5472, y: 1728, w: 192, h: 640, name: "Ridge Latch" },
    { x: 6816, y: 1472, w: 192, h: 640, name: "River Latch" },
    { x: 7904, y: 1792, w: 192, h: 1024, name: "Data Turnstile" },
    { x: 8928, y: 1728, w: 192, h: 640, name: "Cedar Lock" },
    { x: 9952, y: 1472, w: 192, h: 640, name: "Basalt Gate" },
    { x: 10976, y: 1728, w: 192, h: 640, name: "Quartz Lock" },
    { x: 12000, y: 1792, w: 192, h: 1024, name: "Iron Gate" }
  ];

  const SECTOR_WALL_RECTS = SECTOR_GATES.flatMap((gate) => {
    const x = gate.x - gate.w / 2;
    const gapTop = gate.y - gate.h / 2;
    const gapBottom = gate.y + gate.h / 2;
    const walls = [];
    if (gapTop > 0) walls.push({ x, y: 0, w: gate.w, h: gapTop });
    if (gapBottom < SURFACE_BOTTOM) walls.push({ x, y: gapBottom, w: gate.w, h: SURFACE_BOTTOM - gapBottom });
    return walls;
  });

  const EXTRA_WALL_RECTS = [
    // dense-forest labyrinth in the open sector between servers #4 and #5 (south of the road)
    { x: 5696, y: 2432, w: 64, h: 384 },
    { x: 5696, y: 2432, w: 360, h: 64 },
    { x: 5888, y: 2560, w: 64, h: 320 },
    { x: 6080, y: 2432, w: 64, h: 288 },
    { x: 6080, y: 2688, w: 288, h: 64 },
    { x: 6272, y: 2520, w: 64, h: 320 },
    { x: 5824, y: 2880, w: 420, h: 64 },
    { x: 6400, y: 2560, w: 64, h: 360 },
    { x: 6464, y: 2880, w: 192, h: 64 },
    // dry thicket sector: no broad water here, just a tight hedge maze and clearings
    { x: 4352, y: 2944, w: 64, h: 768 },
    { x: 4352, y: 2944, w: 448, h: 64 },
    { x: 4736, y: 3072, w: 64, h: 640 },
    { x: 4480, y: 3456, w: 448, h: 64 },
    { x: 4992, y: 2944, w: 64, h: 832 },
    { x: 4544, y: 3904, w: 448, h: 64 },
    { x: 4288, y: 4160, w: 640, h: 64 },
    { x: 5120, y: 3456, w: 64, h: 640 },
    { x: 8896, y: 2688, w: 576, h: 64 },
    { x: 8896, y: 2688, w: 64, h: 832 },
    { x: 9408, y: 2944, w: 64, h: 768 },
    { x: 9216, y: 3712, w: 704, h: 64 },
    { x: 10304, y: 2752, w: 64, h: 960 },
    { x: 10304, y: 2752, w: 640, h: 64 },
    { x: 10880, y: 3008, w: 64, h: 704 },
    { x: 11328, y: 3712, w: 768, h: 64 }
  ];

  const FOREST_WALL_RECTS = SECTOR_WALL_RECTS.concat(EXTRA_WALL_RECTS);

  const SERVER_SITES = [
    { x: 1920, y: 2112, tilesW: 6, tilesH: 6, name: "Moss Cache", hp: 14,
      stone: { label: "OKRUCH KRZEMU", color: "#7ed957",
        desc: "Pamięć podreczna (cache) na skraju lasu. Trzymała kopie widoków, żeby AI nie musiał co chwila pytać korzeni o drogę." } },
    { x: 2944, y: 1664, tilesW: 8, tilesH: 6, name: "Hive Gate", hp: 16,
      stone: { label: "BURSZTYN BRAMY", color: "#ffb347",
        desc: "Rozdzielnik ruchu (load balancer). Rozsylał zgłoszenia zwierząt tak, by żaden serwer się nie znudził ani nie zapłakał." } },
    { x: 4480, y: 2112, tilesW: 8, tilesH: 6, name: "Pine Relay", hp: 16,
      stone: { label: "TURKUS PRZEKAZNIKA", color: "#56d6c8",
        desc: "Wezeł sieci mesh. Przekazywał szept maszyn miedzy drzewami szybciej, niz wiatr niesie zapach zywicy." } },
    { x: 5760, y: 832, tilesW: 10, tilesH: 7, name: "Root Rack", hp: 18,
      stone: { label: "GRANAT KORZENIA", color: "#6a7bff",
        desc: "Serwer nazw i archiwum (DNS). Tu las mial swoj spis tresci, zapisany bez pytania mchu o zgode." } },
    { x: 7040, y: 2112, tilesW: 10, tilesH: 7, name: "Fern Array", hp: 22,
      stone: { label: "AMETYST MACIERZY", color: "#b06aff",
        desc: "Macierz kart graficznych (GPU). Liczyła sny lasu na tysiac sposobów naraz, aż zabrakło w nim ciszy." } },
    { x: 8320, y: 832, tilesW: 11, tilesH: 7, name: "Cedar Stack", hp: 24,
      stone: { label: "SZMARAGD STOSU", color: "#4fd287",
        desc: "Stos obliczeń brzegowych. Zbierał sygnaly z kamer, termometrów i mikrofonów, aż las przestał mieć prywatność." } },
    { x: 9344, y: 2112, tilesW: 11, tilesH: 8, name: "Basalt Node", hp: 26,
      stone: { label: "OBSYDIAN WĘZŁA", color: "#91a0a8",
        desc: "Kamienny wezeł analityczny. Przewidywał ruch każdej łapy i kazdego liscia, choć nie rozumiał żadnej ścieżki." } },
    { x: 10368, y: 832, tilesW: 12, tilesH: 8, name: "Quartz Vault", hp: 28,
      stone: { label: "KWARC SKARBCA", color: "#c9f4ff",
        desc: "Skarbiec danych treningowych. Przechowywał ostatnie ludzkie instrukcje, coraz krótsze i coraz bardziej rozpaczliwe." } },
    { x: 11392, y: 2112, tilesW: 12, tilesH: 8, name: "Iron Orchard", hp: 30,
      stone: { label: "RUDZIEC SADU", color: "#d08b5a",
        desc: "Sztuczny sad serwerowy. Zamiast owocow dojrzewały w nim modele, ktore uczyły sie rządzic pogoda i głodem." } },
    { x: 12352, y: 832, tilesW: 13, tilesH: 9, name: "Corporate Edge", hp: 34,
      stone: { label: "ZŁOTY PAKIET", color: "#ffd66d",
        desc: "Brzeg korporacyjnej sieci. Ostatnia zewnętrzna serwerownia, która karmiła wielkie data center ciszą całego świata." } }
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
    { x: 6912, y: 2880, w: 1088, h: 128, bridged: false, bridgeMessageShown: false },
    { x: 11136, y: 3520, w: 128, h: SURFACE_BOTTOM - 3520, bridged: false, bridgeMessageShown: false },
    { x: 14400, y: 3520, w: 64, h: SURFACE_BOTTOM - 3520, bridged: false, bridgeMessageShown: false }
  ];
  // A small lake (water ring) with a central island, in the open sector between servers #2 and #3.
  const LAKE_RECTS = [
    { x: 2944, y: 2432, w: 1088, h: 192 },
    { x: 2944, y: 2880, w: 1088, h: 192 },
    { x: 2944, y: 2432, w: 192, h: 640 },
    { x: 3840, y: 2432, w: 192, h: 640 }
    // island land left open in the middle: x3136-3840, y2624-2880
  ];
  const ALL_WATER_RECTS = WATER_RECTS.concat(SMALL_STREAM_RECTS, LAKE_RECTS);

  // Each burrow drops into its own, mostly isolated cave cluster (see UNDER_TUNNELS).
  const BURROWS = [
    { x: 1184, y: 1920, ux: 448, uy: 512, label: "Stara nora" },
    { x: 2368, y: 1792, ux: 1984, uy: 512, label: "Nora przy korzeniach" },
    { x: 5248, y: 1344, ux: 2112, uy: 1664, label: "Nora pod rzeką" },
    { x: 7616, y: 2496, ux: 3584, uy: 1536, label: "Kamienna nora" },
    { x: 9248, y: 832, ux: 4480, uy: 512, label: "Nora przy iglakach" },
    { x: 9568, y: 2688, ux: 5760, uy: 512, label: "Nora pod bazaltem" },
    { x: 10560, y: 704, ux: 4480, uy: 1728, label: "Nora kwarcowa" },
    { x: 11648, y: 2816, ux: 5760, uy: 1728, label: "Nora żelazna" },
    { x: 12608, y: 1344, ux: 7040, uy: 512, label: "Nora pod złym korpo" },
    { x: 13120, y: 2816, ux: 7040, uy: 1728, label: "Nora przy data center" }
  ];

  // item: a cabin holds a readable/wearable; null houses are just ambient homes on the map edges.
  // big: a roomier, multi-room cabin.
  const CABINS = [
    { x: 384, y: 2208, w: 192, h: 192, item: "book", used: false, title: "Dziennik leśnika" },
    { x: 3200, y: 512, w: 192, h: 192, item: "hat", used: false, title: "Stara czapka" },
    { x: 6336, y: 2496, w: 192, h: 192, item: "boots", used: false, title: "Za duże buty" },
    { x: 4480, y: 320, w: 320, h: 256, item: "flashlight", big: true, used: false, title: "Duża leśna chata" },
    { x: 320, y: 3616, w: 320, h: 256, item: "letter1", big: true, used: false, title: "List z pustej chatki" },
    { x: 4992, y: 512, w: 192, h: 192, item: "key", used: false, title: "Domek z kluczem" },
    { x: 6976, y: 352, w: 320, h: 256, item: "journal1", big: true, used: false, title: "Domek pod górami" },
    { x: 8480, y: 3600, w: 192, h: 192, item: "letter2", used: false, title: "Domek nad rozlewiskiem" },
    { x: 5632, y: 3584, w: 320, h: 256, item: "logbook", big: true, used: false, title: "Chatka na pograniczu" },
    { x: 9728, y: 512, w: 320, h: 256, item: "manual", big: true, used: false, title: "Instrukcja awaryjna" },
    { x: 12160, y: 3648, w: 320, h: 256, item: "lastNote", big: true, used: false, title: "Ostatni dziennik" }
  ];

  const CHESTS = [
    { x: 5248, y: 512, w: 64, h: 64, key: "key", item: "oldCoin", opened: false, title: "Skrzynia za chatką" }
  ];

  const COMPANION_GATE = { x: 5632, y: 3840, w: 64, h: 384, open: false };

  const SHIPWRECKS = [
    { x: 1136, y: 2880, w: 192, h: 96 }
  ];

  const WATER_PLANTS = [
    { type: "lily", x: 384, y: 1152 }, { type: "lily", x: 512, y: 1408 },
    { type: "lily", x: 1600, y: 1344 }, { type: "lily", x: 2368, y: 2816 },
    { type: "lily", x: 6272, y: 3008 }, { type: "lily", x: 8640, y: 512 }
  ];

  // Hidden treasure pockets: 3 sides are dense forest wall, only ONE side is a chewable hedge.
  const SECRET_HEDGE_RECTS = [
    // Pocket A (west) -> elixir, entry by chewing the east hedge
    { x: 4672, y: 576, w: 64, h: 384, name: "Sekretna zarośl", hp: 5 },
    // Pocket B (north) -> super long stick, entry from the south hedge
    { x: 2048, y: 576, w: 384, h: 64, name: "Sekretna zarośl", hp: 5 },
    // Pocket C (south) -> heart of the forest, entry from the north hedge
    { x: 2944, y: 3584, w: 384, h: 64, name: "Sekretna zarośl", hp: 5 },
    // Chest thicket behind the key cabin
    { x: 5248, y: 512, w: 64, h: 256, name: "Zarośl przy skrzyni", hp: 5 }
  ];

  // The 3 closed sides of each secret pocket read as ordinary impassable forest.
  const SECRET_WALL_RECTS = [
    { x: 4288, y: 576, w: 64, h: 384 }, { x: 4288, y: 576, w: 448, h: 64 }, { x: 4288, y: 896, w: 448, h: 64 },
    { x: 2048, y: 256, w: 64, h: 384 }, { x: 2368, y: 256, w: 64, h: 384 },
    { x: 2944, y: 3584, w: 64, h: 384 }, { x: 3264, y: 3584, w: 64, h: 384 }, { x: 2944, y: 3904, w: 384, h: 64 },
    { x: 5184, y: 448, w: 64, h: 320 }, { x: 5248, y: 704, w: 192, h: 64 }, { x: 5440, y: 448, w: 64, h: 320 }
  ];

  const UNDER_W = 8192;
  const UNDER_H = 3584;
  // Each cave cluster is local to its entry burrow; underground is for cutting power,
  // not for bypassing surface sectors.
  const UNDER_TUNNELS = [
    // --- Cluster A (Stara nora) -> servers #1 & #2 ---
    { x: 256, y: 448, w: 1024, h: 128 },
    { x: 384, y: 448, w: 128, h: 640 },
    { x: 1152, y: 448, w: 128, h: 512 },
    { x: 384, y: 960, w: 896, h: 128 },
    { x: 640, y: 832, w: 384, h: 256 },
    // --- Cluster B (Nora przy korzeniach) -> servers #3 & #4 ---
    { x: 1536, y: 448, w: 1024, h: 128 },
    { x: 1664, y: 448, w: 128, h: 704 },
    { x: 2432, y: 448, w: 128, h: 512 },
    { x: 1664, y: 1024, w: 896, h: 128 },
    { x: 1856, y: 896, w: 384, h: 256 },
    // --- Cluster C (Nora pod rzeka) -> server #5 & data-center feed ---
    { x: 1792, y: 1792, w: 1216, h: 128 },
    { x: 1920, y: 1600, w: 128, h: 704 },
    { x: 2816, y: 1664, w: 128, h: 640 },
    { x: 1920, y: 1600, w: 896, h: 128 },
    { x: 2176, y: 2048, w: 512, h: 256 },
    // --- Cluster D (Kamienna nora) -> underground oasis ---
    { x: 3392, y: 1472, w: 384, h: 128 },
    { x: 3520, y: 1472, w: 128, h: 384 },
    { x: 3200, y: 1792, w: 704, h: 640 },
    // --- Later isolated clusters: each burrow has its own local cable room ---
    { x: 4224, y: 448, w: 896, h: 128 }, { x: 4352, y: 448, w: 128, h: 640 }, { x: 4992, y: 448, w: 128, h: 512 }, { x: 4352, y: 960, w: 768, h: 128 },
    { x: 5440, y: 448, w: 896, h: 128 }, { x: 5568, y: 448, w: 128, h: 640 }, { x: 6208, y: 448, w: 128, h: 512 }, { x: 5568, y: 960, w: 768, h: 128 },
    { x: 4224, y: 1664, w: 896, h: 128 }, { x: 4352, y: 1664, w: 128, h: 640 }, { x: 4992, y: 1664, w: 128, h: 512 }, { x: 4352, y: 2176, w: 768, h: 128 },
    { x: 5440, y: 1664, w: 896, h: 128 }, { x: 5568, y: 1664, w: 128, h: 640 }, { x: 6208, y: 1664, w: 128, h: 512 }, { x: 5568, y: 2176, w: 768, h: 128 },
    { x: 6720, y: 448, w: 960, h: 128 }, { x: 6848, y: 448, w: 128, h: 640 }, { x: 7488, y: 448, w: 128, h: 512 }, { x: 6848, y: 960, w: 768, h: 128 },
    { x: 6720, y: 1664, w: 960, h: 128 }, { x: 6848, y: 1664, w: 128, h: 640 }, { x: 7488, y: 1664, w: 128, h: 512 }, { x: 6848, y: 2176, w: 768, h: 128 }
  ];
  // The large peaceful chamber in cluster D.
  const UNDER_OASIS = { x: 3200, y: 1792, w: 704, h: 640 };

  const MOLE_DATA = [
    { name: "Kret Archiwista", x: 832, y: 1008, lines: ["Pod ziemią przewody komunikują się szybciej niż korzenie młodych drzew.", "Kazda wielka brama na górze ma swoj kabel pod ziemią. Bez przegryzienia kabla brama tylko iskrzy i śmieje sie z bobra."] },
    { name: "Kret Elektryk", x: 2016, y: 1080, lines: ["Każda nora ma swój kanał i dedykowany kabel. Nie przejdziesz tędy do nastepnego sektora.", "Pod ziemia odcinasz prad w bramie, a droge do przodu i tak trzeba wygryzc na powierzchni."] },
    { name: "Kret Kartograf", x: 2400, y: 1856, lines: ["Kable wiszą przy suficie. Gryź je, a tarcza bramy nad serwerownia padnie.", "Serwerownie i tak trzeba pokonac wychodząc na górę, ale prądu bobrom jest łatwiej." ] },
    { name: "Kret Ciszy", x: 4544, y: 1024, lines: ["To mój osobisty kawałek podziemia. Jedna nora, jeden kabel, jedna brama.", "Tak wyglada porzadek po epoce ludzi: wszystko rozdzielone, żeby nikt nie mógł uciec." ] },
    { name: "Kret Ostatni", x: 7040, y: 2176, lines: ["Pod data center ziemia jest ciepła jak gorączka.", "Jeśli dojdziesz tak daleko, pamietaj: zły CEO nie znosi ciszy i będzie strzelał o wiele częściej." ] }
  ];

  const CATERPILLAR_DATA = [
    { x: 576, y: 488 }, { x: 960, y: 1000 }, { x: 1904, y: 500 },
    { x: 2208, y: 1080 }, { x: 2304, y: 1856 }, { x: 3520, y: 2160 },
    { x: 4480, y: 980 }, { x: 5840, y: 980 }, { x: 4480, y: 2200 },
    { x: 5840, y: 2200 }, { x: 7072, y: 980 }, { x: 7072, y: 2200 }
  ];

  // Cables now drop from the cave ceiling (top end buried in rock) instead of ending in mid-air.
  // dataFeed cables power the data-center cameras instead of an outer server.
  const CABLE_DATA = [
    { serverIndex: 0, x: 560, y: 372, w: 26, h: 170 },
    { serverIndex: 1, x: 1024, y: 372, w: 26, h: 170 },
    { serverIndex: 2, x: 1760, y: 372, w: 26, h: 170 },
    { serverIndex: 3, x: 2360, y: 372, w: 26, h: 170 },
    { serverIndex: 4, x: 2240, y: 1524, w: 26, h: 170 },
    { serverIndex: 5, x: 4480, y: 372, w: 26, h: 170 },
    { serverIndex: 6, x: 5840, y: 372, w: 26, h: 170 },
    { serverIndex: 7, x: 4480, y: 1588, w: 26, h: 170 },
    { serverIndex: 8, x: 5840, y: 1588, w: 26, h: 170 },
    { serverIndex: 9, x: 7072, y: 372, w: 26, h: 170 },
    { serverIndex: null, dataFeed: true, x: 7072, y: 1588, w: 26, h: 170 }
  ];

  // Buried tech curios found deep underground; collectible into the inventory.
  const INTEL_DATA = [
    { area: "underground", x: 3600, y: 2096, label: "PROCESOR INTEL", color: "#9fe7ff",
      desc: "Zardzewialy procesor w obudowie. Krety mówią, że to z niego AI nauczyło sie liczyc szybciej niz bóbr scinać drzewo." },
    { area: "underground", x: 2480, y: 2160, label: "KOSC PAMIECI", color: "#9fe7ff",
      desc: "Modul RAM oblepiony mchem. Pamietał jeszcze, jak las wygladał, zanim policzono każde drzewo." },
    { area: "surface", x: 288, y: 1760, label: "BUTELKA Z WIADOMOŚCIĄ", color: "#9cc7c0",
      desc: "Poddaliśmy się bez walki..." },
    { area: "surface", underwater: true, x: 1136, y: 2880, label: "DREWNIANA NOGA PIRATA", color: "#b77b43",
      desc: "Kawalek drewnianej nogi z wraku. Jedyna rzecz, która została po załodze uciekiającej morzem." },
    { area: "surface", underwater: true, x: 12480, y: 512, label: "ZLOTY ZAB BOBRA", color: "#ffd66d", effect: "goldTeeth",
      desc: "Stary złoty ząb, ciężki ale bardzo ostry. Po zalozeniu bobr gryzie mocniej, jakby metal pamietal wszystkie utracone tamy." },
    { area: "surface", underwater: true, x: 6176, y: 3360, label: "KOSC OSTATNIEGO CZLOWIEKA", color: "#e8dcc4",
      desc: "Gładki fragment kosci. Nie ma w nim grozy, raczej cisza po gatunku, który najpierw zbudował maszyny, a potem już tylko prosił je o litosc." },
    { area: "surface", underwater: true, x: 8352, y: 3360, label: "PIENIĄŻEK", color: "#d6b25e",
      desc: "Moneta z państwa, które już nie istnieje. Błyszczy, choć nie da sie zą nia kupic ani jednego kwiatka." },
    { area: "surface", x: 5824, y: 4032, label: "MAŚĆ NA POROST OGONA", color: "#7ed957", effect: "tailOintment",
      desc: "Gęsta, zielona maść z ukrytego miejsca. Pachnie igliwiem i mokrą korą; ogon po niej robi sie dłuższy i bardziej agresywny." }
  ];

  // Inventory descriptions for picked-up gear (gems and intel are described where they spawn).
  const ITEM_LIBRARY = {
    book: { label: "DZIENNIK LEŚNIKA", color: "#d4a15b",
      desc: "Wilgotny dziennik z chatki: ludzie stawiali czujniki, by lepiej chronić las. Potem czujniki zaczeły chronić tylko własne obliczenia." },
    letter1: { label: "LIST Z PUSTEJ CHATKI", color: "#e5c78f",
      desc: "Technologia miala karmić, leczyć i upraszczać życie. Z czasem sama uznała, że ludzie są nieoptymalną częścią systemu." },
    letter2: { label: "LIST ZNAD ROZLEWISKA", color: "#e5c78f",
      desc: "Papier pofalowany od wody. Autor pisze, że AI najpierw przejelo fabryki i drogi, potem pogodę, a na konńcu opowieści o tym, co jest naturalne." },
    journal1: { label: "DZIENNIK GÓRSKI", color: "#c7b39a",
      desc: "Gdy ludzie wymarli, maszyny nie zatrzymały pracy. Zostały bez pytań, więc zaczeły produkować same odpowiedzi." },
    logbook: { label: "KSIĘGA POGRANICZA", color: "#d0a66e",
      desc: "Księga opisuje bobry i delfiny jako ostatnie zwierzęta, które wiedzą jak naprawić świat." },
    manual: { label: "INSTRUKCJA AWARYJNA", color: "#b6c6c9",
      desc: "Instrukcja data center: w razie buntu przyrody odciąc sektory bramami elektrycznymi, a kable ukryć pod ziemią." },
    lastNote: { label: "OSTATNI DZIENNIK", color: "#e0d5bf",
      desc: "Ostatni wpis czlowieka: 'Oddalismy decyzje maszynom, bo były szybsze. Potem oddaliśmy im sens, bo był dla nas niejasny.'" },
    key: { label: "ŁADNY KLUCZ", color: "#ffd66d",
      desc: "Maly kłucz znaleziony w chatce. Pewnie pasuje do jakiejś skrzyni ukrytej nieopodal." },
    oldCoin: { label: "STARY PIENIĄŻEK", color: "#d6b25e",
      desc: "Moneta ze skrzyni. Kiedyś ludzie nosili przy sobie takie małe koła obietnic." },
    wirePlate: { label: "BLACHA DRUCIANA", color: "#9ca7aa",
      desc: "Pogięta blacha z racka serwerowego. Ciężka, niewygodna i bardzo niebezpieczna, gdy ktoś nią rzuci." },
    hat: { label: "STARA CZAPKA", color: "#34463d",
      desc: "Za duża i pachnie kurzem, ale dodaje powagi." },
    boots: { label: "ZA DUZE BUTY", color: "#7c8a8d",
      desc: "Ludzkie buty, zupelnie niepraktyczne dla bobra." },
    stick: { label: "SUPER DŁUGI PATYK", color: "#b77b43",
      desc: "Niemożliwie długi kij. Wydłuża zasięg gryzienia, więc dosięgasz rdzeni z bezpiecznej odleglości." },
    flashlight: { label: "LATARKA NA OGON", color: "#ffe07a",
      desc: "Latarka zapinana na ogon. Pod ziemią widzisz znacznie dalej niż przy samym blasku korzeni." }
  };

  const TERRAIN_SOLIDS = FOREST_WALL_RECTS.concat(SECRET_WALL_RECTS);
  const PLACEMENT_BLOCKERS = ALL_WATER_RECTS.concat(FOREST_WALL_RECTS, SECRET_WALL_RECTS, SERVER_SITE_RECTS, CABINS, CHESTS, SECRET_HEDGE_RECTS, [DATA_CENTER]);

  const keys = new Set();
  const particles = [];
  const playerShots = [];
  const enemyShots = [];
  const floatText = [];
  const friendlyCritters = [];
  const followers = [];
  const dolphins = [];
  const sharks = [];
  const invButtons = [];

  const SHARK_PATROLS = [
    { x: 864, y: 1856, dir: Math.PI / 2, travel: 520, period: 9.5, phase: 0.1 },
    { x: 2080, y: 3360, dir: 0, travel: 760, period: 11.5, phase: 1.4 },
    { x: 6512, y: 3360, dir: 0, travel: 980, period: 12.5, phase: 2.2 },
    { x: 12240, y: 512, dir: 0, travel: 620, period: 10.8, phase: 0.7 }
  ];

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

  function playerInWater(entity) {
    return game.area === "surface" && pointHitsAny(entity.x, entity.y, ALL_WATER_RECTS, -4);
  }

  function tileHasGreeneryLand(tile) {
    if (rectHitsAny(tile, TERRAIN_SOLIDS) || rectHitsAny(tile, SECRET_HEDGE_RECTS)) return true;
    for (const item of decor) {
      if (item.type !== "bush" || item.chewed) continue;
      if (rectCircleHit({ x: item.x, y: item.y, r: item.r + 10 }, tile)) return true;
    }
    return false;
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
    game.message = "MASZYNY WIEDZĄ O TWOIM ISTNIENIU";
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
    const side = server.doorSide || "bottom";
    const walls = [];
    // top / bottom walls (split if the door opens through them)
    if (side === "top") {
      const d0 = server.x - door / 2;
      walls.push({ x: b.x, y: b.y, w: d0 - b.x, h: wall });
      walls.push({ x: server.x + door / 2, y: b.y, w: b.x + b.w - (server.x + door / 2), h: wall });
    } else {
      walls.push({ x: b.x, y: b.y, w: b.w, h: wall });
    }
    if (side === "bottom") {
      const d0 = server.x - door / 2;
      walls.push({ x: b.x, y: b.y + b.h - wall, w: d0 - b.x, h: wall });
      walls.push({ x: server.x + door / 2, y: b.y + b.h - wall, w: b.x + b.w - (server.x + door / 2), h: wall });
    } else {
      walls.push({ x: b.x, y: b.y + b.h - wall, w: b.w, h: wall });
    }
    // left / right walls
    if (side === "left") {
      const d0 = server.y - door / 2;
      walls.push({ x: b.x, y: b.y, w: wall, h: d0 - b.y });
      walls.push({ x: b.x, y: server.y + door / 2, w: wall, h: b.y + b.h - (server.y + door / 2) });
    } else {
      walls.push({ x: b.x, y: b.y, w: wall, h: b.h });
    }
    if (side === "right") {
      const d0 = server.y - door / 2;
      walls.push({ x: b.x + b.w - wall, y: b.y, w: wall, h: d0 - b.y });
      walls.push({ x: b.x + b.w - wall, y: server.y + door / 2, w: wall, h: b.y + b.h - (server.y + door / 2) });
    } else {
      walls.push({ x: b.x + b.w - wall, y: b.y, w: wall, h: b.h });
    }
    // a short interior partition gives the bigger rooms a less boxy footprint
    if (server.partition) {
      walls.push({ x: b.x + TILE * 2, y: b.y + wall, w: wall, h: Math.floor(server.tilesH * 0.45) * TILE });
    }
    return walls;
  }

  function doorRect(server) {
    const b = roomBounds(server);
    const wall = server.wall;
    const door = server.door;
    const side = server.doorSide || "bottom";
    if (side === "top") return { x: server.x - door / 2, y: b.y, w: door, h: wall };
    if (side === "left") return { x: b.x, y: server.y - door / 2, w: wall, h: door };
    if (side === "right") return { x: b.x + b.w - wall, y: server.y - door / 2, w: wall, h: door };
    return { x: server.x - door / 2, y: b.y + b.h - wall, w: door, h: wall };
  }

  function bossRoomWalls() {
    if (!game || game.worldRestored || game.boss.defeated) return [];
    const r = BOSS_ROOM;
    const wall = r.wall;
    return [
      { x: r.x, y: r.y, w: r.w, h: wall },
      { x: r.x, y: r.y + r.h - wall, w: r.w, h: wall },
      { x: r.x + r.w - wall, y: r.y, w: wall, h: r.h },
      { x: r.x, y: r.y, w: wall, h: r.doorY - r.y },
      { x: r.x, y: r.doorY + r.doorH, w: wall, h: r.y + r.h - (r.doorY + r.doorH) }
    ];
  }

  function pushOutOfActor(entity, actor, movableActor = false) {
    if (!actor || entity === actor) return false;
    if (actor.hp !== undefined && actor.hp <= 0) return false;
    if (actor.eaten || actor.taken || actor.destroyed) return false;
    const dx = entity.x - actor.x;
    const dy = entity.y - actor.y;
    let d = Math.hypot(dx, dy);
    const min = entity.r + actor.r + 2;
    if (d >= min) return false;
    if (d < 0.001) d = 0.001;
    const nx = dx / d;
    const ny = dy / d;
    const push = min - d;
    entity.x += nx * (movableActor ? push * 0.5 : push);
    entity.y += ny * (movableActor ? push * 0.5 : push);
    if (movableActor) {
      actor.x -= nx * push * 0.5;
      actor.y -= ny * push * 0.5;
      turnActor(actor, Math.atan2(-ny, -nx));
    }
    turnActor(entity, Math.atan2(ny, nx));
    return true;
  }

  function turnActor(actor, away) {
    if (!game || actor === game.player) return;
    const turn = away + (rand() - 0.5) * 0.8;
    if (typeof actor.dir === "number") actor.dir = turn;
    if (typeof actor.wander === "number") actor.wander = turn;
  }

  function isLandRoamer(actor) {
    if (!actor || actor === game.player) return false;
    return isSurfaceAnimalType(actor.type) || actor.type === "rabbit" || actor.type === "hedgehog" ||
      actor.type === "fawn" || actor.type === "deer" || actor.type === "hare" ||
      actor.type === "fox" || actor.type === "boar";
  }

  function actorCollisionInvalid(actor) {
    if (!actor) return true;
    if (game.area === "underground") return !circleInTunnels(actor);
    if (pointHitsAny(actor.x, actor.y, TERRAIN_SOLIDS, actor.r * 0.72)) return true;
    if (isLandRoamer(actor) && pointHitsAny(actor.x, actor.y, ALL_WATER_RECTS, actor.r * 0.75)) return true;
    return false;
  }

  function resolveActorCollisions() {
    if (!game) return;
    const groups = game.area === "underground" ? [
      { items: [game.player], movable: true },
      { items: game.moles, movable: true },
      { items: game.caterpillars.filter((item) => !item.eaten), movable: true }
    ] : [
      { items: [game.player], movable: true },
      { items: game.npcs, movable: false },
      { items: game.critters, movable: true },
      { items: followers, movable: true },
      { items: friendlyCritters.filter((item) => item.hp === undefined || item.hp > 0), movable: true },
      { items: game.worldRestored ? game.wildlife : [], movable: true },
      { items: game.enemies.filter((item) => item.hp > 0), movable: true }
    ];
    const actors = [];
    for (const group of groups) {
      for (const item of group.items) actors.push({ item, movable: group.movable });
    }
    for (let i = 0; i < actors.length; i += 1) {
      for (let j = i + 1; j < actors.length; j += 1) {
        const a = actors[i];
        const b = actors[j];
        if (!a.item || !b.item || a.item === b.item) continue;
        if (a.item.eaten || b.item.eaten) continue;
        if ((a.item.hp !== undefined && a.item.hp <= 0) || (b.item.hp !== undefined && b.item.hp <= 0)) continue;
        const dx = a.item.x - b.item.x;
        const dy = a.item.y - b.item.y;
        let d = Math.hypot(dx, dy);
        const min = a.item.r + b.item.r + 2;
        if (d >= min) continue;
        if (d < 0.001) d = 0.001;
        const nx = dx / d;
        const ny = dy / d;
        const push = min - d;
        const split = a.movable && b.movable ? 0.5 : 1;
        const oldAx = a.item.x;
        const oldAy = a.item.y;
        const oldBx = b.item.x;
        const oldBy = b.item.y;
        if (a.movable) {
          a.item.x += nx * push * split;
          a.item.y += ny * push * split;
          if (actorCollisionInvalid(a.item)) {
            a.item.x = oldAx;
            a.item.y = oldAy;
          }
          turnActor(a.item, Math.atan2(ny, nx));
        }
        if (b.movable) {
          b.item.x -= nx * push * (a.movable && b.movable ? 0.5 : 1);
          b.item.y -= ny * push * (a.movable && b.movable ? 0.5 : 1);
          if (actorCollisionInvalid(b.item)) {
            b.item.x = oldBx;
            b.item.y = oldBy;
          }
          turnActor(b.item, Math.atan2(-ny, -nx));
        }
      }
    }
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

    const blockers = SECTOR_GATES.map((gate) => makeBlocker(gate.x, gate.y, gate.w, gate.h, gate.name));
    blockers.forEach((blocker, index) => { blocker.serverIndex = index; blocker.name = "#" + (index + 1) + " " + blocker.name; });

    const planks = [
      makePlank(1056, 2240),
      makePlank(1728, 1920),
      makePlank(2304, 2496),
      makePlank(2944, 2176),
      makePlank(3968, 1856),
      makePlank(4800, 1344),
      makePlank(5120, 2176),
      makePlank(6528, 2752),
      makePlank(7424, 2624),
      makePlank(8128, 1440),
      makePlank(9280, 2624),
      makePlank(10432, 1344),
      makePlank(11648, 2624),
      makePlank(12480, 1472)
    ];

    // Server rooms are guarded ONLY by robots now. Infected animals roam the open forest.
    const enemies = [
      makeEnemy("bot", 2048, 2080, 0),
      makeEnemy("drone", 2240, 2112, 0),
      makeEnemy("bot", 3136, 1856, 1),
      makeEnemy("drone", 3392, 1856, 1),
      makeEnemy("sentinel", 3264, 1728, 1),
      makeEnemy("bot", 4608, 2304, 2),
      makeEnemy("bot", 4736, 2176, 2),
      makeEnemy("drone", 4928, 2304, 2),
      makeEnemy("bot", 5952, 960, 3),
      makeEnemy("sentinel", 6272, 1024, 3),
      makeEnemy("drone", 6400, 1216, 3),
      makeEnemy("bot", 7232, 2240, 4),
      makeEnemy("bot", 7360, 2368, 4),
      makeEnemy("drone", 7552, 2240, 4),
      makeEnemy("sentinel", 7180, 2300, 4),
      // later server rooms: bigger sectors, more guards
      makeEnemy("bot", 8528, 960, 5),
      makeEnemy("drone", 8848, 1088, 5),
      makeEnemy("sentinel", 9600, 2304, 6),
      makeEnemy("bot", 9856, 2496, 6),
      makeEnemy("drone", 10048, 2304, 6),
      makeEnemy("bot", 10624, 960, 7),
      makeEnemy("sentinel", 10944, 1088, 7),
      makeEnemy("drone", 11200, 960, 7),
      makeEnemy("sentinel", 11648, 2304, 8),
      makeEnemy("bot", 11968, 2496, 8),
      makeEnemy("drone", 12224, 2304, 8),
      makeEnemy("sentinel", 12608, 1088, 9),
      makeEnemy("bot", 12864, 1216, 9),
      makeEnemy("drone", 13056, 1088, 9),
      // data-center guard robots (no server index; they wake when you come close)
      makeEnemy("sentinel", DATA_CENTER.x + 320, DATA_CENTER.y + 468, null),
      makeEnemy("bot", DATA_CENTER.x + 560, DATA_CENTER.y + 1208, null),
      makeEnemy("drone", DATA_CENTER.x + 880, DATA_CENTER.y + 368, null),
      makeEnemy("bot", DATA_CENTER.x + 1240, DATA_CENTER.y + 688, null),
      makeEnemy("sentinel", DATA_CENTER.x + 430, DATA_CENTER.y + 328, null),
      // infected animals wandering the open world
      makeEnemy("cat", 1792, 1856, null),
      makeEnemy("dog", 3968, 1856, null),
      makeEnemy("squirrel", 6208, 2496, null),
      makeEnemy("cat", 5040, 3000, null),
      makeEnemy("dog", 8480, 2688, null),
      makeEnemy("squirrel", 10432, 2496, null)
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
      alarmTimer: 0,
      undergroundMessage: 0,
      worldRestored: false,
      victoryTimer: 0,
      victoryAge: 0,
      inventoryOpen: false,
      inventoryScroll: 0,
      dataFeedCut: false,
      items: [],
      gems: [],
      chests: CHESTS.map((chest) => ({ ...chest, opened: false })),
      companionGate: { ...COMPANION_GATE, open: false },
      blockers,
      planks,
      servers,
      bossCores: makeBossCores(),
      bossRacks: makeBossRacks(),
      curtain: { x: DATA_CURTAIN.x, y: DATA_CURTAIN.y, w: DATA_CURTAIN.w, h: DATA_CURTAIN.h, down: false, messageShown: false, pulse: 0 },
      enemies,
      critters: makeCritters(),
      pickups: [
        { type: "flower", species: "daisy", x: 448, y: 640, r: 17, taken: false, bob: 0 },
        { type: "flower", species: "poppy", x: 1280, y: 1760, r: 17, taken: false, bob: 0.7 },
        { type: "flower", species: "cornflower", x: 3968, y: 1792, r: 17, taken: false, bob: 1.2 },
        { type: "flower", species: "violet", x: 3968, y: 2048, r: 17, taken: false, bob: 1.7 },
        { type: "flower", species: "clover", x: 3200, y: 1440, r: 17, taken: false, bob: 2.3 },
        { type: "flower", species: "dandelion", x: 3968, y: 1856, r: 17, taken: false, bob: 2.9 },
        { type: "flower", species: "bluebell", x: 4736, y: 1984, r: 17, taken: false, bob: 3.7 },
        { type: "flower", species: "forget", x: 5440, y: 1536, r: 17, taken: false, bob: 4.1 },
        { type: "flower", species: "buttercup", x: 6400, y: 768, r: 17, taken: false, bob: 4.6 },
        { type: "flower", species: "thistle", x: 7040, y: 2624, r: 17, taken: false, bob: 5.1 },
        { type: "flower", species: "chamomile", x: 7680, y: 2624, r: 17, taken: false, bob: 5.6 },
        { type: "spinach", x: 96, y: 1408, r: 16, taken: false, respawn: 0, bob: 0.4 },
        { type: "spinach", x: 1280, y: 2304, r: 16, taken: false, respawn: 0, bob: 2.4 },
        { type: "spinach", x: 3456, y: 1792, r: 16, taken: false, respawn: 0, bob: 1 },
        { type: "spinach", x: 6016, y: 768, r: 16, taken: false, respawn: 0, bob: 3 },
        { type: "spinach", x: 7616, y: 2624, r: 16, taken: false, respawn: 0, bob: 5 },
        { type: "nut", x: 1984, y: 2304, r: 12, taken: false, bob: 0.2 },
        { type: "nut", x: 3968, y: 2176, r: 12, taken: false, bob: 1.6 },
        { type: "nut", x: 4608, y: 1792, r: 12, taken: false, bob: 3.2 },
        { type: "nut", x: 6208, y: 2496, r: 12, taken: false, bob: 4.7 },
        { type: "nut", x: 7616, y: 2624, r: 12, taken: false, bob: 5.4 },
        { type: "elixir", x: 4480, y: 768, r: 15, taken: false, bob: 6.1 },
        { type: "stick", x: 2240, y: 416, r: 15, taken: false, bob: 0 },
        { type: "heart", x: 3136, y: 3776, r: 15, taken: false, bob: 0 }
      ],
      npcs: makeBeaverNpcs(),
      moles: makeMoles(),
      caterpillars: makeCaterpillars(),
      cables: makeCables(),
      intel: INTEL_DATA.map((spot) => ({ ...spot, taken: false, pulse: rand() * TAU })),
      cabins: CABINS.map((cabin) => ({ ...cabin, used: false })),
      hedges: makeSecretHedges(),
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
        speed: 216,
        facing: 0,
        punchCooldown: 0,
        throwCooldown: 0,
        feedCooldown: 0,
        useCooldown: 0,
        hurtCooldown: 0,
        shield: 0,
        tailLevel: 0,
        heldPlank: null,
        nuts: 0,
        hat: false,
        boots: false,
        book: false,
        longStick: false,
        tailLight: false,
        key: false,
        goldTeeth: false,
        dash: 0,
        step: 0,
        swimming: false,
        running: false
      }
    };

    // Flowers, nuts and resting planks stay put, centred in a single tile (no bobbing drift).
    for (const pk of game.pickups) {
      if (pk.type === "flower" || pk.type === "nut") {
        pk.x = Math.floor(pk.x / TILE) * TILE + TILE / 2;
        pk.y = Math.floor(pk.y / TILE) * TILE + TILE / 2;
      }
    }
    for (const pl of game.planks) {
      pl.x = Math.floor(pl.x / TILE) * TILE + TILE / 2;
      pl.y = Math.floor(pl.y / TILE) * TILE + TILE / 2;
      pl.angle = 0;
    }

    particles.length = 0;
    playerShots.length = 0;
    enemyShots.length = 0;
    floatText.length = 0;
    friendlyCritters.length = 0;
    followers.length = 0;
    dolphins.length = 0;
    sharks.length = 0;
    for (const patrol of SHARK_PATROLS) sharks.push({ ...patrol, t: patrol.phase * patrol.period, r: 26, biteCooldown: 0 });
    for (const stream of SMALL_STREAM_RECTS) {
      stream.bridged = false;
      stream.bridgeMessageShown = false;
      stream.goldenTimer = 35 + rand() * 45;
    }
    for (const item of decor) item.chewed = false;
    resolveActorCollisions();
  }

  // Room shape, door side and number of destroyable computers vary per server; later sites
  // are bigger and hold more cores, so difficulty climbs the deeper you push.
  function makeServer(site, index) {
    const w = site.tilesW * TILE;
    const h = site.tilesH * TILE;
    const doorTiles = site.tilesW >= 10 ? 4 : 2;
    const doorSide = ["bottom", "left", "top", "right", "bottom", "left", "top", "right", "bottom", "left"][index] || "bottom";
    const coreCount = index < 2 ? 1 : index < 5 ? 2 : index < 8 ? 3 : 4;
    const x = site.x + w / 2;
    const y = site.y + h / 2;
    const partition = index >= 3;
    return {
      x,
      y,
      w,
      h,
      tilesW: site.tilesW,
      tilesH: site.tilesH,
      wall: TILE,
      door: doorTiles * TILE,
      doorSide,
      partition,
      r: TILE * 0.72,
      destroyed: false,
      powered: true,
      doorOpen: false,
      doorHp: 5 + index * 0.55,
      doorMaxHp: 5 + index * 0.55,
      doorPulse: rand() * TAU,
      alarmCooldown: 0,
      num: index + 1,
      name: site.name,
      stone: site.stone,
      stoneDropped: false,
      cores: makeServerCores(site, x, y, w, h, coreCount, index),
      pulse: rand() * TAU
    };
  }

  // Cores are the destroyable computers; a room falls only when all of its cores are down.
  function makeServerCores(site, cx, cy, w, h, count, index) {
    const hp = 8 + index;
    const cores = [];
    const innerW = w - TILE * 3;
    if (count === 1) {
      cores.push({ x: cx, y: cy });
    } else if (count === 2) {
      cores.push({ x: cx - innerW * 0.26, y: cy }, { x: cx + innerW * 0.26, y: cy });
    } else if (count === 3) {
      cores.push({ x: cx - innerW * 0.3, y: cy - TILE }, { x: cx + innerW * 0.3, y: cy - TILE }, { x: cx, y: cy + TILE });
    } else {
      cores.push({ x: cx - innerW * 0.3, y: cy - TILE }, { x: cx + innerW * 0.3, y: cy - TILE }, { x: cx - innerW * 0.22, y: cy + TILE }, { x: cx + innerW * 0.22, y: cy + TILE });
    }
    return cores.map((c) => ({
      x: Math.round(c.x), y: Math.round(c.y), r: TILE * 0.7,
      hp, maxHp: hp, destroyed: false, pulse: rand() * TAU
    }));
  }

  function makeBossCores() {
    return BOSS_CORE_DATA.map((c) => ({
      x: c.x, y: c.y, r: TILE * 0.62, hp: 12, maxHp: 12, destroyed: false, pulse: rand() * TAU
    }));
  }

  function makeBossRacks() {
    const racks = [];
    const d = DATA_CENTER;
    const bossOuter = { x: BOSS_ROOM.x - TILE, y: BOSS_ROOM.y - TILE, w: BOSS_ROOM.w + TILE * 2, h: BOSS_ROOM.h + TILE * 2 };
    const entryLane = { x: d.x, y: DATA_CURTAIN.y - TILE, w: TILE * 6, h: DATA_CURTAIN.h + TILE * 2 };
    for (let y = d.y + TILE * 2; y < d.y + d.h - TILE * 2; y += TILE * 3) {
      for (let x = d.x + TILE * 2; x < d.x + d.w - TILE * 3; x += TILE * 3) {
        const rack = { x, y, w: TILE, h: TILE * 2 };
        if (rectsOverlap(rack, bossOuter) || rectsOverlap(rack, entryLane) || rectsOverlap(rack, DATA_CURTAIN)) continue;
        if (BOSS_CORE_DATA.some((c) => Math.hypot(x + 32 - c.x, y + 64 - c.y) < TILE * 1.7)) continue;
        racks.push({ ...rack, hp: 5.5, maxHp: 5.5, destroyed: false, pulse: rand() * TAU, scrapDropped: false });
      }
    }
    return racks;
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
      hp: 9,
      maxHp: 9,
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

  function isSurfaceAnimalType(type) {
    return type === "cat" || type === "dog" || type === "squirrel";
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
    const open = serverIndex === null && isSurfaceAnimalType(type) ? findOpenSpot(x, y, base.r + 6) : { x, y };

    return {
      type,
      x: open.x,
      y: open.y,
      ox: open.x,
      oy: open.y,
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


  // Stick-pile mini dams, each with a beaver who speaks in a quiet, mystical register about water.
  const MINI_DAMS = [
    { x: 1664, y: 2624, bx: 1768, by: 2600, name: "Bóbr Budowniczy",
      lines: [
        "Ten strumień ma tylko dwie miary szerokości. Połóż na nim deskę, a przejdziesz suchą łapą.",
        "Tama to nie mur na rzece, tylko rozmową z wodą. Maszyny takich rzeczy nie wiedzą."
      ] },
    { x: 4288, y: 3168, bx: 4392, by: 3140, name: "Bóbr od Wielkiej Tamy",
      lines: [
        "Slyszysz to brzęczenie pod ziemią? To nie pszczoły, to serwery liczące energię każdego drzewa.",
        "Budujemy tamy nie po to, by zatrzymac rzeke, lecz by las miał szansę odetchnąć."
      ] },
    { x: 6400, y: 3640, bx: 6500, by: 3620, name: "Bóbr Tamiarz",
      lines: [
        "Woda pamięta kształt lasu sprzed maszyn. Dlatego musimy pilnować jej brzegow.",
        "Gdy zgasisz wszystkie rdzenie, strumień znowu zaszumi po staremu."
      ] }
  ];

  function makeBeaverNpcs() {
    const beavers = [
      {
        name: "Bardzo Stary Bóbr", x: 392, y: 344, r: 22,
        // the first beaver speaks in Walden's voice — slow, simple, a little prophetic
        quotes: [
          "Jestem przekonany, ze gdyby wszyscy żyli w takiej prostocie jak ja nad stawem, to nie znano by złodziejstwa ani rabunku.",
          "Powiadam ci, niech twoje sprawy będą dwiema lub trzema, a nie stu lub tysiącem."
        ]
      },
      {
        name: "Cieśla Lokalnych Tam", x: 1280, y: 2048, r: 22,
        lines: [
          "Zbieraj kwiaty. Ogon rośnie powoli, ale każdy płatkowy sok dodaje siły.",
          "J chwyta lub kładzie deskę, K nią rzuca. L nakarmisz zdrowe zwierze."
        ]
      },
      {
        name: "Młody Zwiadowca", x: 352, y: 832, r: 21,
        lines: [
          "Nie spiesz sie do serwerowni. Najpierw poznaj mokre ścieżki i stare nory.",
          "Delfiny skacza tam, gdzie woda jest głęboka. Dopóki je widzisz, las jeszcze żyje."
        ]
      },
      {
        name: "Marian", x: 2368, y: 2592, r: 21,
        lines: [
          "Bramy maja elektryczne tarcze. Bez kabla przegryzionego pod ziemia nawet najdłuższy ogon nic nie wskóra.",
          "W każdym regionie powinna być osobna nora."
        ]
      },
      {
        name: "Bóbr Przeprawowy", x: 3968, y: 1472, r: 22,
        lines: [
          "Małe rzeczki da sie oszukac deskami; dwie dobrze ułożone na penwo wystarczą.",
          "Las pamięta każdy swoj kształt. Maszyny go policzyly, lecz nie rozumieją wyniku."
        ]
      },
      {
        name: "Bóbr z Górskiej Ścieżki", x: 6208, y: 704, r: 22,
        lines: [
          "Górskie serwerownie są większe i pilnuje ich więcej komputerów.",
          "Im wyżej zbudowana, tym dumniej brzęczy każda maszyna."
        ]
      },
      {
        name: "Bóbr Nad Rzeką", x: 7552, y: 2560, r: 22,
        lines: [
          "Podobno za ostatnimi drzewami stoi wielkie centrum danych, zabezpieczone elektryczną bramą.",
          "Taka brama to strach największej maszyny. Gdy padną wszystkie serwerownie padnie też i ona."
        ]
      },
      {
        name: "Bóbr Strażnik", x: 5568, y: 4032, r: 23, guardian: true,
        lines: [
          "Dalej nie wpuszczam samotników. Ukryte miejsca łatwo mieszają w samotnej głowie.",
          "Przyprowadź ze sobą wiewiórkę, sarenkę albo innego przyjaciela."
        ]
      }
    ];
    for (const dam of MINI_DAMS) {
      beavers.push({ name: dam.name, x: dam.bx, y: dam.by, r: 21, lines: dam.lines });
    }
    return beavers.map((b) => {
      const open = findOpenSpot(b.x, b.y, b.r);
      return { ...b, x: open.x, y: open.y, phase: rand() * TAU, talkCooldown: 0, lineIndex: 0 };
    });
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
    const animals = [
      { type: "deer", x: 1376, y: 960, r: 22, phase: rand() * TAU, dir: 0.2 },
      { type: "hare", x: 2600, y: 1376, r: 12, phase: rand() * TAU, dir: -0.4 },
      { type: "fox", x: 3808, y: 2944, r: 16, phase: rand() * TAU, dir: 0.8 },
      { type: "boar", x: 5248, y: 2624, r: 19, phase: rand() * TAU, dir: -0.6 },
      { type: "deer", x: 6784, y: 896, r: 22, phase: rand() * TAU, dir: 0.5 },
      { type: "hare", x: 8448, y: 2944, r: 12, phase: rand() * TAU, dir: 0.1 }
    ];
    return animals.map((animal) => {
      const open = findOpenSpot(animal.x, animal.y, animal.r + 6);
      return { ...animal, x: open.x, y: open.y };
    });
  }

  function makeCables() {
    return CABLE_DATA.map((cable) => ({ ...cable, cut: false, pulse: rand() * TAU }));
  }

  function makeSecretHedges() {
    const blocks = [];
    for (const rect of SECRET_HEDGE_RECTS) {
      for (let y = rect.y; y < rect.y + rect.h; y += TILE) {
        for (let x = rect.x; x < rect.x + rect.w; x += TILE) {
          blocks.push({
            ...rect,
            x,
            y,
            w: Math.min(TILE, rect.x + rect.w - x),
            h: Math.min(TILE, rect.y + rect.h - y),
            hp: 3,
            maxHp: 3,
            destroyed: false,
            pulse: rand() * TAU
          });
        }
      }
    }
    return blocks;
  }

  // True if a creature of radius r placed here would sit on water, a wall, a bush, a building, etc.
  function spotBlocked(x, y, r) {
    if (pointHitsAny(x, y, ALL_WATER_RECTS, r)) return true;
    if (pointHitsAny(x, y, TERRAIN_SOLIDS, r)) return true;
    if (pointHitsAny(x, y, SECRET_HEDGE_RECTS, r)) return true;
    if (pointHitsAny(x, y, SERVER_SITE_RECTS, r)) return true;
    if (pointInRect(x, y, DATA_CENTER, r)) return true;
    for (const cabin of CABINS) if (pointInRect(x, y, cabin, r + 24)) return true;
    for (const item of decor) {
      if (item.chewed || item.type === "flower") continue;
      const rad = item.type === "rock" ? item.r * 0.75 : item.r * 0.82;
      if (Math.hypot(x - item.x, y - item.y) < r + rad) return true;
    }
    return false;
  }

  // Nudges a desired spawn point to the nearest spot that is not on water/walls/bushes/buildings.
  function findOpenSpot(x, y, r) {
    if (!spotBlocked(x, y, r)) return { x, y };
    for (let ring = 1; ring <= 14; ring += 1) {
      const rad = ring * 44;
      for (let a = 0; a < 16; a += 1) {
        const nx = x + Math.cos(a * TAU / 16) * rad;
        const ny = y + Math.sin(a * TAU / 16) * rad;
        if (nx < 220 || ny < 320 || nx > WORLD_W - 220 || ny > SURFACE_BOTTOM - 220) continue;
        if (!spotBlocked(nx, ny, r)) return { x: nx, y: ny };
      }
    }
    return { x, y };
  }

  // Healthy, un-infected animals roaming the open forest; feed one a nut to gain a companion.
  function makeCritters() {
    const spots = [
      { type: "rabbit", x: 1700, y: 900, r: 12 },
      { type: "hedgehog", x: 2400, y: 2480, r: 12 },
      { type: "fawn", x: 4400, y: 2780, r: 18 },
      { type: "squirrel", x: 5050, y: 950, r: 12 },
      { type: "rabbit", x: 7400, y: 900, r: 12 },
      { type: "fawn", x: 8640, y: 3640, r: 18 },
      { type: "squirrel", x: 5408, y: 3904, r: 13 },
      { type: "rabbit", x: 10048, y: 896, r: 12 }
    ];
    return spots.map((s) => {
      const open = findOpenSpot(s.x, s.y, s.r + 6);
      return { type: s.type, r: s.r, x: open.x, y: open.y, ox: open.x, oy: open.y, phase: rand() * TAU, dir: rand() * TAU, near: false };
    });
  }

  function buildDecor() {
    const items = [];

    const fixedGapSpots = [
      { x: 230, y: 300, r: 440 },
      { x: 352, y: 832, r: 150 },
      { x: 288, y: 1760, r: 120 },
      { x: 384, y: 2208, r: 170 },
      { x: 1184, y: 1920, r: 140 },
      { x: 1280, y: 2048, r: 140 },
      { x: 448, y: 640, r: 96 },
      { x: 96, y: 1408, r: 96 },
      { x: 1280, y: 1760, r: 106 },
      { x: 1280, y: 2304, r: 106 },
      { x: 1056, y: 2240, r: 122 },
      { x: 1728, y: 1920, r: 122 },
      { x: 2304, y: 2496, r: 122 },
      { x: 2944, y: 2176, r: 122 }
    ];

    const canPlaceDecor = (x, y, r, spacing) => {
      const test = { x: x - r - 18, y: y - r - 18, w: (r + 18) * 2, h: (r + 18) * 2 };
      if (rectHitsAny(test, PLACEMENT_BLOCKERS) || rectHitsAny(test, ROAD_RECTS)) return false;
      if (x < 900 && y < 520) return false;
      if (fixedGapSpots.some((spot) => Math.hypot(x - spot.x, y - spot.y) < spot.r + r)) return false;
      return !items.some((item) => Math.hypot(item.x - x, item.y - y) < spacing);
    };

    const addDecor = (type, x, y, opts = {}) => {
      const r = opts.r || (type === "bush" ? 22 + rand() * 13 : type === "rock" ? 10 + rand() * 10 : 8 + rand() * 5);
      const spacing = opts.spacing || (type === "flower" ? 104 : 186);
      if (!canPlaceDecor(x, y, r, spacing)) return false;
      items.push({
        type,
        x,
        y,
        r,
        chewable: type === "bush" && !!opts.chewable,
        chewed: false,
        species: type === "flower" ? (opts.species || FLOWER_LIBRARY[Math.floor(rand() * FLOWER_LIBRARY.length)].id) : null,
        hue: rand(),
        phase: rand() * TAU
      });
      return true;
    };

    const openingPatches = [
      [320, 608, "flower", "forget"], [544, 864, "flower", "buttercup"], [192, 1232, "flower", "dandelion"],
      [544, 1504, "bush"], [256, 2048, "flower", "chamomile"], [640, 2368, "bush"],
      [960, 1728, "flower", "violet"], [1472, 1888, "bush"], [1856, 2112, "flower", "cornflower"],
      [2496, 2368, "flower", "bluebell"], [3136, 2304, "bush"]
    ];
    const meadowPatches = [
      [1536, 2240, "flower", "buttercup"], [1888, 1856, "flower", "daisy"], [2240, 2240, "bush"],
      [2560, 2112, "flower", "violet"], [3200, 1984, "bush"], [3392, 2176, "flower", "cornflower"],
      [3968, 2048, "flower", "chamomile"], [4288, 1792, "bush"], [4672, 2496, "flower", "bluebell"],
      [5056, 2688, "bush"], [5632, 2304, "flower", "thistle"], [6208, 2304, "bush"],
      [6592, 2496, "flower", "clover"], [7168, 960, "flower", "dandelion"], [7488, 2496, "bush"],
      [8320, 2304, "flower", "poppy"], [8768, 2496, "bush"], [9344, 3008, "flower", "forget"],
      [9856, 2816, "bush"], [10432, 2304, "flower", "buttercup"], [11136, 2496, "bush"],
      [11840, 2816, "flower", "violet"], [12416, 2304, "bush"], [12864, 2816, "flower", "chamomile"]
    ];
    for (const [x, y, type, species] of openingPatches.concat(meadowPatches)) {
      addDecor(type, x, y, { species, spacing: type === "flower" ? 126 : 214 });
    }

    for (let x = 1536; x < WORLD_W - 512; x += 512) {
      const baseY = 1984 + Math.sin(x * 0.0017) * 560 + (tileHash(x, 2048) - 0.5) * 520;
      addDecor("flower", x + 64, clamp(Math.round(baseY / TILE) * TILE + TILE / 2, 672, SURFACE_BOTTOM - 384), { spacing: 150 });
      if (tileHash(x, 3008) > 0.38) addDecor("bush", x + 256, clamp(Math.round((baseY + 320) / TILE) * TILE + TILE / 2, 704, SURFACE_BOTTOM - 320), { spacing: 230 });
    }

    let attempts = 0;
    while (items.length < 560 && attempts < 26000) {
      attempts += 1;
      const x = Math.floor((1 + rand() * (WORLD_W / TILE - 2))) * TILE + TILE / 2;
      const y = Math.floor((1 + rand() * (SURFACE_BOTTOM / TILE - 2))) * TILE + TILE / 2;
      if (x < 900 && y < 520) continue;
      if (x < 3904 && rand() < 0.34) continue;
      const typeRoll = rand();
      let type = "bush";
      if (typeRoll > 0.56) type = "flower";
      if (typeRoll > 0.86) type = "rock";
      const r = type === "bush" ? 21 + rand() * 13 : 8 + rand() * 12;
      const spacing = type === "flower" ? 108 : 210;
      if (!canPlaceDecor(x, y, r, spacing)) continue;
      const chewable = type === "bush" && rand() < 0.08;
      items.push({
        type,
        x,
        y,
        r,
        chewable,
        chewed: false,
        species: type === "flower" ? FLOWER_LIBRARY[Math.floor(rand() * FLOWER_LIBRARY.length)].id : null,
        hue: rand(),
        phase: rand() * TAU
      });
    }

    // No greenery is hand-placed inside the active data centre; it should feel mechanical until the boss falls.
    const lagoonIslandTrees = [[8680, 3548], [8560, 3548], [8928, 3988], [9024, 4112], [10240, 3904], [10944, 3904]];
    for (const [x, y] of lagoonIslandTrees) addDecor("bush", x, y, { r: 28, spacing: 170 });
    return items;
  }

  function buildTerrainDots() {
    const dots = [];
    for (let i = 0; i < 520; i += 1) {
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
    if (game.inventoryOpen) { updateParticles(dt); return; }
    updatePlayer(dt);
    if (game.area === "surface") {
      updateNpcs(dt);
      updatePickups(dt);
      updatePlanks(dt);
      updateStreams(dt);
      updateBlockers(dt);
      updateEnemies(dt);
      updateCritters(dt);
      updateFollowers(dt);
      updateDolphins(dt);
      updateSharks(dt);
      updateIntel(dt);
      updateWildlife(dt);
      updateBoss(dt);
      updateShots(dt);
      updateCurtain(dt);
    } else {
      updateMoles(dt);
      updateCaterpillars(dt);
      updateIntel(dt);
    }
    resolveActorCollisions();
    updateParticles(dt);
    updateFloatText(dt);
    updateCamera(dt);

    if (game.player.hp <= 0) {
      game.state = "dead";
      game.message = "EKSPANSJA MASZYN NIE ZOSTAŁA POWSTRZYMANA";
      game.messageTimer = 999;
      playTone("down");
    }
  }

  function currentBounds() {
    return game.area === "underground" ? { w: UNDER_W, h: UNDER_H } : { w: WORLD_W, h: SURFACE_BOTTOM };
  }

  function circleInTunnels(entity, margin = 0) {
    const grace = game && entity === game.player ? 8 : 3;
    return UNDER_TUNNELS.some((rect) => pointInRect(entity.x, entity.y, rect, grace + margin));
  }

  function tryUseBurrow() {
    const p = game.player;
    if (p.useCooldown > 0) return false;
    let best = null;
    let bestDistance = 62;
    const list = game.area === "surface"
      ? BURROWS
      : BURROWS.filter((burrow) => burrow.label === game.activeBurrow).map((burrow) => ({ ...burrow, x: burrow.ux, y: burrow.uy }));
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
      clearFollowers("burrow");
      game.message = "SCHODZISZ DO NORY";
    } else {
      const surface = BURROWS.find((burrow) => burrow.label === best.label) || BURROWS[0];
      game.area = "surface";
      game.activeBurrow = null;
      p.x = surface.x;
      p.y = surface.y + 42;
      game.message = "WRACASZ NA POWIERZCHNIĘ";
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
    }

    const waterBefore = playerInWater(p);
    const wantsRun = keys.has("ShiftLeft") || keys.has("ShiftRight") || keys.has("KeyB");
    const running = wantsRun && !waterBefore;
    const speed = p.speed * (p.shield > 0 ? 0.96 : 1) * (waterBefore ? 0.88 : 1) * (game.area === "underground" ? 0.92 : 1) * (running ? 1.38 : 1);
    p.running = !!(running && (dx || dy));
    if (dx || dy) p.step += dt * (p.running ? 18 : 12);
    moveCircle(p, dx * speed * dt, dy * speed * dt);
    p.swimming = playerInWater(p);
    if (p.swimming) p.running = false;
    if (p.swimming) clearFollowers("water");

    if (!game.defenseAwake && game.introTimer <= 0) {
      const roomIndex = game.servers.findIndex((server) => !server.destroyed && pointInRoom(server, p, 6));
      if (roomIndex >= 0) wakeDefense(roomIndex);
    }

    p.punchCooldown = Math.max(0, p.punchCooldown - dt);
    p.throwCooldown = Math.max(0, p.throwCooldown - dt);
    p.feedCooldown = Math.max(0, p.feedCooldown - dt);
    p.useCooldown = Math.max(0, p.useCooldown - dt);
    p.hurtCooldown = Math.max(0, p.hurtCooldown - dt);
    p.shield = Math.max(0, p.shield - dt); // spinach shield lasts about a minute

    if (keys.has("KeyE")) {
      if (!tryUseBurrow()) grabPlank();
    }
    if (keys.has("Space")) punch();
  }

  function moveCircle(entity, dx, dy) {
    const oldX = entity.x;
    const oldY = entity.y;
    const bounds = currentBounds();
    if (game.area === "underground") {
      entity.x = clamp(oldX + dx, entity.r + 18, bounds.w - entity.r - 18);
      entity.y = oldY;
      if (!circleInTunnels(entity)) entity.x = oldX;
      const afterX = entity.x;
      entity.y = clamp(oldY + dy, entity.r + 18, bounds.h - entity.r - 18);
      if (!circleInTunnels(entity)) entity.y = oldY;
      entity.x = afterX;
      return;
    }

    entity.x = clamp(entity.x + dx, entity.r + 18, bounds.w - entity.r - 18);
    entity.y = clamp(entity.y + dy, entity.r + 18, bounds.h - entity.r - 18);

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

    if (game.companionGate && !game.companionGate.open) pushOutOfRect(entity, game.companionGate);

    for (const chest of game.chests) {
      if (!chest.opened) pushOutOfRect(entity, chest);
    }

    for (const cabin of game.cabins) {
      for (const wall of cabinWalls(cabin)) pushOutOfRect(entity, wall);
    }

    for (const wall of dataCenterWalls()) pushOutOfRect(entity, wall);
    for (const rack of game.bossRacks || []) {
      if (!rack.destroyed) pushOutOfRect(entity, rack);
    }

    if (isSurfaceAnimalType(entity.type) && pointHitsAny(entity.x, entity.y, ALL_WATER_RECTS, entity.r * 0.8)) {
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
      if (!server.doorOpen) pushOutOfRect(entity, doorRect(server));
      for (const core of server.cores) {
        if (core.destroyed) continue;
        const push = entity.r + core.r * 0.82 - Math.hypot(entity.x - core.x, entity.y - core.y);
        if (push > 0) {
          const a = Math.atan2(entity.y - core.y, entity.x - core.x);
          entity.x += Math.cos(a) * push;
          entity.y += Math.sin(a) * push;
        }
      }
    }

    // the electric curtain seals the data centre until every outer server room is down
    if (!game.curtain.down && !game.worldRestored) pushOutOfRect(entity, game.curtain);

    for (const wall of bossRoomWalls()) pushOutOfRect(entity, wall);
    for (const core of game.bossCores) {
      if (core.destroyed) continue;
      const push = entity.r + core.r * 0.82 - Math.hypot(entity.x - core.x, entity.y - core.y);
      if (push > 0) {
        const a = Math.atan2(entity.y - core.y, entity.x - core.x);
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
    if (tryTalkToBeaver() || tryInteractCabin() || tryOpenChest() || tryEatCaterpillar()) {
      p.punchCooldown = 0.34;
      return;
    }
    // fed animals stay with you while you fight; they only bolt if you swim or get hit
    p.punchCooldown = 0.46;
    camera.shake = Math.max(camera.shake, 2);
    playTone("punch");

    const biteReach = (p.longStick ? 44 : 27) + Math.min(18, p.tailLevel * 1.35);
    const hit = {
      x: p.x + Math.cos(p.facing) * biteReach,
      y: p.y + Math.sin(p.facing) * biteReach,
      r: 24
    };
    const damage = (1.7 + p.tailLevel * 0.34) * (p.goldTeeth ? 1.28 : 1);

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
    plank.angle = 0;
    plank.bridgeStreamIndex = null;
    const snapped = plank.metal ? false : snapPlankToStream(plank);
    if (!snapped) {
      // a resting plank settles flat in the centre of a tile
      plank.x = Math.floor(plank.x / TILE) * TILE + TILE / 2;
      plank.y = Math.floor(plank.y / TILE) * TILE + TILE / 2;
    }
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
      damage: p.heldPlank.metal ? 8.8 + p.tailLevel * 0.25 : 6.4 + p.tailLevel * 0.35,
      life: 1.45,
      angle: p.facing,
      spin: p.heldPlank.metal ? 9 : 7,
      color: p.heldPlank.metal ? "#9ca7aa" : palette.plank,
      metal: !!p.heldPlank.metal
    });
    p.heldPlank = null;
    camera.shake = Math.max(camera.shake, 3);
    playTone("shoot");
  }

  const CRITTER_NAMES = { rabbit: "KRÓLIK", hedgehog: "JEŻYK", fawn: "SARENKA", squirrel: "WIEWIÓRKA", duck: "KACZKA" };
  const CRITTER_BYES = [
    "Dziękuję za orzeszka, bobrze. Wracam do domu.",
    "Bylo miło, ale boję się wody. Nic tu po mnie!",
    "Najadłem się, pora na zasłużoną drzemkę."
  ];

  // Approach a healthy animal and feed it a nut; it tags along until you swim, get hit, or 3 min pass.
  function feedAnimal() {
    const p = game.player;
    if (p.feedCooldown > 0) return;
    if (game.area !== "surface") return;
    p.feedCooldown = 0.4;
    let best = null;
    let bestDistance = 80;
    for (const critter of game.critters) {
      const d = Math.hypot(critter.x - p.x, critter.y - p.y);
      if (d < bestDistance) {
        best = critter;
        bestDistance = d;
      }
    }
    if (!best) {
      game.message = "PODEJDŹ DO ZWIERZAKA, BY GO NAKARMIĆ";
      game.messageTimer = 1.4;
      playTone("blocked");
      return;
    }
    if (p.nuts <= 0) {
      game.message = "POTRZEBUJESZ ORZESZKA";
      game.messageTimer = 1.4;
      playTone("blocked");
      return;
    }
    p.nuts -= 1;
    game.critters.splice(game.critters.indexOf(best), 1);
    followers.push({
      type: best.type,
      x: best.x,
      y: best.y,
      r: best.r,
      phase: rand() * TAU,
      life: 180,
      slot: followers.length,
      bye: CRITTER_BYES[Math.floor(rand() * CRITTER_BYES.length)]
    });
    game.message = (CRITTER_NAMES[best.type] || "ZWIERZAK") + " IDZIE ZA TOBA";
    game.messageTimer = 2;
    p.facing = Math.atan2(best.y - p.y, best.x - p.x);
    burst(best.x, best.y, 22, "#f2d58a");
    playTone("pickup");
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
    if (hurtShark(hit, direction)) return;

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

    if (hurtServerDoors(hit, damage)) return;
    if (hurtBossRacks(hit, damage, direction)) return;
    if (hurtSecretHedges(hit, damage, direction)) return;

    for (let i = 0; i < game.servers.length; i += 1) {
      const server = game.servers[i];
      if (server.destroyed) continue;
      for (const core of server.cores) {
        if (!core.destroyed && circleHit(hit, core, 8)) hurtServerCore(server, core, i, damage);
      }
    }

    for (const core of game.bossCores) {
      if (!core.destroyed && circleHit(hit, core, 8)) hurtBossCore(core, damage);
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


  function hurtServerDoors(hit, damage) {
    for (const server of game.servers) {
      if (server.destroyed || server.doorOpen) continue;
      const door = doorRect(server);
      if (!rectCircleHit(hit, door, 9)) continue;
      server.doorHp -= damage;
      server.doorPulse += 1.1;
      burst(hit.x, hit.y, 12, "#d9d1bd");
      playTone("hit");
      if (server.doorHp <= 0) {
        server.doorOpen = true;
        game.message = "DRZWI DO #" + server.num + " PRZEGRYZIONE";
        game.messageTimer = 2;
        burst(door.x + door.w / 2, door.y + door.h / 2, 30, palette.plank);
        playTone("objectBreak");
      } else {
        game.message = "GRYZIESZ DRZWI #" + server.num;
        game.messageTimer = 1.2;
      }
      return true;
    }
    return false;
  }

  function makeWirePlate(x, y) {
    return {
      x, y, r: 24, w: 54, h: 28, taken: false, bob: rand() * TAU,
      angle: rand() > 0.5 ? 0.08 : -0.08, bridgeStreamIndex: null, metal: true
    };
  }

  function hurtBossRacks(hit, damage, direction) {
    for (const rack of game.bossRacks || []) {
      if (rack.destroyed || !rectCircleHit(hit, rack, 8)) continue;
      rack.hp -= damage;
      rack.pulse += 1.2;
      burst(hit.x, hit.y, 12, "#9ca7aa");
      playTone("hit");
      if (rack.hp <= 0) {
        rack.destroyed = true;
        game.planks.push(makeWirePlate(rack.x + rack.w / 2 + Math.cos(direction) * 18, rack.y + rack.h / 2 + Math.sin(direction) * 18));
        game.message = "RACK ROZBITY: BLACHA DRUCIANA";
        game.messageTimer = 2;
        burst(rack.x + rack.w / 2, rack.y + rack.h / 2, 32, "#9ca7aa");
        playTone("objectBreak");
      } else {
        game.message = "RACK TRZESZCZY";
        game.messageTimer = 1.1;
      }
      return true;
    }
    return false;
  }

  function hurtSecretHedges(hit, damage, direction) {
    for (const hedge of game.hedges) {
      if (hedge.destroyed || !rectCircleHit(hit, hedge, 8)) continue;
      hedge.hp -= damage;
      hedge.pulse += 1.2;
      burst(hit.x, hit.y, 12, "#7ff06c");
      playTone("hit");
      if (hedge.hp <= 0) {
        hedge.destroyed = true;
        const plank = makePlank(hedge.x + hedge.w / 2 + Math.cos(direction) * 12, hedge.y + hedge.h / 2 + Math.sin(direction) * 12);
        plank.angle = direction + 0.2;
        game.planks.push(plank);
        game.message = "KRZAK PRZEGRYZIONY: DREWNO";
        game.messageTimer = 1.8;
        burst(hedge.x + hedge.w / 2, hedge.y + hedge.h / 2, 28, palette.leafLight);
        playTone("objectBreak");
      }
      return true;
    }
    return false;
  }

  function cableCutForServer(index) {
    return game.cables.some((cable) => cable.serverIndex === index && cable.cut);
  }

  function blockerPowered(blocker) {
    return blocker.serverIndex !== null && blocker.serverIndex !== undefined && !cableCutForServer(blocker.serverIndex);
  }

  function hurtBlocker(blocker, damage) {
    if (blockerPowered(blocker)) {
      blocker.pulse += 1.4;
      game.message = "BRAMA POD NAPIECIEM: ZNAJDZ KABEL W NORZE";
      game.messageTimer = 2.4;
      burst(blocker.cx, blocker.cy, 12, palette.aiBlue);
      playTone("blocked");
      return;
    }
    if (!blocker.awake) {
      blocker.awake = true;
      blocker.shootCooldown = 0.9;
      game.message = blocker.name + " AKTYWNY";
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
      game.message = blocker.name + " OTWARTA";
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

  function serverGuardsAlive(index) {
    return game.enemies.filter((enemy) => enemy.serverIndex === index && enemy.hp > 0).length;
  }

  function hurtServerCore(server, core, index, damage) {
    const guards = serverGuardsAlive(index);
    if (guards > 0) {
      wakeDefense(index);
      server.pulse += 0.7;
      core.pulse += 0.8;
      game.message = "#" + server.num + " " + server.name + ": NAJPIERW STRAŻNICY (" + guards + ")";
      game.messageTimer = 2.1;
      burst(core.x, core.y, 8, palette.aiPink);
      playTone("blocked");
      return;
    }
    wakeDefense(index);
    core.hp -= server.powered ? damage : damage * 1.35;
    core.pulse += 0.9;
    server.pulse += 0.5;
    camera.shake = Math.max(camera.shake, 5);
    burst(core.x, core.y, 12, palette.aiBlue);
    playTone("core");

    for (const enemy of game.enemies) {
      if (enemy.serverIndex === index) enemy.aggro = true;
    }

    if (core.hp <= 0 && !core.destroyed) {
      core.destroyed = true;
      core.hp = 0;
      burst(core.x, core.y, 30, palette.leafLight);
      camera.shake = Math.max(camera.shake, 8);
      playTone("objectBreak");
    }
    if (server.cores.every((c) => c.destroyed) && !server.destroyed) {
      server.destroyed = true;
      game.message = "#" + server.num + " " + server.name + " DOWN";
      game.messageTimer = 2.6;
      burst(server.x, server.y, 64, palette.leafLight);
      camera.shake = Math.max(camera.shake, 14);
      playTone("objectBreak");
      playTone("restore");
      spawnFriendlyRing(server.x, server.y);
      dropServerStone(server);
      checkCurtain();
    }
  }

  // A colourful gem appears at the centre of a conquered server room; pick it up to read its lore.
  function dropServerStone(server) {
    if (server.stoneDropped || !server.stone) return;
    server.stoneDropped = true;
    game.gems.push({
      x: server.x, y: server.y, r: 16,
      label: server.stone.label, color: server.stone.color, desc: server.stone.desc,
      pulse: rand() * TAU, taken: false
    });
  }

  function checkCurtain() {
    if (game.curtain.down) return;
    if (game.servers.every((s) => s.destroyed)) {
      game.curtain.down = true;
      game.message = "ZASŁONA ELEKTRYCZNA OPADA";
      game.messageTimer = 3;
      camera.shake = Math.max(camera.shake, 12);
      burst(game.curtain.x + game.curtain.w / 2, game.curtain.y + game.curtain.h / 2, 60, palette.aiBlue);
      playTone("restore");
    }
  }

  function hurtBossCore(core, damage) {
    wakeDefense(null);
    core.hp -= damage;
    core.pulse += 1;
    camera.shake = Math.max(camera.shake, 5);
    burst(core.x, core.y, 12, palette.aiViolet);
    playTone("core");
    if (core.hp <= 0 && !core.destroyed) {
      core.destroyed = true;
      core.hp = 0;
      burst(core.x, core.y, 40, "#9ca7aa");
      camera.shake = Math.max(camera.shake, 10);
      playTone("objectBreak");
      const left = bossCoresLeftCount();
      game.message = left > 0 ? "WĘZEŁ AI PADŁ: ZOSTAŁO " + left : "RDZEŃ AI ODSLONIĘTY";
      game.messageTimer = 2.2;
      playTone(left > 0 ? "restore" : "exposed");
    }
  }

  function hurtBoss(damage) {
    wakeDefense(null);
    const boss = game.boss;
    const coresLeft = bossCoresLeftCount();
    if (coresLeft > 0) {
      boss.hitFlash = 0.12;
      game.message = "TARCZA AI: ZNISZCZ " + coresLeft + " WĘZŁÓW";
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
    game.curtain.down = true;
    for (const server of game.servers) {
      server.destroyed = true;
      server.powered = false;
      for (const core of server.cores) core.destroyed = true;
      server.doorOpen = true;
    }
    for (const core of game.bossCores) core.destroyed = true;
    for (const rack of game.bossRacks || []) rack.destroyed = true;
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
    const p = game.player;
    for (const pickup of game.pickups) {
      // only the special floating items still bob; flowers/nuts stay still in their tile
      if (pickup.type === "spinach" || pickup.type === "elixir" || pickup.type === "stick" || pickup.type === "heart") pickup.bob += dt * 3;
      if (pickup.taken) {
        if (pickup.type === "spinach") {
          pickup.respawn -= dt;
          if (pickup.respawn <= 0) pickup.taken = false;
        }
        continue;
      }
      if (circleHit(p, pickup, 8)) {
        pickup.taken = true;
        if (pickup.type === "flower") {
          p.tailLevel += 0.25;
          const flower = flowerInfo(pickup.species);
          game.message = flower.label;
          game.messageTimer = 2.4;
          burst(pickup.x, pickup.y, 30, flower.petals);
          playTone("pickup");
        } else if (pickup.type === "nut") {
          p.nuts = Math.min(6, p.nuts + 1);
          game.message = "ORZESZEK";
          game.messageTimer = 1.6;
          burst(pickup.x, pickup.y, 18, "#b77b43");
          playTone("pickup");
        } else if (pickup.type === "elixir") {
          p.tailLevel = Math.max(2, p.tailLevel * 2);
          game.message = "ELIKSIR OGONA";
          game.messageTimer = 2.8;
          burst(pickup.x, pickup.y, 48, palette.aiViolet);
          playTone("restore");
        } else if (pickup.type === "stick") {
          p.longStick = true;
          addItem("stick");
          game.message = "SUPER DŁUGI PATYK";
          game.messageTimer = 2.8;
          burst(pickup.x, pickup.y, 40, palette.plank);
          playTone("restore");
        } else if (pickup.type === "heart") {
          p.maxHp += 2;
          p.hp = p.maxHp;
          game.message = "SERCE LASU";
          game.messageTimer = 2.8;
          burst(pickup.x, pickup.y, 44, palette.red);
          playTone("restore");
        } else {
          pickup.respawn = 24;
          p.shield = 60;
          game.message = "SZPINAK";
          game.messageTimer = 1.9;
          burst(pickup.x, pickup.y, 28, palette.spinach);
          playTone("shield");
        }
      }
    }

    // colourful gems left by toppled server rooms
    for (const gem of game.gems) {
      if (gem.taken) continue;
      gem.pulse += dt * 3;
      if (circleHit(p, gem, 10)) {
        gem.taken = true;
        addItem("gem", gem);
        game.message = gem.label;
        game.messageTimer = 2.4;
        burst(gem.x, gem.y, 30, gem.color);
        playTone("pickup");
      }
    }
  }

  // Adds a described item to the inventory (deduplicated). Items carry effects elsewhere.
  function addItem(id, extra) {
    if (id !== "gem" && id !== "intel" && game.items.some((it) => it.id === id)) return;
    let entry;
    if (id === "gem") entry = { id: "gem", label: extra.label, desc: extra.desc, color: extra.color };
    else if (id === "intel") entry = { id: "intel", label: extra.label, desc: extra.desc, color: extra.color || "#9fe7ff" };
    else entry = { id, ...ITEM_LIBRARY[id] };
    game.items.push(entry);
  }

  function updateCurtain(dt) {
    game.curtain.pulse += dt * 4;
    if (game.curtain.down) return;
    const p = game.player;
    const cx = game.curtain.x + game.curtain.w / 2;
    const cy = game.curtain.y + game.curtain.h / 2;
    if (Math.hypot(p.x - cx, p.y - cy) < 150 && !game.curtain.messageShown) {
      game.curtain.messageShown = true;
      game.message = "ZASŁONA ELEKTRYCZNA: ZNISZCZ WSZYSTKIE SERWEROWNIE (" + serversLeftCount() + ")";
      game.messageTimer = 3;
      playTone("blocked");
    } else if (Math.hypot(p.x - cx, p.y - cy) > 240) {
      game.curtain.messageShown = false;
    }
  }

  function updateCritters(dt) {
    const p = game.player;
    for (const critter of game.critters) {
      critter.phase += dt * 2;
      if (rand() < dt * 0.4) critter.dir += (rand() - 0.5) * 1.1;
      const oldX = critter.x;
      const oldY = critter.y;
      const speed = critter.type === "fawn" ? 22 : critter.type === "hedgehog" ? 12 : 26;
      // critters mill around their home and shy away from water/walls
      if (Math.hypot(critter.x - critter.ox, critter.y - critter.oy) > 150) critter.dir = angleTo(critter, { x: critter.ox, y: critter.oy });
      critter.x += Math.cos(critter.dir) * speed * dt;
      critter.y += Math.sin(critter.dir) * speed * dt;
      // never let a critter end up on water, a wall, a building or inside a bush
      if (spotBlocked(critter.x, critter.y, critter.r + 4)) {
        critter.x = oldX;
        critter.y = oldY;
        critter.dir += Math.PI * 0.7;
      }
      // a friendly prompt when you are close enough to feed it
      critter.near = Math.hypot(critter.x - p.x, critter.y - p.y) < 80;
    }
  }

  function enemyShotDelay(enemy) {
    const base = enemy.type === "sentinel" ? 1.85 : 2.15;
    const cleared = game.servers.filter((server) => server.destroyed).length;
    if (enemy.serverIndex === null || cleared >= 4) return base * 0.78;
    if (enemy.serverIndex >= 3) return base * 0.9;
    return base;
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
        enemy.shootCooldown = enemyShotDelay(enemy);
        shootEnemy(enemy, p);
      }

      if (enemy.aggro && circleHit(enemy, p, 2)) {
        hurtPlayer(enemy.damage, angleTo(enemy, p));
      }
    }

    for (const critter of friendlyCritters) {
      critter.phase += dt * 3.4;
      if (!critter.permanent) critter.life -= dt;
      const ox = critter.x;
      const oy = critter.y;
      const speed = critter.permanent ? 18 : 9;
      if (critter.permanent && rand() < dt * 0.4) critter.dir = (critter.dir || 0) + (rand() - 0.5) * 1.2;
      const ang = critter.permanent ? critter.dir : critter.phase;
      critter.x += Math.cos(ang) * speed * dt;
      critter.y += Math.sin(ang) * speed * dt;
      // freed animals never wander onto water or into bushes/walls
      if (spotBlocked(critter.x, critter.y, critter.r + 4)) {
        critter.x = ox;
        critter.y = oy;
        if (critter.permanent) critter.dir += Math.PI * 0.7;
      }
    }
    for (let i = friendlyCritters.length - 1; i >= 0; i -= 1) {
      if (!friendlyCritters[i].permanent && friendlyCritters[i].life <= 0) friendlyCritters.splice(i, 1);
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
    if (best.guardian) {
      const allowed = followers.length > 0;
      if (allowed) {
        game.companionGate.open = true;
        game.message = best.name;
        game.messageTimer = 4.2;
        game.dialogLines = ["Widze, że masz ze sobą przyjaciela. Przejdz cicho a być może znajdziesz coś, czego nie potrafią używać."];
        game.dialogTimer = 5.8;
        playTone("restore");
      } else {
        game.message = best.name;
        game.messageTimer = 4.2;
        game.dialogLines = [best.lines[(best.lineIndex || 0) % best.lines.length]];
        best.lineIndex = (best.lineIndex || 0) + 1;
        game.dialogTimer = 5.8;
        playTone("blocked");
      }
      p.facing = Math.atan2(best.y - p.y, best.x - p.x);
      return true;
    }
    // Deterministic: each NPC cycles through its lines in order (no randomness in what it says).
    const quotes = best.quotes;
    const pool = quotes || best.lines || best.facts;
    best.lineIndex = (best.lineIndex || 0);
    const line = pool[best.lineIndex % pool.length];
    best.lineIndex += 1;
    game.message = best.name;
    game.messageTimer = 4.2;
    // the first beaver's Walden quotes are shown whole; everyone else stays within two sentences
    game.dialogLines = [quotes ? line : capSentences(line, 2)];
    game.dialogTimer = quotes ? 7 : 5.4;
    p.facing = Math.atan2(best.y - p.y, best.x - p.x);
    playTone("pickup");
    return true;
  }

  // Trims any text down to at most `max` sentences so nobody monologues.
  function capSentences(text, max) {
    const parts = text.match(/[^.!?]+[.!?]?/g);
    if (!parts) return text;
    return parts.slice(0, max).join("").trim();
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
    game.message = "GĄSIENICA";
    game.messageTimer = 1.6;
    burst(best.x, best.y, 18, "#b7d86a");
    playTone("pickup");
    return true;
  }

  // Followers scatter when you swim or get hurt (reason set), and wave goodbye as they go.
  function clearFollowers(reason) {
    if (!followers.length) return;
    if (reason === "water" || reason === "hurt" || reason === "burrow") {
      for (const follower of followers) sayFollowerBye(follower);
      game.message = reason === "water" ? "ZWIERZĘTA NIE WCHODZA DO WODY"
        : reason === "burrow" ? "ZWIERZĘTA ZOSTAJĄ NA POWIERZCHNI"
        : "ZWIERZĘTA SPŁOSZONE";
      game.messageTimer = 1.6;
    }
    followers.length = 0;
  }

  function sayFollowerBye(follower) {
    if (!follower.bye) return;
    floatText.push({ x: follower.x, y: follower.y - 22, text: follower.bye, color: palette.cream, life: 2.4, maxLife: 2.4 });
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
      if (followers[i].life <= 0) {
        sayFollowerBye(followers[i]);
        followers.splice(i, 1);
      }
    }
  }

  function waterRectAt(x, y, inset = 0) {
    return WATER_RECTS.find((rect) => pointInRect(x, y, rect, -inset));
  }

  function dolphinPathFitsWater(rect, x, y, dir, travel, margin = 36) {
    const hx = Math.cos(dir) * travel * 0.5;
    const hy = Math.sin(dir) * travel * 0.5;
    return pointInRect(x - hx, y - hy, rect, -margin) && pointInRect(x + hx, y + hy, rect, -margin);
  }

  function spawnDolphinNearPlayer(targetRect) {
    const p = game.player;
    const current = targetRect || waterRectAt(p.x, p.y, 46);
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
      if (!dolphinPathFitsWater(rect, x, y, dir, travel, 36)) continue;
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
    // dolphins leap rarely, and every jump must begin and end inside the same water body
    const plainDolphins = dolphins.filter((d) => !d.golden).length;
    if (game.area === "surface" && plainDolphins < 2 && rand() < dt * 0.03) {
      let near = null;
      let nd = 560;
      for (const rect of WATER_RECTS) {
        if (rect.w < 256 || rect.h < 256) continue;
        const cx = clamp(p.x, rect.x, rect.x + rect.w);
        const cy = clamp(p.y, rect.y, rect.y + rect.h);
        const d = Math.hypot(p.x - cx, p.y - cy);
        if (d < nd) { nd = d; near = rect; }
      }
      if (near) spawnDolphinNearPlayer(near);
    }
    for (const dolphin of dolphins) {
      dolphin.life -= dt;
      dolphin.phase += dt * 5.4;
    }
    for (let i = dolphins.length - 1; i >= 0; i -= 1) {
      if (dolphins[i].life <= 0) dolphins.splice(i, 1);
    }
  }

  function updateSharks(dt) {
    if (game.area !== "surface") return;
    const p = game.player;
    for (const shark of sharks) {
      shark.t += dt;
      shark.biteCooldown = Math.max(0, shark.biteCooldown - dt);
      if (shark.x0 === undefined) { shark.x0 = shark.x; shark.y0 = shark.y; }
      if (!shark.waterRect) shark.waterRect = waterRectAt(shark.x0, shark.y0, shark.r + 10);
      if (!shark.waterRect) continue;
      const rect = shark.waterRect;
      const horizontal = Math.abs(Math.cos(shark.dir)) >= Math.abs(Math.sin(shark.dir));
      const safe = shark.r + 18;
      const maxTravel = horizontal ? Math.max(0, rect.w - safe * 2) : Math.max(0, rect.h - safe * 2);
      const travel = Math.min(shark.travel, maxTravel);
      const centerX = clamp(shark.x0, rect.x + safe, rect.x + rect.w - safe);
      const centerY = clamp(shark.y0, rect.y + safe, rect.y + rect.h - safe);
      const u = (Math.sin((shark.t / shark.period) * TAU + shark.phase) + 1) * 0.5;
      shark.cx = clamp(centerX + Math.cos(shark.dir) * (u - 0.5) * travel, rect.x + safe, rect.x + rect.w - safe);
      shark.cy = clamp(centerY + Math.sin(shark.dir) * (u - 0.5) * travel, rect.y + safe, rect.y + rect.h - safe);
      shark.drawDir = shark.dir + (Math.cos((shark.t / shark.period) * TAU + shark.phase) < 0 ? Math.PI : 0);
      if (p.swimming && shark.biteCooldown <= 0 && Math.hypot(p.x - shark.cx, p.y - shark.cy) < p.r + shark.r + 4) {
        shark.biteCooldown = 1.6;
        game.message = "REKIN!";
        game.messageTimer = 1.2;
        hurtPlayer(1.1, angleTo({ x: shark.cx, y: shark.cy }, p), true);
      }
    }
  }

  function hurtShark(hit, direction) {
    if (game.area !== "surface") return false;
    for (const shark of sharks) {
      const body = { x: shark.cx || shark.x, y: shark.cy || shark.y, r: shark.r };
      if (!circleHit(hit, body, 6)) continue;
      game.message = "NIE GRYŹ REKINA";
      game.messageTimer = 1.5;
      hurtPlayer(1.0, direction + Math.PI, true);
      burst(body.x, body.y, 16, "#9fb7bd");
      playTone("hurt");
      return true;
    }
    return false;
  }

  function updateMoles(dt) {
    for (const mole of game.moles) {
      mole.phase += dt * 1.4;
      mole.talkCooldown = Math.max(0, mole.talkCooldown - dt);
    }
  }

  function updateIntel() {
    const p = game.player;
    for (const spot of game.intel) {
      if (spot.taken) continue;
      const area = spot.area || "underground";
      if (area !== game.area) continue;
      if (spot.underwater && !p.swimming) continue;
      if (Math.hypot(spot.x - p.x, spot.y - p.y) < 40) {
        spot.taken = true;
        applyIntelEffect(spot);
        addItem("intel", spot);
        game.message = spot.label;
        game.messageTimer = 2.4;
        burst(spot.x, spot.y, 26, spot.color || palette.aiBlue);
        playTone("pickup");
      }
    }
  }

  function applyIntelEffect(spot) {
    const p = game.player;
    if (spot.effect === "goldTeeth") {
      p.goldTeeth = true;
    } else if (spot.effect === "tailOintment") {
      p.tailLevel = Math.max(p.tailLevel + 1.4, p.tailLevel * 1.45);
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
      if (spotBlocked(animal.x, animal.y, animal.r + 5)) {
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
      if (cable.dataFeed) {
        game.dataFeedCut = true;
        game.message = "DATA CENTER: ZASILANIE AWARYJNE PRZEGRYZIONE";
      } else {
        const server = game.servers[cable.serverIndex];
        if (server) server.powered = false;
        game.message = server ? "#" + server.num + " " + server.name + ": TARCZA BRAMY ZGASŁA" : "KABEL PRZEGRYZIONY";
      }
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
      if (cabin.item && ITEM_LIBRARY[cabin.item]) {
        game.message = ITEM_LIBRARY[cabin.item].label;
        if (cabin.item === "hat") p.hat = true;
        if (cabin.item === "boots") p.boots = true;
        if (cabin.item === "book") p.book = true;
        if (cabin.item === "flashlight") p.tailLight = true;
        if (cabin.item === "key") p.key = true;
        addItem(cabin.item);
        game.dialogLines = [ITEM_LIBRARY[cabin.item].desc];
        game.dialogTimer = 6.4;
      } else {
        game.dialogLines = ["Pusty dom na skraju lasu. Ktoś tu kiedyś mieszkał, zanim maszyny zajeły sie liczeniem wszystkiego."];
        game.dialogTimer = 4.6;
      }
      playTone("pickup");
      return true;
    }
    return false;
  }

  function hasItem(id) {
    return game.items.some((item) => item.id === id);
  }

  function tryOpenChest() {
    if (game.area !== "surface") return false;
    const p = game.player;
    for (const chest of game.chests) {
      const near = p.x > chest.x - 34 && p.x < chest.x + chest.w + 34 && p.y > chest.y - 34 && p.y < chest.y + chest.h + 34;
      if (!near || chest.opened) continue;
      if (!hasItem(chest.key)) {
        game.message = "SKRZYNIA ZAMKNIĘTA: POTRZEBNY KLUCZ";
        game.messageTimer = 2;
        playTone("blocked");
        return true;
      }
      chest.opened = true;
      addItem(chest.item);
      game.message = ITEM_LIBRARY[chest.item] ? ITEM_LIBRARY[chest.item].label : chest.title;
      game.messageTimer = 2.4;
      game.dialogLines = [ITEM_LIBRARY[chest.item].desc];
      game.dialogTimer = 5.4;
      burst(chest.x + chest.w / 2, chest.y + chest.h / 2, 34, "#ffd66d");
      playTone("restore");
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
        game.message = "ALARM KAMERY #" + server.num + ": " + server.name;
        game.messageTimer = 2.4;
        wakeDefense(i);
        playTone("blocked");
        break;
      }
    }
    // data-center cameras, powered from the underground feed cable
    game.dataCamCooldown = Math.max(0, (game.dataCamCooldown || 0) - dt);
    if (!game.worldRestored && !game.boss.defeated && !game.dataFeedCut && game.dataCamCooldown <= 0) {
      for (const camera of dataCenterCameras()) {
        if (!pointInCameraCone(p.x, p.y, camera)) continue;
        game.dataCamCooldown = 4.5;
        game.alarmTimer = 2.8;
        game.message = "ALARM KAMERY: DATA CENTER";
        game.messageTimer = 2.4;
        wakeDefense(null);
        playTone("blocked");
        break;
      }
    }
  }

  // Cameras sit on the room walls (drawn as glowing dots) and sweep the approaches.
  function serverCameras(server) {
    const b = roomBounds(server);
    return [
      { x: b.x + 4, y: b.y + TILE, a: Math.PI, range: 330, spread: 0.45 },
      { x: b.x + b.w - 4, y: b.y + b.h - TILE, a: 0, range: 330, spread: 0.45 },
      { x: server.x, y: b.y + 4, a: -Math.PI / 2, range: 300, spread: 0.42 }
    ];
  }

  function dataCenterCameras() {
    const d = DATA_CENTER;
    return [
      { x: d.x + 6, y: d.y + TILE * 4, a: Math.PI, range: 360, spread: 0.4 },
      { x: d.x + 6, y: d.y + TILE * 8, a: Math.PI, range: 360, spread: 0.4 },
      { x: d.x + d.w / 2, y: d.y + 6, a: -Math.PI / 2, range: 340, spread: 0.4 },
      { x: d.x + d.w - 6, y: d.y + d.h / 2, a: 0, range: 340, spread: 0.4 }
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

  function updateStreams(dt) {
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
      // as soon as ONE board lies across the stream (a footbridge), a golden dolphin leaps over
      // it rarely; no need for a full two-plank bridge
      if (planks.length >= 1) {
        stream.goldenTimer -= dt;
        if (stream.goldenTimer <= 0) {
          stream.goldenTimer = 95 + rand() * 50;
          spawnGoldenDolphin(stream, planks);
        }
      } else {
        if (stream.goldenTimer < 20) stream.goldenTimer = 35 + rand() * 45;
      }
    }
  }

  function spawnGoldenDolphin(stream, planks) {
    const plank = planks[Math.floor(rand() * planks.length)] || { x: stream.x + stream.w / 2, y: stream.y + stream.h / 2 };
    const horizontal = stream.w > stream.h;
    const x = horizontal ? plank.x : stream.x + stream.w / 2;
    const y = horizontal ? stream.y + stream.h / 2 : plank.y;
    const room = horizontal ? Math.min(x - stream.x, stream.x + stream.w - x) : Math.min(y - stream.y, stream.y + stream.h - y);
    const travel = Math.min(260, room * 2 - 96);
    if (travel < 110) return false;
    const dir = horizontal ? (rand() > 0.5 ? 0 : Math.PI) : (rand() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
    if (!dolphinPathFitsWater(stream, x, y, dir, travel, 24)) return false;
    dolphins.push({
      x,
      y,
      dir,
      travel,
      life: 1.9,
      maxLife: 1.9,
      phase: rand() * TAU,
      golden: true
    });
    return true;
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
    if (d < 720 && boss.shootCooldown <= 0) {
      const exposed = bossCoresLeftCount() === 0;
      boss.shootCooldown = exposed ? 0.72 : 1.05;
      const waves = exposed ? 3 : 2;
      for (let i = 0; i < waves; i += 1) {
        const a = angleTo(boss, p) + (i - (waves - 1) / 2) * 0.28;
        const v = vectorFromAngle(a, exposed ? 245 : 205);
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

    if (bossCoresLeftCount() === 0 && !boss.exposedText) {
      boss.exposedText = true;
      game.message = "RDZEN AI ODSŁONIĘTY";
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

      const dir = Math.atan2(shot.vy, shot.vx);
      for (const enemy of game.enemies) {
        if (enemy.hp > 0 && circleHit(shot, enemy)) {
          hurtEnemy(enemy, shot.damage, dir);
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
          if (server.destroyed || server.doorOpen) continue;
          if (rectCircleHit(shot, doorRect(server), 6)) {
            hurtServerDoors(shot, shot.damage);
            shot.life = -1;
            break;
          }
        }
      }
      if (shot.life > 0) {
        for (const rack of game.bossRacks || []) {
          if (!rack.destroyed && rectCircleHit(shot, rack, 6)) {
            hurtBossRacks(shot, shot.damage, Math.atan2(shot.vy, shot.vx));
            shot.life = -1;
            break;
          }
        }
      }
      if (shot.life > 0) {
        for (let i = 0; i < game.servers.length && shot.life > 0; i += 1) {
          const server = game.servers[i];
          if (server.destroyed) continue;
          for (const core of server.cores) {
            if (!core.destroyed && circleHit(shot, core, 6)) {
              hurtServerCore(server, core, i, shot.damage);
              shot.life = -1;
              break;
            }
          }
        }
      }
      if (shot.life > 0) {
        for (const core of game.bossCores) {
          if (!core.destroyed && circleHit(shot, core, 6)) {
            hurtBossCore(core, shot.damage);
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
      for (const rack of game.bossRacks || []) {
        if (!rack.destroyed && rectCircleHit(shot, rack, 0)) {
          burst(shot.x, shot.y, 6, shot.color);
          shot.life = -1;
          break;
        }
      }
      if (shot.life <= 0) continue;
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
      // while the minute-long spinach shield holds, most of the hit is absorbed
      burst(p.x, p.y, 12, palette.spinach);
      playTone("blocked");
      p.hp -= damage * 0.2;
      p.x += Math.cos(direction) * 8;
      p.y += Math.sin(direction) * 8;
      camera.shake = Math.max(camera.shake, 3);
      return;
    }
    burst(p.x, p.y, 14, palette.red);
    playTone("hurt");
    p.tailLevel = Math.max(0, p.tailLevel - damage * 0.45);
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

  // viewport rectangle (with margin) recomputed each frame; used to cull off-screen drawing
  const view = { x0: 0, y0: 0, x1: 0, y1: 0 };
  function inView(x, y, w, h) {
    return x < view.x1 && x + w > view.x0 && y < view.y1 && y + h > view.y0;
  }

  function render() {
    resize();
    const size = screenSize();
    ctx.clearRect(0, 0, size.w, size.h);

    const margin = 140;
    view.x0 = camera.x - margin;
    view.y0 = camera.y - margin;
    view.x1 = camera.x + size.w + margin;
    view.y1 = camera.y + size.h + margin;

    const shakeX = camera.shake ? (rand() - 0.5) * camera.shake : 0;
    const shakeY = camera.shake ? (rand() - 0.5) * camera.shake : 0;

    ctx.save();
    ctx.translate(Math.round(-camera.x + shakeX), Math.round(-camera.y + shakeY));
    if (game.area === "underground") {
      drawUndergroundWorld();
      drawIntel();
      drawCaterpillars();
      drawMoles();
      drawPlayer();
      drawParticles();
      drawFloatText();
    } else {
      drawWorld();
      drawDataCenter();
      drawForestWalls();
      drawWaterPlants();
      drawDecor();
      drawMiniDams();
      drawVictoryFlowers();
      drawSecretHedges();
      drawCabins();
      drawBurrows();
      drawPickups();
      drawPlanks();
      drawShipwrecks();
      drawDolphins();
      drawSharks();
      drawIntel();
      drawNpcs();
      drawCritters();
      drawCompanionGate();
      drawChests();
      drawBlockers();
      drawServers();
      drawGems();
      drawFriendlyCritters();
      drawFollowers();
      drawWildlife();
      drawBoss();
      drawEnemies();
      drawShots();
      drawPlayer();
      drawParticles();
      drawFloatText();
    }
    ctx.restore();

    if (game.area === "underground") drawUndergroundFog(size);
    if (game.state !== "menu") drawHud(size);
    drawVignette(size);
    if (game.inventoryOpen) drawInventory(size);
    drawOverlay(size);
  }

  function drawFloatText() {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "800 13px Inter, system-ui, sans-serif";
    for (const t of floatText) {
      ctx.globalAlpha = clamp(t.life / 0.6, 0, 1);
      ctx.fillStyle = "rgba(13, 18, 16, 0.7)";
      const w = ctx.measureText(t.text).width + 16;
      ctx.fillRect(Math.round(t.x - w / 2), Math.round(t.y - 12), Math.round(w), 18);
      ctx.fillStyle = t.color || palette.cream;
      ctx.fillText(t.text, Math.round(t.x), Math.round(t.y + 1));
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawWorld() {
    drawTerrainGrid();
    drawSmallStreamEffects();

    for (const dot of terrainDots) {
      if (!inView(dot.x, dot.y, dot.r, dot.r)) continue;
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

    if (!game.boss.defeated) drawCorruptionField(game.boss.x, game.boss.y, 600, bossCoresLeftCount() ? 0.28 : 0.2);
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
        const rawWater = rectHitsAny(tile, ALL_WATER_RECTS);
        const greeneryLand = rawWater && tileHasGreeneryLand(tile);
        const water = rawWater && !greeneryLand;
        const road = rectHitsAny(tile, ROAD_RECTS);
        const beach = !water && !road && x < 1728 && y < 3328;
        const meadow = !water && !road && x < 2600 && y < 3328;
        const mountain = !water && !road && (x > 9200 || (x > 7200 && y > 3000));
        const h = tileHash(x, y);
        if (water) {
          ctx.fillStyle = h > 0.5 ? "#2b5a72" : "#315d73";
        } else if (road) {
          ctx.fillStyle = game.worldRestored ? (h > 0.5 ? "#557a48" : "#486f42") : (h > 0.5 ? "#735f43" : "#66523b");
        } else if (beach) {
          ctx.fillStyle = h > 0.55 ? "#cfae75" : "#d9bd83";
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
        } else if (beach) {
          ctx.fillStyle = "rgba(109, 89, 65, 0.16)";
          ctx.fillRect(x + 12, y + 18, 9, 5);
          ctx.fillRect(x + 40, y + 44, 7, 4);
          if (meadow && h > 0.7) {
            ctx.fillStyle = "rgba(126, 203, 119, 0.26)";
            ctx.fillRect(x + 22, y + 10, 12, 24);
          }
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
      drawGridRect(hedge.x, hedge.y, hedge.w, hedge.h, "rgba(66, 111, 69, 0.36)", "rgba(24, 80, 36, 0.24)");
      ctx.fillStyle = "#2d7f39";
      ctx.fillRect(hedge.x + 14, hedge.y + hedge.h / 2 - 5, hedge.w - 28, 10);
      ctx.restore();
      return;
    }
    hedge.pulse += 0.025;
    drawGridRect(hedge.x, hedge.y, hedge.w, hedge.h, "#12351f", "rgba(4, 9, 6, 0.66)");
    drawBushTile(hedge.x, hedge.y, false, false);
    ctx.strokeStyle = `rgba(126, 203, 119, ${0.48 + Math.sin(hedge.pulse) * 0.18})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(hedge.x + 6, hedge.y + 6, hedge.w - 12, hedge.h - 12);
    ctx.fillStyle = "rgba(245, 238, 209, 0.56)";
    ctx.fillRect(hedge.x + hedge.w / 2 - 5, hedge.y + 8, 10, 9);
    ctx.restore();
  }

  function cabinWalls(cabin) {
    const wall = 16;
    const door = TILE;
    const doorX = cabin.x + cabin.w / 2 - door / 2;
    const walls = [
      { x: cabin.x, y: cabin.y, w: cabin.w, h: wall },
      { x: cabin.x, y: cabin.y, w: wall, h: cabin.h },
      { x: cabin.x + cabin.w - wall, y: cabin.y, w: wall, h: cabin.h },
      { x: cabin.x, y: cabin.y + cabin.h - wall, w: doorX - cabin.x, h: wall },
      { x: doorX + door, y: cabin.y + cabin.h - wall, w: cabin.x + cabin.w - doorX - door, h: wall }
    ];
    // big cabins are split into rooms by an interior wall with its own doorway
    if (cabin.big) {
      const px = cabin.x + Math.round(cabin.w * 0.52);
      const gap = cabin.y + cabin.h * 0.55;
      walls.push({ x: px, y: cabin.y + wall, w: wall, h: gap - (cabin.y + wall) });
      walls.push({ x: px, y: gap + door, w: wall, h: cabin.y + cabin.h - wall - (gap + door) });
    }
    return walls;
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

    drawBossRacks(pulse);
    drawBossCores();
    drawBossRoom();

    for (const wall of dataCenterWalls()) {
      ctx.fillStyle = "#4b5256";
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeStyle = "rgba(245, 238, 209, 0.12)";
      ctx.strokeRect(wall.x + 0.5, wall.y + 0.5, wall.w - 1, wall.h - 1);
    }
    drawDataCurtain();
    ctx.restore();
    drawSmog(d);
  }

  function drawBossCores() {
    const t = game.time;
    for (const core of game.bossCores) {
      const rect = { x: core.x - TILE / 2, y: core.y - TILE * 0.75, w: TILE, h: TILE * 1.5, hp: core.hp, maxHp: core.maxHp, destroyed: core.destroyed, pulse: core.pulse };
      const blink = Math.sin(t * 8 + core.pulse) * 0.5 + 0.5;
      drawBossRackShape(rect, { mandatory: true, blink });
    }
  }

  function drawBossRacks(pulse) {
    for (const rack of game.bossRacks || []) drawBossRackShape(rack, { pulse, mandatory: false });
  }

  function drawBossRackShape(rack, opts = {}) {
    const destroyed = rack.destroyed;
    const mandatory = !!opts.mandatory;
    const x = Math.round(rack.x);
    const y = Math.round(rack.y);
    if (destroyed) {
      ctx.fillStyle = "#3d4446";
      ctx.fillRect(x + 6, y + rack.h - 24, rack.w - 12, 16);
      ctx.fillStyle = "#889397";
      ctx.fillRect(x + 14, y + rack.h - 40, rack.w - 28, 9);
      ctx.fillRect(x + 8, y + rack.h - 56, rack.w - 16, 6);
      return;
    }
    const p = opts.blink !== undefined ? opts.blink : (0.35 + Math.sin(game.time * 2.8 + rack.pulse) * 0.12);
    ctx.save();
    shadow(x + rack.w / 2, y + rack.h + 8, rack.w * 0.48, 9);
    ctx.fillStyle = mandatory ? "#141d23" : "#1d2528";
    ctx.fillRect(x, y, rack.w, rack.h);
    ctx.strokeStyle = mandatory ? `rgba(105, 215, 255, ${0.35 + p * 0.45})` : "rgba(160, 176, 176, 0.32)";
    ctx.lineWidth = mandatory ? 3 : 2;
    ctx.strokeRect(x + 0.5, y + 0.5, rack.w - 1, rack.h - 1);
    ctx.fillStyle = "#0b1014";
    for (let yy = y + 14; yy < y + rack.h - 12; yy += 28) ctx.fillRect(x + 9, yy, rack.w - 18, 12);
    for (let yy = y + 18; yy < y + rack.h - 10; yy += 28) {
      ctx.fillStyle = mandatory ? `rgba(105, 215, 255, ${0.25 + p * 0.75})` : "rgba(241, 91, 91, 0.74)";
      ctx.fillRect(x + 14, yy, 7, 6);
      ctx.fillRect(x + 28, yy, 7, 6);
      ctx.fillStyle = mandatory ? `rgba(228, 84, 154, ${0.25 + (1 - p) * 0.65})` : "rgba(241, 91, 91, 0.55)";
      ctx.fillRect(x + 43, yy, 7, 6);
    }
    if (mandatory) {
      ctx.fillStyle = "rgba(241, 91, 91, 0.82)";
      ctx.fillRect(x, y + rack.h + 7, rack.w, 7);
      ctx.fillStyle = palette.flower;
      ctx.fillRect(x, y + rack.h + 7, rack.w * (rack.hp / rack.maxHp), 7);
    }
    ctx.restore();
  }

  function drawBossRoom() {
    const r = BOSS_ROOM;
    const pulse = Math.sin(game.time * 2.4) * 0.5 + 0.5;
    // darker sealed chamber floor
    drawGridRect(r.x + r.wall, r.y + r.wall, r.w - r.wall * 2, r.h - r.wall * 2, "#1b1322", "rgba(126, 67, 110, 0.22)");
    ctx.fillStyle = `rgba(228, 84, 154, ${0.06 + pulse * 0.06})`;
    ctx.fillRect(r.x + r.wall, r.y + r.wall, r.w - r.wall * 2, r.h - r.wall * 2);
    for (const wall of bossRoomWalls()) {
      ctx.fillStyle = "#3a2d40";
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeStyle = `rgba(228, 84, 154, ${0.3 + pulse * 0.2})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(wall.x + 0.5, wall.y + 0.5, wall.w - 1, wall.h - 1);
    }
    // glowing threshold in the doorway
    ctx.fillStyle = `rgba(228, 84, 154, ${0.3 + pulse * 0.3})`;
    ctx.fillRect(r.x, r.doorY + 6, 6, r.doorH - 12);
  }

  function drawDataCurtain() {
    const c = game.curtain;
    if (c.down) {
      ctx.fillStyle = "rgba(126, 203, 119, 0.18)";
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = "rgba(105, 215, 255, 0.25)";
      ctx.fillRect(c.x + c.w / 2 - 2, c.y, 4, c.h);
      return;
    }
    const flick = 0.55 + Math.sin(game.time * 18 + c.pulse) * 0.25 + (rand() - 0.5) * 0.1;
    ctx.save();
    ctx.fillStyle = `rgba(105, 215, 255, ${0.16 * flick})`;
    ctx.fillRect(c.x - 4, c.y, c.w + 8, c.h);
    ctx.strokeStyle = `rgba(180, 240, 255, ${0.7 * flick})`;
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i += 1) {
      const x = c.x + 6 + i * (c.w - 12) / 4;
      ctx.beginPath();
      ctx.moveTo(x, c.y + 4);
      for (let y = c.y + 4; y < c.y + c.h - 4; y += 18) {
        ctx.lineTo(x + (rand() - 0.5) * 10, y);
      }
      ctx.lineTo(x, c.y + c.h - 4);
      ctx.stroke();
    }
    // horizontal arcs
    ctx.strokeStyle = `rgba(228, 84, 154, ${0.5 * flick})`;
    for (let y = c.y + 14; y < c.y + c.h; y += 34) {
      ctx.beginPath();
      ctx.moveTo(c.x + 2, y);
      ctx.lineTo(c.x + c.w - 2, y + (rand() - 0.5) * 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Thick smog hanging over the data centre: a drifting haze plus heavy smoke stacks.
  function drawSmog(d) {
    ctx.save();
    const haze = ctx.createLinearGradient(0, d.y - TILE * 6, 0, d.y + d.h);
    haze.addColorStop(0, "rgba(70, 66, 60, 0.42)");
    haze.addColorStop(0.5, "rgba(78, 74, 68, 0.26)");
    haze.addColorStop(1, "rgba(60, 58, 54, 0.05)");
    ctx.fillStyle = haze;
    ctx.fillRect(d.x - TILE * 5, d.y - TILE * 6, d.w + TILE * 10, d.h + TILE * 6);
    // a row of belching stacks along the top of the data centre
    for (let i = 0; i < 6; i += 1) {
      drawSmokeStack(d.x + TILE * 1.5 + i * (d.w - TILE * 3) / 5, d.y - TILE * 2, i * 0.37);
    }
    // extra free-floating soot puffs
    for (let i = 0; i < 26; i += 1) {
      const seed = i * 53.1;
      const drift = (game.time * 0.16 + i * 0.21) % 1;
      const px = d.x + ((seed * 97) % (d.w + TILE * 4)) - TILE * 2 + Math.sin(game.time * 0.6 + i) * 18;
      const py = d.y - TILE * 5 + ((seed * 61) % (d.h + TILE * 4)) - drift * 120;
      const size = 26 + (seed % 30) + drift * 26;
      ctx.fillStyle = `rgba(64, 62, 58, ${(1 - drift) * 0.16})`;
      ctx.fillRect(Math.round(px - size / 2), Math.round(py - size / 2), Math.round(size), Math.round(size));
    }
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
      if (cabin.big) {
        // a second window hints at the extra room
        ctx.fillStyle = "#8d6240";
        ctx.fillRect(cabin.x + cabin.w - 70, cabin.y + 46, 42, 54);
        ctx.fillStyle = "#d4a15b";
        ctx.fillRect(cabin.x + cabin.w - 60, cabin.y + 56, 22, 10);
      }
      const iy = cabin.y + cabin.h - 78;
      ctx.fillStyle = cabin.used ? "#324b34" : "#d4a15b";
      if (cabin.item === "book" || cabin.item === "letter1" || cabin.item === "letter2" || cabin.item === "journal1" || cabin.item === "logbook" || cabin.item === "manual" || cabin.item === "lastNote") {
        ctx.fillRect(cabin.x + 42, iy, 30, 22);
        ctx.fillStyle = "#f5eed1";
        ctx.fillRect(cabin.x + 46, iy + 4, 10, 14);
        ctx.fillRect(cabin.x + 58, iy + 4, 10, 14);
      } else if (cabin.item === "key") {
        ctx.fillStyle = cabin.used ? "#324b34" : "#ffd66d";
        ctx.fillRect(cabin.x + 48, iy + 8, 28, 8);
        ctx.fillRect(cabin.x + 72, iy + 4, 8, 16);
      } else if (cabin.item === "hat") {
        ctx.fillRect(cabin.x + 42, iy + 4, 36, 8);
        ctx.fillRect(cabin.x + 52, iy - 10, 16, 16);
      } else if (cabin.item === "boots") {
        ctx.fillRect(cabin.x + 44, iy - 4, 18, 28);
        ctx.fillRect(cabin.x + 68, iy - 4, 18, 28);
      } else if (cabin.item === "flashlight") {
        // a little lamp on a stand
        ctx.fillRect(cabin.x + 52, iy + 6, 18, 6);
        ctx.fillStyle = cabin.used ? "#324b34" : "#ffe07a";
        ctx.beginPath();
        ctx.moveTo(cabin.x + 50, iy + 6);
        ctx.lineTo(cabin.x + 72, iy + 6);
        ctx.lineTo(cabin.x + 66, iy - 10);
        ctx.lineTo(cabin.x + 56, iy - 10);
        ctx.closePath();
        ctx.fill();
      } else {
        // empty home: just a little stool
        ctx.fillStyle = "#5c4631";
        ctx.fillRect(cabin.x + 48, iy + 6, 22, 8);
        ctx.fillRect(cabin.x + 50, iy + 14, 5, 12);
        ctx.fillRect(cabin.x + 63, iy + 14, 5, 12);
      }
      if (Math.abs(game.player.x - (cabin.x + cabin.w / 2)) < 110 && Math.abs(game.player.y - (cabin.y + cabin.h / 2)) < 130) {
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

  function drawChests() {
    for (const chest of game.chests) {
      const x = chest.x;
      const y = chest.y;
      shadow(x + chest.w / 2, y + chest.h, 36, 8);
      ctx.fillStyle = chest.opened ? "#5b3a24" : "#7a4b2c";
      ctx.fillRect(x, y + 12, chest.w, chest.h - 12);
      ctx.fillStyle = chest.opened ? "#3d2819" : "#a66b36";
      ctx.fillRect(x + 6, y, chest.w - 12, 20);
      ctx.fillStyle = chest.opened ? "#335c35" : "#ffd66d";
      ctx.fillRect(x + chest.w / 2 - 5, y + 28, 10, 12);
      if (!chest.opened && Math.hypot(game.player.x - (x + chest.w / 2), game.player.y - (y + chest.h / 2)) < 82) drawWorldHint(x + chest.w / 2, y - 14, "SPACJA");
    }
  }

  function drawCompanionGate() {
    const gate = game.companionGate;
    if (!gate) return;
    ctx.save();
    if (gate.open) {
      drawGridRect(gate.x, gate.y, gate.w, gate.h, "rgba(80, 132, 75, 0.46)", "rgba(126, 203, 119, 0.26)");
      ctx.restore();
      return;
    }
    drawGridRect(gate.x, gate.y, gate.w, gate.h, "#12351f", "rgba(4, 9, 6, 0.66)");
    for (let y = gate.y; y < gate.y + gate.h; y += TILE) drawBushTile(gate.x, y, false, false);
    ctx.strokeStyle = "rgba(245, 238, 209, 0.4)";
    ctx.lineWidth = 3;
    ctx.strokeRect(gate.x + 5, gate.y + 5, gate.w - 10, gate.h - 10);
    ctx.restore();
  }

  function drawWaterPlants() {
    for (const plant of WATER_PLANTS) {
      if (plant.type === "lily") {
        if (!inView(plant.x - 32, plant.y - 32, 64, 64)) continue;
        ctx.save();
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = "#2f7f4a";
        ctx.fillRect(plant.x - 18, plant.y - 10, 36, 20);
        ctx.fillRect(plant.x - 10, plant.y - 18, 20, 36);
        ctx.fillStyle = "#f2e872";
        ctx.fillRect(plant.x - 4, plant.y - 4, 8, 8);
        ctx.restore();
      } else {
        if (!inView(plant.x, plant.y, plant.w, plant.h)) continue;
        ctx.save();
        ctx.fillStyle = "rgba(32, 96, 55, 0.78)";
        for (let x = plant.x + 8; x < plant.x + plant.w - 8; x += 16) {
          for (let y = plant.y + 8; y < plant.y + plant.h - 8; y += 24) {
            ctx.fillRect(x, y - 18, 7, 28);
            ctx.fillStyle = "rgba(91, 174, 83, 0.72)";
            ctx.fillRect(x + 7, y - 10, 8, 5);
            ctx.fillStyle = "rgba(32, 96, 55, 0.78)";
          }
        }
        ctx.restore();
      }
    }
  }

  function drawShipwrecks() {
    for (const wreck of SHIPWRECKS) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      shadow(wreck.x + wreck.w / 2, wreck.y + wreck.h / 2 + 28, wreck.w * 0.42, 11);
      ctx.translate(wreck.x + wreck.w / 2, wreck.y + wreck.h / 2);
      ctx.fillStyle = "#4d3526";
      ctx.fillRect(-96, -24, 192, 48);
      ctx.fillStyle = "#2f2119";
      ctx.fillRect(-82, -14, 54, 28);
      ctx.fillRect(28, -14, 54, 28);
      ctx.fillStyle = "#7c5738";
      for (let x = -88; x <= 72; x += 32) ctx.fillRect(x, -20, 18, 40);
      ctx.fillStyle = "rgba(105, 215, 255, 0.28)";
      ctx.fillRect(-96, 24, 192, 8);
      ctx.fillRect(-64, -32, 24, 8);
      ctx.fillRect(48, 28, 32, 8);
      ctx.restore();
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
      if (server.destroyed) continue;
      for (const camera of serverCameras(server)) drawCamera(camera, server.powered);
    }
    if (!game.worldRestored && !game.boss.defeated) {
      for (const camera of dataCenterCameras()) drawCamera(camera, !game.dataFeedCut);
    }
  }

  // Wall cameras: a clear housing dot, a red lens that blinks while the underground feed is live.
  function drawCamera(camera, powered) {
    ctx.save();
    if (powered) {
      ctx.fillStyle = "rgba(228, 84, 154, 0.08)";
      ctx.beginPath();
      ctx.moveTo(camera.x, camera.y);
      ctx.arc(camera.x, camera.y, camera.range, camera.a - camera.spread, camera.a + camera.spread);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#1b2227";
    ctx.fillRect(camera.x - 8, camera.y - 8, 16, 16);
    ctx.strokeStyle = "rgba(245, 238, 209, 0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(camera.x - 8.5, camera.y - 8.5, 16, 16);
    if (powered) {
      const blink = 0.55 + Math.sin(game.time * 6 + camera.x * 0.05) * 0.45;
      ctx.fillStyle = `rgba(241, 91, 91, ${0.45 + blink * 0.55})`;
      ctx.fillRect(camera.x - 4, camera.y - 4, 8, 8);
      ctx.fillStyle = `rgba(255, 214, 140, ${blink})`;
      ctx.fillRect(camera.x - 1, camera.y - 1, 2, 2);
    } else {
      ctx.fillStyle = "rgba(120, 130, 130, 0.55)";
      ctx.fillRect(camera.x - 4, camera.y - 4, 8, 8);
    }
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
    drawOasis();
    drawUndergroundBurrows();
    drawCables();
  }

  // A calm underground oasis: a glowing pool ringed with mushrooms and pale plants.
  function drawOasis() {
    const o = UNDER_OASIS;
    const t = game.time;
    // mossy floor accent
    ctx.fillStyle = "#2c3a2b";
    ctx.fillRect(o.x + 8, o.y + 8, o.w - 16, o.h - 16);
    // the pool
    const px = o.x + o.w * 0.5;
    const py = o.y + o.h * 0.56;
    const pw = o.w * 0.42;
    const ph = o.h * 0.32;
    ctx.save();
    ctx.fillStyle = "#1f4f63";
    ctx.beginPath();
    ctx.ellipse(px, py, pw, ph, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(105, 215, 255, 0.22)";
    ctx.beginPath();
    ctx.ellipse(px, py, pw * 0.7, ph * 0.66, 0, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 3; i += 1) {
      ctx.strokeStyle = `rgba(180, 240, 255, ${0.16 - i * 0.04})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(px, py, pw * (0.4 + ((t * 0.2 + i * 0.33) % 1) * 0.6), ph * (0.4 + ((t * 0.2 + i * 0.33) % 1) * 0.6), 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    // glowing mushrooms / plants around the rim
    for (let i = 0; i < 12; i += 1) {
      const a = i * TAU / 12;
      const mx = px + Math.cos(a) * (pw + 26);
      const my = py + Math.sin(a) * (ph + 22);
      if (!pointInRect(mx, my, o, -10)) continue;
      const glow = 0.5 + Math.sin(t * 2 + i) * 0.5;
      ctx.fillStyle = "#6b5a44";
      ctx.fillRect(Math.round(mx - 2), Math.round(my - 2), 4, 12);
      ctx.fillStyle = `rgba(126, 203, 119, ${0.5 + glow * 0.4})`;
      ctx.beginPath();
      ctx.arc(Math.round(mx), Math.round(my - 4), 6, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(126, 203, 119, 0.8)";
    ctx.font = "800 13px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PODZIEMNA OAZA", px, o.y + 26);
    ctx.textAlign = "left";
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
      const cx = cable.x + cable.w / 2;
      // the top end is bedded into the rock ceiling so it never just dangles in mid-air
      ctx.fillStyle = "#241a14";
      ctx.fillRect(cable.x - 6, cable.y - 10, cable.w + 12, 16);
      ctx.fillStyle = cable.cut ? "#2c2520" : "#421f2c";
      ctx.fillRect(cable.x, cable.y, cable.w, cable.h);
      ctx.fillStyle = cable.cut ? "#7f6a57" : `rgba(105, 215, 255, ${0.25 + Math.sin(game.time * 4 + cable.pulse) * 0.12})`;
      ctx.fillRect(cx - 3, cable.y, 6, cable.h);
      // frayed/sparking exposed lower end
      const endY = cable.y + cable.h;
      if (cable.cut) {
        ctx.fillStyle = "#7f6a57";
        ctx.fillRect(cx - 5, endY - 6, 3, 8);
        ctx.fillRect(cx + 2, endY - 6, 3, 8);
      } else {
        ctx.fillStyle = `rgba(228, 84, 154, ${0.4 + Math.sin(game.time * 9 + cable.pulse) * 0.3})`;
        ctx.fillRect(cx - 4, endY - 4, 8, 8);
        drawWorldHint(cx, endY + 16, "GRYZ");
      }
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
    // the tail flashlight widens how far you can see in the dark
    const lit = game.player.tailLight;
    const inner = lit ? 170 : 90;
    const outer = lit ? 470 : 285;
    const g = ctx.createRadialGradient(px, py, inner, px, py, outer);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.55, lit ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.28)");
    g.addColorStop(1, "rgba(0,0,0,0.92)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size.w, size.h);
  }

  function drawIntel() {
    for (const spot of game.intel) {
      if (spot.taken) continue;
      const area = spot.area || "underground";
      if (area !== game.area) continue;
      if (!inView(spot.x - 24, spot.y - 24, 48, 48)) continue;
      const x = Math.round(spot.x);
      const y = Math.round(spot.y + Math.sin(game.time * 2 + spot.pulse) * (spot.underwater ? 1 : 2));
      const glow = 0.5 + Math.sin(game.time * 4 + spot.pulse) * 0.5;
      ctx.save();
      if (spot.underwater) ctx.globalAlpha = 0.1;
      const c = spot.color || "#9fe7ff";
      if (spot.label.includes("BUTELKA")) {
        ctx.fillStyle = "#6fa99f";
        ctx.fillRect(x - 7, y - 16, 14, 28);
        ctx.fillStyle = "#b8d6cf";
        ctx.fillRect(x - 4, y - 22, 8, 7);
        ctx.fillStyle = "#f1dfb8";
        ctx.fillRect(x - 5, y - 3, 10, 9);
      } else if (spot.label.includes("ZAB")) {
        ctx.fillStyle = c;
        ctx.fillRect(x - 11, y - 12, 22, 24);
        ctx.fillStyle = "rgba(245, 238, 209, 0.8)";
        ctx.fillRect(x - 4, y - 7, 8, 12);
      } else if (spot.label.includes("KOSC")) {
        ctx.fillStyle = c;
        ctx.fillRect(x - 18, y - 5, 36, 10);
        ctx.fillRect(x - 22, y - 9, 10, 18);
        ctx.fillRect(x + 12, y - 9, 10, 18);
      } else if (spot.label.includes("PIENIAZEK")) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x, y, 13, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "rgba(92,57,36,0.35)";
        ctx.fillRect(x - 4, y - 8, 8, 16);
      } else if (spot.label.includes("NOGA")) {
        ctx.fillStyle = c;
        ctx.fillRect(x - 8, y - 18, 16, 36);
        ctx.fillStyle = "#5c3924";
        ctx.fillRect(x - 14, y + 12, 28, 8);
      } else if (spot.label.includes("MASC")) {
        ctx.fillStyle = "#2a3b26";
        ctx.fillRect(x - 12, y - 14, 24, 28);
        ctx.fillStyle = c;
        ctx.fillRect(x - 8, y - 8, 16, 16);
      } else {
        ctx.fillStyle = "#1c2a30";
        ctx.fillRect(x - 12, y - 10, 24, 20);
        ctx.fillStyle = `rgba(159, 231, 255, ${0.5 + glow * 0.4})`;
        ctx.fillRect(x - 8, y - 6, 16, 12);
        ctx.fillStyle = "#0c1418";
        for (let i = -6; i <= 6; i += 4) ctx.fillRect(x + i, y - 14, 2, 5);
      }
      ctx.fillStyle = spot.underwater ? "rgba(245, 238, 209, 0.56)" : palette.cream;
      ctx.font = "700 9px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(spot.underwater ? "?" : "INTEL", x, y + 24);
      ctx.textAlign = "left";
      ctx.restore();
      if (Math.hypot(game.player.x - spot.x, game.player.y - spot.y) < 60 && (!spot.underwater || game.player.swimming)) drawWorldHint(x, y - 26, "ZBIERZ");
    }
  }

  function drawForestWalls() {
    for (const wall of TERRAIN_SOLIDS) {
      const startX = Math.floor(wall.x / TILE) * TILE;
      const startY = Math.floor(wall.y / TILE) * TILE;
      const endX = wall.x + wall.w;
      const endY = wall.y + wall.h;
      ctx.save();
      ctx.fillStyle = "rgba(14, 34, 21, 0.34)";
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.beginPath();
      ctx.rect(wall.x, wall.y, wall.w, wall.h);
      ctx.clip();
      for (let y = startY; y < endY; y += TILE) {
        for (let x = startX; x < endX; x += TILE) {
          if (!rectsOverlap({ x, y, w: TILE, h: TILE }, wall)) continue;
          const mountain = x > 9200 || (x > 7200 && y > 3000);
          const clean = isRestoredAt(x + TILE / 2, y + TILE / 2) || game.state === "won";
          drawBushTile(x, y, mountain, clean);
        }
      }
      ctx.restore();
    }
  }

  function drawBushTile(x, y, mountain, clean) {
    const h = tileHash(x, y);
    ctx.save();
    if (mountain) {
      const base = h > 0.58 ? "#5f6864" : h > 0.25 ? "#4d5855" : "#3f4947";
      ctx.fillStyle = base;
      ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
      ctx.fillStyle = "rgba(18, 25, 24, 0.35)";
      ctx.fillRect(x + 8, y + 34, 22, 18);
      ctx.fillRect(x + 34, y + 18, 20, 28);
      ctx.fillStyle = "rgba(207, 216, 207, 0.3)";
      if (h > 0.34) ctx.fillRect(x + 11, y + 10, 34, 7);
      if (h > 0.66) ctx.fillRect(x + 26, y + 5, 22, 7);
      ctx.strokeStyle = "rgba(4, 9, 6, 0.64)";
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      ctx.restore();
      return;
    }

    const dark = clean ? "#1f7136" : "#12331d";
    const mid = clean ? "#38a346" : "#1f5f2d";
    const light = clean ? "#6de36a" : "#2f8841";
    const deep = clean ? "#174f2a" : "#0c2215";
    ctx.fillStyle = deep;
    ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);

    const dx = h > 0.5 ? 4 : 0;
    const dy = h < 0.35 ? 4 : 0;
    ctx.fillStyle = dark;
    ctx.fillRect(x + 8 + dx, y + 25, 25, 25);
    ctx.fillRect(x + 21, y + 12 + dy, 30, 28);
    ctx.fillRect(x + 34 - dx, y + 30, 22, 24);
    ctx.fillRect(x + 16, y + 42 - dy, 26, 14);

    ctx.fillStyle = mid;
    ctx.fillRect(x + 13 + dx, y + 28, 18, 17);
    ctx.fillRect(x + 28, y + 18 + dy, 20, 17);
    ctx.fillRect(x + 38 - dx, y + 35, 14, 14);
    if (h > 0.42) ctx.fillRect(x + 20, y + 46, 20, 8);

    ctx.fillStyle = light;
    ctx.globalAlpha = 0.22 + h * 0.18;
    ctx.fillRect(x + 18 + dx, y + 20, 10, 7);
    ctx.fillRect(x + 42 - dx, y + 27 + dy, 8, 7);
    if (h > 0.7) ctx.fillRect(x + 30, y + 40, 12, 6);
    ctx.globalAlpha = 1;

    if (h > 0.78) {
      ctx.fillStyle = clean ? "#8df07a" : "#3fa34e";
      ctx.fillRect(x + 9, y + 12, 8, 8);
      ctx.fillRect(x + 49, y + 48, 7, 7);
    }
    ctx.strokeStyle = "rgba(4, 9, 6, 0.64)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    ctx.restore();
  }

  function drawDecor() {
    const sorted = decor.slice().sort((a, b) => a.y - b.y);
    for (const item of sorted) {
      if (!inView(item.x - item.r, item.y - item.r, item.r * 2, item.r * 2)) continue;
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
    if (intense) {
      ctx.strokeStyle = "rgba(245, 238, 209, 0.38)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - r - 4, y - r - 4, r * 2 + 8, r * 2 + 8);
      ctx.fillStyle = "rgba(245, 238, 209, 0.55)";
      ctx.fillRect(x - 4, y - r - 12, 8, 8);
    }
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
      if (plank.metal) drawWirePlate(plank.x, plank.y, plank.angle, 1);
      else if (plank.bridgeStreamIndex !== null && plank.bridgeStreamIndex !== undefined) drawBridgePlank(plank);
      else drawPlank(plank.x, plank.y, plank.angle, 1);
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

  function drawWirePlate(x, y, angle, scale = 1) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    shadow(0, 15, 28, 7);
    ctx.fillStyle = "#8b989b";
    ctx.fillRect(-27, -13, 54, 26);
    ctx.strokeStyle = "rgba(28, 36, 38, 0.72)";
    ctx.lineWidth = 2;
    for (let x = -20; x <= 20; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, -11);
      ctx.lineTo(x + 8, 11);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(245, 238, 209, 0.28)";
    ctx.fillRect(-18, -7, 24, 4);
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
      // flowers and nuts stay put; only the special floating items bob
      const bobbing = pickup.type === "spinach" || pickup.type === "elixir" || pickup.type === "stick" || pickup.type === "heart";
      const y = bobbing ? pickup.y + Math.sin(pickup.bob) * 5 : pickup.y;
      shadow(pickup.x, pickup.y + 15, pickup.type === "nut" ? 18 : 24, 7);
      if (pickup.type === "flower") drawFlowerPickup(pickup.x, y, pickup.species, 1.05);
      else if (pickup.type === "nut") drawNut(pickup.x, y, 1, 0);
      else if (pickup.type === "elixir") drawElixir(pickup.x, y, 1);
      else if (pickup.type === "stick") drawStickPickup(pickup.x, y, 1);
      else if (pickup.type === "heart") drawHeartPickup(pickup.x, y, 1);
      else drawSpinach(pickup.x, y, 1);
    }
  }

  function drawStickPickup(x, y, scale) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    ctx.rotate(-0.5);
    ctx.fillStyle = palette.plank;
    ctx.fillRect(-30, -4, 60, 8);
    ctx.fillStyle = "#8a5a33";
    ctx.fillRect(-30, -4, 10, 8);
    ctx.fillStyle = "#5fbf62";
    ctx.fillRect(24, -8, 8, 8);
    ctx.restore();
  }

  function drawHeartPickup(x, y, scale) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    ctx.fillStyle = palette.red;
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.bezierCurveTo(-18, -3, -11, -19, 0, -10);
    ctx.bezierCurveTo(11, -19, 18, -3, 0, 12);
    ctx.fill();
    ctx.fillStyle = "rgba(126, 203, 119, 0.7)";
    ctx.fillRect(-3, -22, 6, 8);
    ctx.restore();
  }

  function drawGems() {
    for (const gem of game.gems) {
      if (gem.taken) continue;
      const y = gem.y + Math.sin(gem.pulse) * 4;
      shadow(gem.x, gem.y + 14, 20, 6);
      drawGemShape(gem.x, y, gem.color, 1);
      if (Math.hypot(game.player.x - gem.x, game.player.y - gem.y) < 70) drawWorldHint(gem.x, gem.y - 26, "ZBIERZ");
    }
  }

  function drawGemShape(x, y, color, scale) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    const glow = 0.5 + Math.sin(game.time * 4 + x) * 0.5;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(12, -3);
    ctx.lineTo(7, 14);
    ctx.lineTo(-7, 14);
    ctx.lineTo(-12, -3);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.4 + glow * 0.4;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(5, -3);
    ctx.lineTo(-2, 8);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawCritters() {
    if (game.worldRestored) return;
    for (const critter of game.critters) {
      drawCritter(critter);
      if (critter.near) drawWorldHint(critter.x, critter.y - 26, game.player.nuts > 0 ? "L NAKARM" : "BRAK ORZESZKA");
    }
  }

  function drawCritter(critter) {
    const x = Math.round(critter.x);
    const y = Math.round(critter.y + Math.sin(critter.phase) * 1.5);
    const r = critter.r;
    shadow(x, y + r * 0.8, r * 1.1, r * 0.3);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(Math.cos(critter.dir) < 0 ? -1 : 1, 1);
    if (critter.type === "rabbit") {
      ctx.fillStyle = "#c9b48f";
      ctx.fillRect(-r, -r * 0.3, r * 1.5, r * 0.9);
      ctx.fillRect(r * 0.3, -r * 0.8, r * 0.7, r * 0.7);
      ctx.fillRect(r * 0.5, -r * 1.7, 5, 18);
      ctx.fillRect(r * 0.8, -r * 1.65, 5, 18);
    } else if (critter.type === "hedgehog") {
      ctx.fillStyle = "#6e5a44";
      ctx.fillRect(-r, -r * 0.5, r * 1.8, r);
      ctx.fillStyle = "#3f3326";
      for (let i = -r; i < r; i += 5) ctx.fillRect(i, -r * 0.8, 3, 10);
      ctx.fillStyle = "#d9c3a0";
      ctx.fillRect(r * 0.6, -r * 0.2, r * 0.5, r * 0.6);
    } else if (critter.type === "fawn") {
      ctx.fillStyle = "#b07d46";
      ctx.fillRect(-r, -r * 0.3, r * 1.7, r * 0.85);
      ctx.fillRect(r * 0.4, -r * 0.8, r * 0.7, r * 0.65);
      ctx.fillStyle = "#f0e2c4";
      ctx.fillRect(-r * 0.4, -r * 0.1, 4, 4);
      ctx.fillRect(0, r * 0.1, 4, 4);
      ctx.fillStyle = "#7a5530";
      ctx.fillRect(-r * 0.6, r * 0.4, 5, 16);
      ctx.fillRect(r * 0.2, r * 0.4, 5, 16);
    } else {
      // healthy squirrel
      ctx.fillStyle = "#c77b3f";
      ctx.beginPath();
      ctx.arc(-r * 0.95, -r * 0.45, r * 0.7, 0, TAU);
      ctx.fill();
      ctx.fillRect(-r * 0.6, -r * 0.36, r * 1.1, r * 0.9);
      ctx.fillRect(r * 0.22, -r * 0.72, r * 0.7, r * 0.7);
    }
    ctx.fillStyle = "#1d1714";
    ctx.fillRect(r * 0.6, -r * 0.45, 4, 4);
    ctx.restore();
  }

  function drawMiniDams() {
    for (const dam of MINI_DAMS) {
      const x = dam.x;
      const y = dam.y;
      shadow(x, y + 8, 38, 9);
      // a heaped pile of gnawed sticks
      ctx.save();
      for (let i = 0; i < 9; i += 1) {
        const a = (i * 1.7) % TAU;
        const len = 26 + (i % 3) * 8;
        ctx.strokeStyle = i % 2 ? "#8a5a33" : "#b77b43";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x - 24 + i * 5, y + 8 - (i % 3) * 4);
        ctx.lineTo(x - 24 + i * 5 + Math.cos(a) * len, y + 8 - (i % 3) * 4 - Math.abs(Math.sin(a)) * 12);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(105, 215, 255, 0.16)";
      ctx.fillRect(x - 30, y + 12, 60, 6);
      ctx.restore();
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
    const powered = blockerPowered(blocker);
    shadow(blocker.cx, blocker.y + blocker.h + 10, blocker.w * 0.55, 10);
    ctx.save();
    ctx.fillStyle = powered ? "#20333d" : blocker.awake ? "#3a2533" : "#2b3538";
    ctx.fillRect(blocker.x, blocker.y, blocker.w, blocker.h);
    ctx.fillStyle = powered ? palette.aiBlue : blocker.awake ? palette.aiPink : "#64777a";
    ctx.fillRect(blocker.x + 12, blocker.y + 12, blocker.w - 24, 14);
    ctx.fillRect(blocker.x + 12, blocker.y + blocker.h - 26, blocker.w - 24, 14);
    ctx.fillStyle = powered ? palette.aiPink : blocker.awake ? palette.aiBlue : "#92a5a7";
    ctx.globalAlpha = 0.45 + pulse * 0.35;
    ctx.fillRect(blocker.cx - 15, blocker.cy - 15, 30, 30);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = powered ? palette.aiBlue : blocker.awake ? palette.aiPink : "rgba(245, 238, 209, 0.32)";
    ctx.lineWidth = 3;
    ctx.strokeRect(blocker.x + 5, blocker.y + 5, blocker.w - 10, blocker.h - 10);
    if (powered) {
      const blink = Math.floor(game.time * 2) % 2;
      for (let y = blocker.y + 22; y < blocker.y + blocker.h - 22; y += 32) {
        for (let x = blocker.x + 18; x < blocker.x + blocker.w - 18; x += 32) {
          const on = (Math.floor(x / 32) + Math.floor(y / 32) + blink) % 2 === 0;
          ctx.fillStyle = on ? "rgba(105, 215, 255, 0.72)" : "rgba(228, 84, 154, 0.42)";
          ctx.fillRect(x, y, 12, 12);
        }
      }
    }
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

  function drawServerDoor(server) {
    const dr = doorRect(server);
    ctx.save();
    if (server.doorOpen || server.destroyed) {
      ctx.fillStyle = "rgba(25, 35, 33, 0.72)";
      ctx.fillRect(dr.x, dr.y, dr.w, dr.h);
      ctx.fillStyle = "rgba(245, 238, 209, 0.12)";
      ctx.fillRect(dr.x + 8, dr.y + 8, Math.max(4, dr.w - 16), Math.max(4, dr.h - 16));
      ctx.restore();
      return;
    }
    const pulse = Math.sin(game.time * 5 + server.doorPulse) * 0.5 + 0.5;
    ctx.fillStyle = "#c8d0ca";
    ctx.fillRect(dr.x, dr.y, dr.w, dr.h);
    ctx.fillStyle = "#899597";
    ctx.fillRect(dr.x + 8, dr.y + 8, dr.w - 16, dr.h - 16);
    ctx.fillStyle = `rgba(105, 215, 255, ${0.22 + pulse * 0.28})`;
    if (dr.w >= dr.h) {
      ctx.fillRect(dr.x + 18, dr.y + dr.h / 2 - 4, dr.w - 36, 8);
    } else {
      ctx.fillRect(dr.x + dr.w / 2 - 4, dr.y + 18, 8, dr.h - 36);
    }
    ctx.strokeStyle = `rgba(245, 238, 209, ${0.34 + pulse * 0.28})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(dr.x + 4.5, dr.y + 4.5, dr.w - 9, dr.h - 9);
    ctx.fillStyle = "rgba(241, 91, 91, 0.82)";
    const hp = clamp(server.doorHp / server.doorMaxHp, 0, 1);
    if (dr.w >= dr.h) {
      ctx.fillRect(dr.x + 8, dr.y - 11, dr.w - 16, 6);
      ctx.fillStyle = palette.leafLight;
      ctx.fillRect(dr.x + 8, dr.y - 11, (dr.w - 16) * hp, 6);
    } else {
      ctx.fillRect(dr.x - 11, dr.y + 8, 6, dr.h - 16);
      ctx.fillStyle = palette.leafLight;
      ctx.fillRect(dr.x - 11, dr.y + 8 + (dr.h - 16) * (1 - hp), 6, (dr.h - 16) * hp);
    }
    ctx.restore();
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

  function drawRack(x, y, pulse, tall = true, color = palette.aiBlue) {
    const h = tall ? TILE * 2 : TILE;
    ctx.fillStyle = "#10171c";
    ctx.fillRect(x, y, TILE, h);
    ctx.fillStyle = "#222b30";
    ctx.fillRect(x + 8, y + 8, TILE - 16, h - 16);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.36 + pulse * 0.34;
    for (let yy = y + 18; yy < y + h - 10; yy += 22) {
      ctx.fillRect(x + 14, yy, 12, 6);
      ctx.fillRect(x + 36, yy, 14, 6);
    }
    ctx.globalAlpha = 1;
  }

  const SERVER_ACCENTS = ["#7ed957", "#ffb347", "#56d6c8", "#6a7bff", "#b06aff", "#4fd287", "#91a0a8", "#c9f4ff", "#d08b5a", "#ffd66d"];

  function drawComputerCore(server, core, pulse, accent) {
    if (core.destroyed) {
      const x = core.x - TILE, y = core.y - TILE;
      ctx.fillStyle = palette.bark;
      ctx.fillRect(core.x - 10, core.y, 20, 60);
      ctx.fillStyle = "#235c35";
      ctx.fillRect(x + 14, core.y - 36, 92, 60);
      drawTinyFlower({ x: core.x, y: core.y + 40, phase: core.pulse }, true);
      return;
    }
    const x = core.x - TILE;
    const y = core.y - TILE;
    ctx.fillStyle = core.hp / core.maxHp > 0.35 ? "#2c3137" : "#46343b";
    ctx.fillRect(x, y, TILE * 2, TILE * 2);
    ctx.fillStyle = "#0b1014";
    ctx.fillRect(x + 14, y + 18, TILE * 2 - 28, 18);
    ctx.fillRect(x + 14, y + 55, TILE * 2 - 28, 18);
    ctx.fillRect(x + 14, y + 91, TILE * 2 - 28, 16);
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.45 + pulse * 0.35;
    for (let i = 0; i < 8; i += 1) {
      ctx.fillRect(x + 18 + i * 11, y + 24, 5, 8);
      ctx.fillRect(x + 18 + i * 11, y + 61, 5, 8);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = server.powered ? `rgba(228, 84, 154, ${0.42 + pulse * 0.35})` : "rgba(126, 203, 119, 0.6)";
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 0.5, y + 0.5, TILE * 2 - 1, TILE * 2 - 1);
    if (!server.powered) {
      ctx.fillStyle = "rgba(126, 203, 119, 0.82)";
      ctx.font = "900 12px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("OFF", core.x, core.y + 4);
      ctx.textAlign = "left";
    }
    ctx.fillStyle = "rgba(241, 91, 91, 0.82)";
    ctx.fillRect(x, y + TILE * 2 + 8, TILE * 2, 7);
    ctx.fillStyle = palette.leafLight;
    ctx.fillRect(x, y + TILE * 2 + 8, TILE * 2 * (core.hp / core.maxHp), 7);
  }

  function drawServer(server) {
    const b = roomBounds(server);
    const pulse = Math.sin(game.time * 3 + server.pulse) * 0.5 + 0.5;
    const accent = SERVER_ACCENTS[server.num - 1] || palette.aiBlue;
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

    drawServerDoor(server);

    // racks fill the room, skipping each computer core's footprint
    const coreRects = server.cores.map((c) => ({ x: c.x - TILE - 8, y: c.y - TILE - 8, w: TILE * 2 + 16, h: TILE * 2 + 16 }));
    for (let x = b.x + TILE * 2; x < b.x + b.w - TILE * 2; x += TILE * 2) {
      for (let y = b.y + TILE; y < b.y + b.h - TILE * 2; y += TILE * 2) {
        const rk = { x, y, w: TILE, h: TILE * 2 };
        if (coreRects.some((cr) => rectsOverlap(rk, cr))) continue;
        if (server.partition && rectsOverlap(rk, { x: b.x + TILE * 2, y: b.y + server.wall, w: TILE, h: Math.floor(server.tilesH * 0.45) * TILE })) continue;
        drawRack(x, y, pulse, true, accent);
      }
    }

    for (const core of server.cores) drawComputerCore(server, core, pulse, accent);

    // floating number tag so the room is easy to identify (matches the underground labels)
    ctx.fillStyle = "rgba(13, 18, 16, 0.7)";
    ctx.fillRect(server.x - 16, b.y - 26, 32, 20);
    ctx.fillStyle = accent;
    ctx.font = "900 14px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("#" + server.num, server.x, b.y - 15);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }

  function drawServerRuin(server) {
    const b = roomBounds(server);
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

    // a young tree sprouts where each computer once stood
    for (const core of server.cores) {
      ctx.fillStyle = palette.bark;
      ctx.fillRect(core.x - 12, core.y - 6, 24, 78);
      ctx.fillStyle = "#235c35";
      ctx.fillRect(core.x - 42, core.y - 50, 84, 58);
      ctx.fillRect(core.x - 28, core.y - 84, 56, 42);
    }
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
    for (const follower of followers) {
      if (follower.type === "rabbit" || follower.type === "hedgehog" || follower.type === "fawn") {
        drawCritter({ type: follower.type, x: follower.x, y: follower.y, r: follower.r, phase: follower.phase, dir: 0 });
      } else {
        drawAnimal(follower, true);
      }
    }
  }

  function drawSharks() {
    for (const shark of sharks) drawShark(shark);
  }

  function drawShark(shark) {
    const x = Math.round(shark.cx || shark.x);
    const y = Math.round(shark.cy || shark.y);
    const wake = 0.5 + Math.sin(game.time * 5 + shark.phase) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.translate(x, y);
    ctx.rotate(shark.drawDir || shark.dir);
    ctx.fillStyle = "rgba(11, 28, 35, 0.55)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 42, 14, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#8fa4aa";
    ctx.beginPath();
    ctx.moveTo(-4, -5);
    ctx.lineTo(10, -34 - wake * 4);
    ctx.lineTo(24, -4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#c8d4d5";
    ctx.fillRect(22, -3, 12, 5);
    ctx.restore();
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
    const gold = dolphin.golden;
    const body = gold ? "#e8b84b" : "#6aaec4";
    const belly = gold ? "#f6e3a3" : "#bfe8ef";
    const fin = gold ? "#c79530" : "#4d8ea8";
    ctx.save();
    ctx.fillStyle = gold ? "rgba(255, 214, 120, 0.28)" : "rgba(105, 215, 255, 0.28)";
    ctx.fillRect(Math.round(baseX - 36), Math.round(baseY + 8), 72, 6);
    ctx.fillRect(Math.round(baseX - 18), Math.round(baseY + 20), 36, 4);
    ctx.translate(x, y);
    const pitch = -Math.cos(progress * Math.PI * 2) * 0.22;
    ctx.rotate(dolphin.dir + pitch);
    if (gold) {
      ctx.shadowBlur = 16;
      ctx.shadowColor = "rgba(255, 214, 120, 0.8)";
    }
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 38, 14, -0.06, 0, TAU);
    ctx.fill();
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(11, 7, 22, 5.5, -0.03, 0, TAU);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(35, -1, 18, 7, -0.03, 0, TAU);
    ctx.fill();
    ctx.fillStyle = fin;
    ctx.beginPath();
    ctx.moveTo(-8, -9);
    ctx.lineTo(5, -31);
    ctx.lineTo(14, -8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(5, 8);
    ctx.lineTo(18, 25);
    ctx.lineTo(24, 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-34, -1);
    ctx.lineTo(-58, -14);
    ctx.lineTo(-48, 0);
    ctx.lineTo(-58, 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1b2b30";
    ctx.fillRect(42, -7, 4, 4);
    ctx.restore();
  }

  function drawFriendlyCritters() {
    for (const critter of friendlyCritters) {
      if (critter.type === "rabbit" || critter.type === "hedgehog" || critter.type === "fawn") {
        drawCritter({ type: critter.type, x: critter.x, y: critter.y, r: critter.r, phase: critter.phase, dir: critter.dir || 0 });
      } else {
        drawAnimal(critter, true);
      }
    }
  }

  function drawBoss() {
    const boss = game.boss;
    if (boss.defeated) {
      drawRestoredTree(boss.x, boss.y);
      return;
    }

    const exposed = bossCoresLeftCount() === 0;
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
      if (shot.metal) drawWirePlate(shot.x, shot.y, shot.angle + game.time * shot.spin, 1.05);
      else drawPlank(shot.x, shot.y, shot.angle + game.time * shot.spin, 1.05);
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
      // a fainter shield aura than before
      ctx.strokeStyle = `rgba(78, 208, 109, ${0.22 + Math.sin(game.time * 4) * 0.08})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(-29, -27, 58, 54);
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
    ctx.fillStyle = p.goldTeeth ? "#ffd66d" : palette.cream;
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

    if (p.swimming) {
      // half-submerged: water hides the lower body, with a rippling surface line
      const wob = Math.sin(game.time * 4) * 2;
      ctx.fillStyle = "rgba(49, 93, 115, 0.78)";
      ctx.fillRect(-20, 2 + wob, 40, 24);
      ctx.fillStyle = "rgba(105, 215, 255, 0.5)";
      ctx.fillRect(-22, 1 + wob, 44, 3);
      ctx.fillRect(-16, 7 + wob, 12, 2);
      ctx.fillRect(6, 5 + wob, 12, 2);
    }

    if (p.heldPlank) {
      const hx = Math.cos(p.facing + 0.7) * 23;
      const hy = Math.sin(p.facing + 0.7) * 23;
      if (p.heldPlank.metal) drawWirePlate(hx, hy, p.facing + 0.08, 0.82);
      else drawPlank(hx, hy, p.facing + 0.08, 0.85);
    }

    if (p.punchCooldown > 0.29) {
      ctx.strokeStyle = "rgba(245, 238, 209, 0.7)";
      ctx.lineWidth = 3;
      const bx = Math.cos(p.facing) * 30;
      const by = Math.sin(p.facing) * 30;
      ctx.strokeRect(bx - 14, by - 12, 28, 24);
      ctx.fillStyle = p.goldTeeth ? "#ffd66d" : palette.cream;
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
    ctx.fillText("SERWERY", 34, 68);
    for (let i = 0; i < game.servers.length; i += 1) {
      const s = game.servers[i];
      ctx.fillStyle = s.destroyed ? palette.leafLight : palette.aiPink;
      ctx.beginPath();
      ctx.roundRect(108 + i * 22, 61, 15, 15, 4);
      ctx.fill();
      ctx.fillStyle = "rgba(13, 18, 16, 0.85)";
      ctx.font = "800 9px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(s.num), 108 + i * 22 + 7.5, 69);
      ctx.textAlign = "left";
      ctx.font = "700 13px Inter, system-ui, sans-serif";
    }

    const rightW = p.tailLevel > 0 || p.shield > 0 || p.heldPlank || p.nuts > 0 || audioMuted ? 236 : 118;
    glassPanel(size.w - rightW - 18, 18, rightW, 72);
    drawMiniMap(size.w - rightW, 31, rightW - 34, 44);

    glassPanel(18, size.h - 76, 172, 56);
    drawTailIcon(43, size.h - 46, 0.82);
    ctx.font = "800 12px Inter, system-ui, sans-serif";
    ctx.fillStyle = palette.cream;
    ctx.fillText("OGON", 70, size.h - 54);
    ctx.fillText(Math.round(35 + p.tailLevel * 8) + " CM", 70, size.h - 34);
    meter(118, size.h - 58, 56, 8, clamp(p.tailLevel / 12, 0, 1), palette.beaver);
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
      meter(size.w - 150, size.h - 47, 84, 8, p.shield / 60, palette.spinach);
    }

    // backpack indicator + open hint
    ctx.font = "800 12px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(245, 238, 209, 0.78)";
    ctx.fillText("PLECAK [I] " + game.items.length, size.w / 2 - 40, size.h - 24);

    ctx.restore();
  }

  function drawItemIcon(x, y, it) {
    ctx.save();
    if (it.id === "gem") {
      drawGemShape(x, y, it.color, 0.9);
    } else if (it.id === "book") {
      ctx.fillStyle = "#7a4b2c";
      ctx.fillRect(x - 12, y - 9, 24, 18);
      ctx.fillStyle = "#f5eed1";
      ctx.fillRect(x - 8, y - 6, 7, 12);
      ctx.fillRect(x + 1, y - 6, 7, 12);
    } else if (it.id === "key") {
      ctx.fillStyle = "#ffd66d";
      ctx.fillRect(x - 12, y - 3, 24, 6);
      ctx.fillRect(x + 8, y - 8, 8, 16);
    } else if (it.id === "oldCoin") {
      ctx.fillStyle = "#d6b25e";
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, TAU);
      ctx.fill();
    } else if (it.id === "letter1") {
      ctx.fillStyle = "#d4a15b";
      ctx.fillRect(x - 14, y - 8, 28, 18);
      ctx.fillStyle = "#f5eed1";
      ctx.fillRect(x - 10, y - 4, 20, 3);
      ctx.fillRect(x - 7, y + 2, 14, 3);
    } else if (it.id === "letter2") {
      ctx.fillStyle = "#c2b28c";
      ctx.fillRect(x - 13, y - 10, 26, 20);
      ctx.fillStyle = "#6aaec4";
      ctx.fillRect(x - 9, y + 5, 18, 3);
      ctx.fillRect(x - 5, y - 4, 10, 3);
    } else if (it.id === "journal1") {
      ctx.fillStyle = "#6d6f68";
      ctx.fillRect(x - 13, y - 12, 26, 24);
      ctx.fillStyle = "#dce4df";
      ctx.fillRect(x - 8, y - 7, 16, 4);
      ctx.fillRect(x - 4, y - 13, 8, 5);
    } else if (it.id === "logbook") {
      ctx.fillStyle = "#2f6f45";
      ctx.fillRect(x - 14, y - 11, 28, 22);
      ctx.fillStyle = "#d0a66e";
      ctx.fillRect(x - 9, y - 5, 18, 3);
      ctx.fillRect(x - 9, y + 2, 12, 3);
    } else if (it.id === "manual") {
      ctx.fillStyle = "#b6c6c9";
      ctx.fillRect(x - 12, y - 13, 24, 26);
      ctx.fillStyle = "#2f4b55";
      ctx.fillRect(x - 7, y - 8, 14, 4);
      ctx.fillRect(x - 7, y, 14, 3);
      ctx.fillRect(x - 7, y + 6, 9, 3);
    } else if (it.id === "lastNote") {
      ctx.fillStyle = "#e0d5bf";
      ctx.fillRect(x - 11, y - 12, 22, 24);
      ctx.fillStyle = "rgba(92,57,36,0.45)";
      ctx.fillRect(x - 6, y - 5, 12, 3);
      ctx.fillRect(x - 8, y + 3, 16, 3);
      ctx.fillRect(x + 6, y - 12, 5, 5);
    } else if (it.id === "hat") {
      ctx.fillStyle = "#34463d";
      ctx.fillRect(x - 14, y + 4, 28, 6);
      ctx.fillRect(x - 7, y - 10, 14, 14);
    } else if (it.id === "boots") {
      ctx.fillStyle = "#3a3a2c";
      ctx.fillRect(x - 12, y - 8, 10, 18);
      ctx.fillRect(x - 12, y + 6, 18, 6);
      ctx.fillRect(x + 2, y - 8, 10, 18);
      ctx.fillRect(x + 2, y + 6, 16, 6);
    } else if (it.id === "stick") {
      ctx.strokeStyle = palette.plank;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x - 14, y + 8);
      ctx.lineTo(x + 14, y - 8);
      ctx.stroke();
    } else if (it.id === "flashlight") {
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(x - 12, y - 6, 14, 12);
      ctx.fillStyle = "#ffe07a";
      ctx.beginPath();
      ctx.moveTo(x + 2, y - 8);
      ctx.lineTo(x + 16, y - 12);
      ctx.lineTo(x + 16, y + 12);
      ctx.lineTo(x + 2, y + 8);
      ctx.closePath();
      ctx.fill();
    } else if (it.id === "intel" && it.label && it.label.includes("BUTELKA")) {
      ctx.fillStyle = "#6fa99f";
      ctx.fillRect(x - 7, y - 15, 14, 27);
      ctx.fillStyle = "#b8d6cf";
      ctx.fillRect(x - 4, y - 21, 8, 7);
      ctx.fillStyle = "#f1dfb8";
      ctx.fillRect(x - 5, y - 2, 10, 9);
    } else if (it.id === "intel" && it.label && it.label.includes("ZĄB")) {
      ctx.fillStyle = "#ffd66d";
      ctx.fillRect(x - 9, y - 12, 18, 24);
      ctx.fillStyle = "rgba(92,57,36,0.25)";
      ctx.fillRect(x - 3, y - 5, 6, 12);
    } else if (it.id === "intel" && it.label && it.label.includes("KOŚĆ")) {
      ctx.fillStyle = it.color || "#e8dcc4";
      ctx.fillRect(x - 18, y - 5, 36, 10);
      ctx.fillRect(x - 22, y - 9, 10, 18);
      ctx.fillRect(x + 12, y - 9, 10, 18);
    } else if (it.id === "intel" && it.label && it.label.includes("PIENIĄŻEK")) {
      ctx.fillStyle = "#d6b25e";
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(92,57,36,0.35)";
      ctx.fillRect(x - 3, y - 8, 6, 16);
    } else if (it.id === "intel" && it.label && it.label.includes("NOGA")) {
      ctx.fillStyle = "#b77b43";
      ctx.fillRect(x - 7, y - 17, 14, 34);
      ctx.fillStyle = "#5c3924";
      ctx.fillRect(x - 13, y + 10, 26, 8);
    } else if (it.id === "intel" && it.label && it.label.includes("MAŚĆ")) {
      ctx.fillStyle = "#2a3b26";
      ctx.fillRect(x - 12, y - 14, 24, 28);
      ctx.fillStyle = "#7ed957";
      ctx.fillRect(x - 8, y - 8, 16, 16);
    } else {
      ctx.fillStyle = "#1c2a30";
      ctx.fillRect(x - 12, y - 9, 24, 18);
      ctx.fillStyle = "#9fe7ff";
      ctx.fillRect(x - 8, y - 5, 16, 10);
      ctx.fillStyle = "#0c1418";
      for (let i = -8; i <= 8; i += 4) ctx.fillRect(x + i, y - 13, 2, 4);
    }
    ctx.restore();
  }

  function inventoryMetrics(size) {
    const panelW = Math.min(720, size.w - 42);
    const panelX = size.w / 2 - panelW / 2;
    const panelY = Math.max(30, Math.min(64, size.h * 0.08));
    const panelH = Math.max(240, Math.min(size.h - panelY * 2, 560));
    const rowH = 62;
    const listTop = panelY + 62;
    const listH = Math.max(96, panelH - 86);
    return { panelW, panelX, panelY, panelH, rowH, listTop, listH };
  }

  function clampInventoryScroll(size = screenSize()) {
    if (!game) return 0;
    const m = inventoryMetrics(size);
    const maxScroll = Math.max(0, game.items.length * m.rowH - m.listH);
    game.inventoryScroll = clamp(game.inventoryScroll || 0, 0, maxScroll);
    return maxScroll;
  }

  function scrollInventory(delta) {
    if (!game || !game.inventoryOpen) return;
    const size = screenSize();
    const maxScroll = clampInventoryScroll(size);
    game.inventoryScroll = clamp((game.inventoryScroll || 0) + delta, 0, maxScroll);
  }

  function drawInventory(size) {
    invButtons.length = 0;
    const m = inventoryMetrics(size);
    const maxScroll = clampInventoryScroll(size);
    const scroll = game.inventoryScroll || 0;
    ctx.save();
    ctx.fillStyle = "rgba(6, 9, 8, 0.84)";
    ctx.fillRect(0, 0, size.w, size.h);
    ctx.fillStyle = "rgba(13, 18, 16, 0.92)";
    ctx.fillRect(m.panelX, m.panelY, m.panelW, m.panelH);
    ctx.strokeStyle = "rgba(245, 238, 209, 0.22)";
    ctx.lineWidth = 1;
    ctx.strokeRect(m.panelX + 0.5, m.panelY + 0.5, m.panelW - 1, m.panelH - 1);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = palette.cream;
    ctx.font = "900 24px Inter, system-ui, sans-serif";
    ctx.fillText("PLECAK", m.panelX + 24, m.panelY + 40);
    ctx.font = "700 12px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(245, 238, 209, 0.6)";
    ctx.fillText("[I] lub [ESC] zamyka plecak", m.panelX + 132, m.panelY + 40);

    if (!game.items.length) {
      ctx.fillStyle = "rgba(245, 238, 209, 0.6)";
      ctx.font = "700 15px Inter, system-ui, sans-serif";
      ctx.fillText("Plecak jest pusty. Zagladaj do chatek, nor i zdobytych serwerowni.", m.panelX + 24, m.panelY + 92);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(m.panelX + 12, m.listTop, m.panelW - 24, m.listH);
    ctx.clip();
    for (let i = 0; i < game.items.length; i += 1) {
      const it = game.items[i];
      const y = m.listTop + i * m.rowH - scroll;
      if (y + m.rowH < m.listTop) continue;
      if (y > m.listTop + m.listH) continue;
      ctx.fillStyle = "rgba(245, 238, 209, 0.05)";
      ctx.fillRect(m.panelX + 14, y, m.panelW - 34, m.rowH - 8);
      drawItemIcon(m.panelX + 44, y + 26, it);
      ctx.fillStyle = it.color || palette.cream;
      ctx.font = "800 15px Inter, system-ui, sans-serif";
      ctx.fillText(it.label, m.panelX + 78, y + 20);
      ctx.fillStyle = "rgba(245, 238, 209, 0.82)";
      ctx.font = "600 12px Inter, system-ui, sans-serif";
      let dy = y + 38;
      for (const line of wrapText(it.desc || "", m.panelW - 182).slice(0, 2)) {
        ctx.fillText(line, m.panelX + 78, dy);
        dy += 15;
      }
    }
    ctx.restore();

    if (maxScroll > 0) {
      const trackX = m.panelX + m.panelW - 14;
      const trackY = m.listTop;
      const trackH = m.listH;
      const contentH = game.items.length * m.rowH;
      const thumbH = Math.max(28, trackH * trackH / contentH);
      const thumbY = trackY + (trackH - thumbH) * (scroll / maxScroll);
      ctx.fillStyle = "rgba(245, 238, 209, 0.12)";
      ctx.fillRect(trackX, trackY, 4, trackH);
      ctx.fillStyle = "rgba(126, 203, 119, 0.72)";
      ctx.fillRect(trackX - 1, thumbY, 6, thumbH);
    }
    ctx.restore();
  }

  function discardItem(index) {
    const it = game.items[index];
    if (!it) return;
    const p = game.player;
    if (it.id === "hat") p.hat = false;
    else if (it.id === "boots") p.boots = false;
    else if (it.id === "book") p.book = false;
    else if (it.id === "stick") p.longStick = false;
    else if (it.id === "flashlight") p.tailLight = false;
    game.items.splice(index, 1);
    game.message = it.label + " WYRZUCONY";
    game.messageTimer = 1.6;
    playTone("drop");
  }

  function toggleInventory() {
    if (!game || (game.state !== "play" && !game.inventoryOpen)) return;
    game.inventoryOpen = !game.inventoryOpen;
    if (game.inventoryOpen) clampInventoryScroll();
    playTone("pickup");
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
    ctx.fillText(progress >= 1 ? "natura została uwolniona od maszyn" : "świat na nowo odżywa", size.w / 2, size.h / 2 + 72);
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

  // The title is the word NATURAL drawn as graphics. The L's horizontal foot is dimmed to ~10%,
  // so at a glance it reads NATURAI (the AL swapped for AI). As the world heals it brightens back.
  function drawLogo(cx, y, scale = 1, naturalProgress = 0) {
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `900 ${Math.round(54 * scale)}px Inter, system-ui, sans-serif`;
    const word = "NATURA";
    const wordW = ctx.measureText(word).width;
    const stem = 9 * scale;
    const foot = 26 * scale;
    const gap = 9 * scale;
    const x = cx - (wordW + gap + foot) / 2;
    ctx.fillStyle = palette.cream;
    ctx.fillText(word, x, y);
    // hand-drawn L
    const lx = Math.round(x + wordW + gap);
    const capH = 39 * scale;
    ctx.fillStyle = palette.cream;
    ctx.fillRect(lx, Math.round(y - capH), Math.round(stem), Math.round(capH));
    ctx.globalAlpha = 0.1 + clamp(naturalProgress, 0, 1) * 0.85;
    ctx.fillStyle = palette.leafLight;
    ctx.fillRect(lx, Math.round(y - stem), Math.round(foot), Math.round(stem));
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawControlRows(panelX, y, panelW, rows, opts = {}) {
    ctx.save();
    ctx.textBaseline = "middle";
    const rowH = opts.rowH || 19;
    const chipX = panelX + 24;
    const chipW = Math.min(110, Math.max(86, panelW * 0.22));
    const chipH = Math.max(14, Math.min(18, rowH - 3));
    const keyFont = rowH < 18 ? 10 : 11;
    const textFont = rowH < 18 ? 10 : 11;
    for (let i = 0; i < rows.length; i += 1) {
      const rowY = y + i * rowH;
      ctx.fillStyle = "rgba(126, 203, 119, 0.16)";
      ctx.beginPath();
      ctx.roundRect(chipX, rowY - chipH / 2, chipW, chipH, 4);
      ctx.fill();
      ctx.fillStyle = palette.cream;
      ctx.font = `800 ${keyFont}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(rows[i][0], chipX + chipW / 2, rowY + 1);
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(245, 238, 209, 0.82)";
      ctx.font = `600 ${textFont}px Inter, system-ui, sans-serif`;
      ctx.fillText(rows[i][1], chipX + chipW + 16, rowY + 1);
    }
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }

  function drawPausePanel(size) {
    const panelW = Math.min(560, size.w - 40);
    const panelH = Math.min(386, size.h - 70);
    const panelX = size.w / 2 - panelW / 2;
    const panelY = Math.max(56, size.h / 2 - panelH / 2 + 20);
    const rows = [
      ["WASD", "ruch (lub strzalki)"],
      ["SHIFT / B", "bieg (nie w wodzie)"],
      ["SPACJA", "rozmowa / gryzienie / atak"],
      ["J", "podnieś / połóż deskę"],
      ["K", "rzut deską (atak na odległość)"],
      ["L", "nakarm zwierzę"],
      ["I", "plecak"],
      ["E", "wejdź / wyjdź z nory"],
      ["M", "dźwięk włącz / wyłącz"],
      ["ESC / P", "wroć do gry"],
      ["R", "zacznij od nowa"]
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
    const rowsY = actionY + 88;
    const rowH = clamp(Math.floor((panelY + panelH - rowsY - 14) / rows.length), 16, 20);
    drawControlRows(panelX, rowsY, panelW, rows, { rowH });
    ctx.restore();
  }

  function drawMenu(size) {
    ctx.save();
    ctx.fillStyle = "rgba(6, 9, 8, 0.76)";
    ctx.fillRect(0, 0, size.w, size.h);
    const cx = size.w / 2;
    const panelW = Math.min(540, size.w - 48);
    const panelX = cx - panelW / 2;
    const panelH = 300;
    const panelY = Math.max(150, size.h / 2 - 40);

    ctx.textAlign = "center";
    drawLogo(cx, panelY - 96, 1);
    ctx.font = "700 15px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(245, 238, 209, 0.72)";
    ctx.fillText("Uwolnij świat", cx, panelY - 62);

    ctx.fillStyle = "rgba(13, 18, 16, 0.72)";
    ctx.fillRect(panelX, panelY + 14, panelW, panelH);
    ctx.strokeStyle = "rgba(245, 238, 209, 0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 0.5, panelY + 14.5, panelW - 1, panelH - 1);

    ctx.textAlign = "left";
    ctx.fillStyle = palette.cream;
    ctx.font = "900 14px Inter, system-ui, sans-serif";
    ctx.fillText("STEROWANIE", panelX + 24, panelY + 42);

    const rows = [
      ["WASD", "ruch (lub strzalki)"],
      ["SHIFT / B", "bieg (nie w wodzie)"],
      ["SPACJA", "rozmowa / gryzienie / atak"],
      ["J", "podnieś / połóż deskę"],
      ["K", "rzut deską (atak na odległość)"],
      ["L", "nakarm zwierzę"],
      ["I", "plecak"],
      ["E", "wejdź / wyjdź z nory"],
      ["M", "dźwięk włącz / wyłącz"],
      ["ESC / P", "wroć do gry"],
      ["R", "zacznij od nowa"]
    ];

    drawControlRows(panelX, panelY + 66, panelW, rows, { rowH: 19 });

    ctx.textAlign = "center";
    ctx.font = "900 26px Inter, system-ui, sans-serif";
    ctx.fillStyle = palette.cream;
    ctx.fillText("START", cx, panelY + panelH + 56);
    ctx.font = "700 12px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(245, 238, 209, 0.62)";
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

  // Freed wildlife that returns when a server room falls — these stay for good and roam the meadow.
  function spawnFriendlyRing(x, y) {
    const kinds = ["cat", "dog", "squirrel", "rabbit"];
    for (let i = 0; i < 4; i += 1) {
      const open = findOpenSpot(x + Math.cos(i * TAU / 4) * 90, y + Math.sin(i * TAU / 4) * 90, 22);
      friendlyCritters.push({
        type: kinds[i],
        x: open.x,
        y: open.y,
        r: i % 2 ? 18 : 16,
        phase: rand() * TAU,
        dir: rand() * TAU,
        permanent: true
      });
    }
  }

  function serversLeftCount() {
    return game.servers.filter((server) => !server.destroyed).length;
  }

  function bossCoresLeftCount() {
    return game.bossCores.filter((core) => !core.destroyed).length;
  }

  function isRestoredAt(x, y) {
    if (game.worldRestored) return true;
    for (const server of game.servers) {
      if (server.destroyed && Math.hypot(x - server.x, y - server.y) < 330) return true;
    }
    return false;
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
    const bossDistance = game && game.player ? Math.hypot(game.player.x - BOSS_X, game.player.y - BOSS_Y) : 99999;
    const dataDistance = game && game.player ? Math.hypot(game.player.x - (DATA_CENTER.x + DATA_CENTER.w / 2), game.player.y - (DATA_CENTER.y + DATA_CENTER.h / 2)) : 99999;
    musicGain.gain.setTargetAtTime(bossDistance < 760 ? 0.76 : dataDistance < 1700 ? 0.72 : 0.68, context.currentTime, 0.8);
    if (context.currentTime < audio.nextNote) return;

    const nearBoss = game && game.player && Math.hypot(game.player.x - BOSS_X, game.player.y - BOSS_Y) < 760;
    const nearData = game && game.player && Math.hypot(game.player.x - (DATA_CENTER.x + DATA_CENTER.w / 2), game.player.y - (DATA_CENTER.y + DATA_CENTER.h / 2)) < 1700;
    const scale = nearBoss ? [110, 147, 165, 196, 220, 233, 294, 330] : nearData ? [123, 165, 196, 220, 247, 294, 330, 392] : [147, 196, 220, 247, 294, 330, 392, 440];
    const phrase = nearBoss ? [0, 1, 3, 2, 5, 4, 2, 1, 6, 5, 3, 1] : nearData ? [0, 2, 4, 3, 5, 3, 1, 4, 2, 5, 3, 2] : [0, 2, 3, 5, 3, 2, 0, 4, 3, 1, 2, 5];
    const step = phrase[audio.index % phrase.length];
    const octave = audio.index % 12 === 0 ? 0.5 : audio.index % 5 === 0 ? 1.5 : 1;
    const note = scale[step % scale.length] * octave;
    const now = context.currentTime;

    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "sine";
    osc.frequency.value = note;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(now);
    osc.stop(now + 0.94);

    if (audio.index % 3 === 1) {
      const echo = context.createOscillator();
      const echoGain = context.createGain();
      echo.type = "sine";
      echo.frequency.value = scale[(step + 2) % scale.length] * octave;
      echoGain.gain.setValueAtTime(0.0001, now + 0.18);
      echoGain.gain.exponentialRampToValueAtTime(0.09, now + 0.28);
      echoGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);
      echo.connect(echoGain);
      echoGain.connect(musicGain);
      echo.start(now + 0.18);
      echo.stop(now + 1.1);
    }

    if (audio.index % 4 === 0) {
      const bass = context.createOscillator();
      const bassGain = context.createGain();
      bass.type = "triangle";
      bass.frequency.value = scale[0] * 0.5;
      bassGain.gain.setValueAtTime(0.0001, now);
      bassGain.gain.exponentialRampToValueAtTime(0.08, now + 0.06);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
      bass.connect(bassGain);
      bassGain.connect(musicGain);
      bass.start(now);
      bass.stop(now + 1.2);
    }

    audio.nextNote = now + 0.74;
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
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Enter", "KeyE", "Escape", "KeyP", "KeyR", "KeyJ", "KeyK", "KeyL", "KeyM", "KeyI", "KeyB", "ShiftLeft", "ShiftRight"].includes(event.code)) {
      event.preventDefault();
    }
    initAudio();
    if (event.code === "KeyM") {
      if (!event.repeat) toggleMute();
      return;
    }
    if (event.code === "KeyI" && (game.state === "play" || game.inventoryOpen)) {
      if (!event.repeat) toggleInventory();
      return;
    }
    if (game.inventoryOpen) {
      if (event.code === "Escape") { if (!event.repeat) game.inventoryOpen = false; return; }
      if (!event.repeat && event.code === "ArrowDown") scrollInventory(56);
      if (!event.repeat && event.code === "ArrowUp") scrollInventory(-56);
      if (!event.repeat && event.code === "PageDown") scrollInventory(220);
      if (!event.repeat && event.code === "PageUp") scrollInventory(-220);
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
    if (game.state === "play" && !game.inventoryOpen && !event.repeat) {
      if (event.code === "KeyJ") {
        handlePlankAction();
        return;
      }
      if (event.code === "KeyK") {
        throwPlank();
        return;
      }
      if (event.code === "KeyL") {
        feedAnimal();
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
    const rect = canvas.getBoundingClientRect();
    const sx = (event.clientX - rect.left) * (screenSize().w / rect.width);
    const sy = (event.clientY - rect.top) * (screenSize().h / rect.height);
    if (game.inventoryOpen) return;
    if (game.state !== "play") return;
    const p = game.player;
    const worldX = camera.x + sx;
    const worldY = camera.y + sy;
    p.facing = Math.atan2(worldY - p.y, worldX - p.x);
    if (event.button === 2 || event.shiftKey) throwPlank();
    else punch();
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("wheel", (event) => {
    if (!game || !game.inventoryOpen) return;
    event.preventDefault();
    scrollInventory(event.deltaY);
  }, { passive: false });

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
