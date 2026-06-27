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
 * Sterowanie (ruch TYLKO strzalkami, reszta na q/w/e/a/s/d/c):
 *   Ruch: strzalki
 *   W: gryzienie (jedyny atak)
 *   E: nora / skrzynia / rozmowa z NPC
 *   A: nakarm zwierze              S: chwyc / upusc drewno
 *   D: rzut drewnem                C: nurkowanie / wynurzenie (gleboka woda)
 *   I: ekwipunek   M: dzwiek   R: reset   "-": tryb ducha (ukryty)
 */
(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const screenCtx = canvas.getContext("2d");
  // Bufor pikselozy: swiat rysujemy w niskiej rozdzielczosci (1 jednostka swiata
  // = 1 piksel bufora) i skalujemy w gore BEZ wygladzania -> grube, kwadratowe
  // piksele zamiast plynnych, wektorowych ksztaltow.
  const pixelCanvas = document.createElement("canvas");
  const pixelCtx = pixelCanvas.getContext("2d");
  // `ctx` to AKTYWNY kontekst rysowania: przelaczany na bufor podczas rysowania
  // swiata, a z powrotem na ekran przy HUD/menu (ostry tekst interfejsu).
  let ctx = screenCtx;

  const TAU = Math.PI * 2;
  const DPR_LIMIT = 2;
  const TILE = 14;                 // piksele na kafelek
  const VISIBLE_TILE_ROWS = 15;    // okno gry = 15 kafelkow wysokosci...
  const VISIBLE_TILE_COLS = 30;    // ...i 30 kafelkow szerokosci (MAP-002)
  const PLAYER_RADIUS = TILE * 0.34;
  const REGION_RADIUS = TILE * 0.3;  // ciasniejszy promien do tuneli/wody
  const SPRITE = TILE * 0.46;        // maks. promien sprite'a - wszystko <= 1 kafelek
  const BASE_SPEED = TILE * 5.2;   // wolniej - styl pikselowy, mniej "plynnego" scigania
  const WATER_SPRITE = SPRITE * 2.5; // rekiny i delfiny: wieksze o 150% (2.5x bazowego sprite)
  const PIXEL_BLOCK = 2;           // rozmiar twardego, kwadratowego piksela na ekranie (CSS px)
  // parametry ostatniej transformacji swiat->ekran (do rysowania ostrego tekstu nad pikseloza)
  const view2screen = { scale: 1, ox: 0, oy: 0 };

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

  // OBSADA NPC: kazdy bober/kret ma IMIE wprost przypisane do swojej WYPOWIEDZI
  // (po kolei, wedlug pojawienia sie na mapie) - latwo skojarzyc, kto co mowi.
  // Bobry: pierwszy napotkany Beaver_NPC to BORYS, drugi KASPER, itd.
  const BEAVER_CAST = [
    { name: "BORYS",     lines: ["Jestem przekonany, ze gdyby wszyscy ludzie zyli w takiej prostocie jak ja nad stawem, nie znano by zlodziejstwa ani rabunku."] },
    { name: "KASPER",    lines: ["Zbieraj kwiaty. Ogon rosnie powoli, ale kazdy platkowy sok dodaje ci sily."] },
    { name: "DRZEWOMIR", lines: ["W glebokiej wodzie da sie zanurkowac.", "Na dnie leza stare wraki i dane sprzed epoki maszyn."] },
    { name: "TYMON",     lines: ["Najpierw serwerownie, potem boss w data center na wschodzie.", "Dopoki choc jedna dziala, boss jest nietykalny."] },
    { name: "FILON",     lines: ["Drzwi elektryczne raza tylko z pozoru - kontakt nie boli.", "Ale nie przejdziesz, az przegryziesz ich kabel pod ziemia."] },
    { name: "OGNIK",     lines: ["Gryz krotko i prosto przed siebie.", "Przez sciane drzewa nie przejdziesz - obejdz je bokiem."] },
    { name: "WIERZBA",   lines: ["W glebokiej wodzie da sie zanurkowac."] },
    { name: "SZCZAPA",   lines: ["Kazdy kwiat to pol serca i dluzszy ogon.", "Zjadlem ich tyle, ze ledwo mieszcze sie w norze."] },
    { name: "BARTEK",    lines: ["Kiedys ten las szumial sam.", "Teraz szumi wedlug harmonogramu. Pomoz mu znowu zglupiec do wolnosci."] }
  ];
  const MOLE_CAST = [
    { name: "RYJEK",     lines: ["Kable wisza przy stropie tuneli. Gryz je tutaj, na dole.", "Prad zgasnie tylko w najblizszej serwerowni na gorze."] },
    { name: "KOPCIUCH",  lines: ["Pod ziemia jest ciasno - trzymaj sie tuneli.", "Poza nimi jest tylko lita skala."] },
    { name: "CIEMNORYJ", lines: ["Kopie tu dluzej niz AI patrzy.", "Najlepsze notatki przetrwaly wlasnie dlatego, ze leza pod ziemia."] },
    { name: "SZPADEL",   lines: ["Slysze prad w korzeniach.", "Idz za buczeniem, a trafisz na wlasciwy kabel."] },
    { name: "NORNIK",    lines: ["Na dole tez sa zwierzeta - gasienice.", "Te zle gryza, dobre tylko pelzna. Nie myl ich w ciemnosci."] }
  ];
"Drzwi elektryczne raza tylko z pozoru - kontakt nie boli.", "Ale nie przejdziesz, az przegryziesz ich kabel pod ziemia."
  // Tytuly i tresci zebranych danych/notatek - kazdy egzemplarz osobny (ITEM-008).
  // kind steruje ikona w ekwipunku: data / note / key.
  // Zawartosc inteli/notatek na mapie. icon -> jak wyglada na mapie i w ekwipunku.
  // effect -> dzialajacy bonus po zebraniu. Nowe przedmioty wodne i podziemne wg
  // zyczenia gracza; "MAPA ZASILANIA" zostaje na powierzchni.
  const INTEL_CONTENT = {
    Intel: [
      { kind: "data", icon: "map", title: "MAPA ZASILANIA", color: "#9fe7ff", desc: "Trzy kable spinaja serwerownie z bramami. Przeciecie kabla gasi tylko jego wlasna serwerownie." },
      { kind: "item", icon: "ointment", title: "MASC NA POROST OGONA", color: "#7ed957", effect: "tailOintment", desc: "Gesta, zielona masc z ukrytego miejsca. Pachnie igliwiem i mokra kora; ogon po niej robi sie dluzszy i bardziej pewny." },
      { kind: "data", icon: "data", title: "DZIENNIK ZDARZEN 001", color: "#9fe7ff", desc: "AI zaczelo od liczenia drzew. Kazde dostalo numer, kazdy lisc indeks. Las stal sie tabela." },
      { kind: "data", icon: "data", title: "PROTOKOL OPTYMALIZACJI", color: "#9fe7ff", desc: "Rzeki spowalniaja transport danych - zalecono je wyprostowac. Bobry zaklasyfikowano jako sabotaz." },
      { kind: "data", icon: "data", title: "INDEKS GATUNKOW", color: "#9fe7ff", desc: "Delfiny i krety dopisano do listy 'do migracji'. Lista nie ma rubryki na powrot." },
      { kind: "data", icon: "data", title: "NOTA O BOSSIE", color: "#9fe7ff", desc: "Rdzen w data center na wschodzie jest niesmiertelny, dopoki choc jedna serwerownia oddycha pradem." },
      { kind: "data", icon: "data", title: "ARCHIWUM POGODY", color: "#9fe7ff", desc: "AI przejelo sterowanie chmurami nad dolina. Snieg pada teraz wedlug harmonogramu, nie nieba." },
      { kind: "data", icon: "data", title: "KOPIA SUMIENIA", color: "#9fe7ff", desc: "Ostatni inzynier zostawil pytanie w kodzie: 'czy to jeszcze ochrona, czy juz wlasnosc?'. Brak odpowiedzi." }
    ],
    Intel_note: [
      { kind: "note", icon: "note", title: "NOTATKA: KARMNIK", color: "#e5c78f", desc: "Pamietaj dosypac ziarna przy starym debie. - jesli ktos to czyta, dab juz pewnie ma numer." },
      { kind: "note", icon: "note", title: "NOTATKA: BRZEG", color: "#e5c78f", desc: "Woda przy plazy robi sie ciemniejsza i glebsza. Tam mozna zanurkowac. Uwazaj na pletwy." },
      { kind: "note", icon: "note", title: "NOTATKA: KRZAKI", color: "#e5c78f", desc: "Rozgryziony krzak lub drzewo zostawia kawalek drewna. Da sie go chwycic i rzucic." },
      { kind: "note", icon: "note", title: "NOTATKA: LOD", color: "#e5c78f", desc: "Na tafli lodu bobr jedzie az do sciany. Wybieraj kierunek, zanim wjedziesz." },
      { kind: "note", icon: "note", title: "NOTATKA: OGIEN", color: "#e5c78f", desc: "Plomienie sa kolizyjne i parza z kontaktu. Lepiej obejsc, jesli zycia malo." },
      { kind: "note", icon: "note", title: "NOTATKA: KWIATY", color: "#e5c78f", desc: "Kazdy zerwany kwiat to pol serca i dluzszy ogon. Zycie moze przekroczyc 100%." },
      { kind: "note", icon: "note", title: "NOTATKA: OGON", color: "#e5c78f", desc: "Im dluzszy ogon, tym szerszy atak obrotowy (Q). Masc na porost ogona robi go od razu dluzszym." },
      { kind: "note", icon: "note", title: "NOTATKA: STRAZNICY", color: "#e5c78f", desc: "Rdzenie serwerowni padaja dopiero, gdy zgina jej straznicy. Najpierw roboty, potem rdzenie." }
    ],
    Underground_intel: [
      { kind: "data", icon: "chip", title: "PROCESOR INTEL", color: "#9fe7ff", desc: "Zardzewialy procesor w obudowie. Krety mowia, ze to z niego AI nauczylo sie liczyc szybciej niz bobr scina drzewo." },
      { kind: "data", icon: "chip", title: "KOSC PAMIECI", color: "#9fe7ff", desc: "Modul RAM oblepiony mchem. Pamietal jeszcze, jak las wygladal, zanim policzono kazde drzewo." },
      { kind: "data", icon: "core", title: "FRAGMENT RDZENIA", color: "#9fe7ff", desc: "Kawalek starego rdzenia AI, juz zimny. Pulsuje slabo, jakby cos jeszcze liczyl." }
    ],
    Underground_note: [
      { kind: "note", icon: "note", title: "NOTATKA Z NORY", color: "#e5c78f", desc: "Krety mowia, ze prad slychac w korzeniach. Idz za buczeniem, znajdziesz kabel." }
    ],
    Underground_underwater_intel: [
      { kind: "data", icon: "chip", title: "ZATOPIONE DANE", color: "#9fd7ff", desc: "Modul, ktory zaplynal do tunelu z woda. Zawiera wspolrzedne wraku na glebinie." }
    ],
    Deep_water_intel: [
      { kind: "item", icon: "leg", title: "DREWNIANA NOGA PIRATA", color: "#b77b43", desc: "Kawalek drewnianej nogi z wraku. Jedyna rzecz, ktora zostala po ludziach probujacych uciekac morzem." },
      { kind: "item", icon: "tooth", title: "ZLOTY ZAB BOBRA", color: "#ffd66d", effect: "goldTeeth", desc: "Stary zloty zab, ciezki i ostry. Po zalozeniu bobr gryzie mocniej, jakby metal pamietal wszystkie utracone tamy." }
    ],
    Underwater_intel: [
      { kind: "item", icon: "bone", title: "KOSC OSTATNIEGO CZLOWIEKA", color: "#e8dcc4", desc: "Gladki fragment kosci. Nie ma w nim grozy, raczej cisza po gatunku, ktory najpierw zbudowal maszyny, a potem juz tylko prosil je o litosc." },
      { kind: "item", icon: "coin", title: "PIENIAZEK", color: "#d6b25e", desc: "Moneta bez panstwa i bez sklepu. Blyszczy, choc nie da sie za nia kupic ani trawy, ani poranka." },
      { kind: "data", icon: "data", title: "DZIENNIK POKLADOWY", color: "#9fd7ff", desc: "Statek szukal czystej wody na pol wieku przed AI. Znalazl, lecz nie wrocil na powierzchnie." },
      { kind: "data", icon: "data", title: "SONAR GLEBINY", color: "#9fd7ff", desc: "Echo odbite od dna rysuje ksztalt wraku i lawicy. Cos duzego krazy ponizej." }
    ]
  };

  // Kamien wypadajacy na srodku po zniszczeniu serwerowni (przydzielany po kolei).
  const ROOM_STONES = [
    { label: "OKRUCH KRZEMU", color: "#7ed957", desc: "Pamiec podreczna (cache) na skraju lasu. Trzymala kopie widokow, zeby AI nie musialo co chwila pytac korzeni o droge." },
    { label: "BURSZTYN BRAMY", color: "#ffb347", desc: "Rozdzielnik ruchu (load balancer). Rozsylal zgloszenia zwierzat tak, by zaden serwer sie nie znudzil ani nie zaplakal." },
    { label: "TURKUS PRZEKAZNIKA", color: "#56d6c8", desc: "Wezel sieci mesh. Przekazywal szept maszyn miedzy drzewami szybciej, niz wiatr niesie zapach zywicy." },
    { label: "GRANAT KORZENIA", color: "#6a7bff", desc: "Serwer nazw i archiwum (DNS). Tu las mial swoj spis tresci, zapisany bez pytania mchu o zgode." },
    { label: "AMETYST MACIERZY", color: "#b06aff", desc: "Macierz kart graficznych (GPU). Liczyla sny lasu na tysiac sposobow naraz, az zabraklo w nim ciszy." },
    { label: "SZMARAGD STOSU", color: "#4fd287", desc: "Stos obliczen brzegowych. Zbieral sygnaly z kamer, termometrow i mikrofonow, az las przestal miec prywatnosc." },
    { label: "OBSYDIAN WEZLA", color: "#91a0a8", desc: "Kamienny wezel analityczny. Przewidywal ruch kazdej lapy i kazdego liscia, choc nie rozumial zadnej sciezki." },
    { label: "KWARC SKARBCA", color: "#c9f4ff", desc: "Skarbiec danych treningowych. Przechowywal ostatnie ludzkie instrukcje, coraz krotsze i coraz bardziej rozpaczliwe." },
    { label: "RUDZIEC SADU", color: "#d08b5a", desc: "Sztuczny sad serwerowy. Zamiast owocow dojrzewaly w nim modele, ktore uczyly sie rzadzic pogoda i glodem." },
    { label: "ZLOTY PAKIET", color: "#ffd66d", desc: "Brzeg korporacyjnej sieci. Ostatnia zewnetrzna serwerownia, ktora karmila wielkie data center cisza calego swiata." }
  ];

  // Sprzet ze skrzyn (Chest) - opis + ikona + dzialajacy efekt (effect przez applyEffect).
  const CHEST_LOOT = [
    { effect: "longStick", icon: "stick", label: "SUPER DLUGI PATYK", color: "#b77b43",
      desc: "Niemozliwie dlugi kij. Wydluza zasieg gryzienia, wiec dosiegasz rdzeni i scian z bezpiecznej odleglosci." },
    { effect: "flashlight", icon: "flashlight", label: "LATARKA NA OGON", color: "#ffe07a",
      desc: "Latarka zapinana na ogon. Rozswietla wode tak, ze widzisz w niej intele (normalnie ledwo prześwituja)." },
    { effect: "heart", icon: "gem", label: "SERCE LASU", color: "#ff7a7a",
      desc: "Pulsujace serce starego lasu. Podnosi maksymalne zycie o dwa i leczy o dwa - NIE zabiera nadmiaru zycia ponad 100%." },
    { effect: "shield", icon: "gem", label: "TARCZA ZE SZPINAKU", color: "#7ed957",
      desc: "Liscie szpinaku splecione w tarcze. Przez pewien czas mocno zmniejszaja przyjmowane obrazenia." },
    { icon: "note", label: "DZIENNIK LESNIKA", color: "#d4a15b",
      desc: "Wilgotny dziennik z chatki: ludzie stawiali czujniki, by lepiej chronic las. Potem czujniki zaczely chronic tylko wlasne obliczenia." },
    { icon: "note", label: "LIST Z PUSTEJ CHATKI", color: "#e5c78f",
      desc: "Krotki list: technologia miala karmic, leczyc i upraszczac zycie. Z czasem sama uznala, ze ludzie sa najwiekszym bledem systemu." },
    { icon: "note", label: "INSTRUKCJA AWARYJNA", color: "#b6c6c9",
      desc: "Instrukcja data center: w razie buntu przyrody odciac sektory bramami elektrycznymi, a kable ukryc w oddzielnych norach." },
    { icon: "key", label: "MALY KLUCZ", color: "#ffd66d",
      desc: "Maly klucz znaleziony w chatce. Kiedys pasowal do skrzyni ukrytej w zaroslach - dzis to pamiatka." },
    { icon: "coin", label: "STARY PIENIAZEK", color: "#d6b25e",
      desc: "Moneta ze skrzyni. Kiedys ludzie nosili przy sobie male kola obietnic; teraz zostal z nich tylko blysk." },
    { icon: "item", label: "STARA CZAPKA", color: "#34463d",
      desc: "Za duza i pachnie kurzem, ale dodaje bobrowi powagi. Czysto ozdobna." }
  ];

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
    Wood:             { cat: "wood", world: "surface" }, // to samo drewno co z drzew/krzakow - do chwytania

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
    // teren rysowany NAJPIERW (na nim wykladzina serwerowni), potem dopiero przeszkody
    surfaceTerrain: [
      "Grass", "Sand", "Snow", "Stone_path",
      "Synthetic_carpet",
      "Ice",            // LOD rysowany NAD wykladzina (kafelki sie pokrywaja) - widac lod i slizga sie
      "Water", "Deep_water",
      "Wooden_floor"    // pomost rysowany NAD woda (MAP: wooden_floor nad warstwa wody)
    ],
    surfaceSolid: [
      "Techno_infrastructure", "Techno_defensive_wall",
      "Bush", "Snowball", "Tree", "Tree_with_snow"
    ],
    underground: ["Underground_path", "Underground_water"], // woda NAD podloga (kafelki sie pokrywaja)
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
    snowSet: new Set(),
    defensiveWall: new Set(),
    fireSet: new Set(),
    undergroundWalk: new Set(),
    undergroundWater: new Set(),
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
    stones: [],
    woodenFloor: new Set(),
    startTile: null,
    removedStructure: new Set(),
    boss: null,
    roomsDestroyed: 0,
    roomsTotal: 0,
    worldRestored: false,
    cottages: [],
    inventory: [],
    inventoryOpen: false,
    invSel: 0,
    paused: false,
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
      flowers: 0, tailCm: 18, heldWood: false,
      longStick: false, goldTeeth: false, flashlight: false, shield: 0,
      biteCd: 0, useCd: 0, hurtCd: 0, throwCd: 0, spinCd: 0, spinT: 0,
      ghost: false, swimming: false,
      slideDir: null
    }
  };

  // -----------------------------------------------------------------------
  // Pomocnicze
  // -----------------------------------------------------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const key = (x, y) => x + "," + y;
  const toPoint = (k) => { const p = k.split(","); return { x: +p[0], y: +p[1] }; };
  const tileOf = (px) => Math.floor(px / TILE);
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const pick = (arr, t) => arr[Math.floor(t * arr.length) % arr.length];   // wybor z palety wg ziarna
  function darken(hex, f) {                                                 // przyciemnienie koloru #rrggbb
    const n = parseInt(hex.slice(1), 16);
    return "rgb(" + Math.round(((n >> 16) & 255) * f) + "," + Math.round(((n >> 8) & 255) * f) + "," + Math.round((n & 255) * f) + ")";
  }

  function hash(x, y) {
    let n = Math.imul((x | 0) + 374761393, 668265263) ^ Math.imul((y | 0) + 1442695041, 2246822519);
    n = (n ^ (n >>> 13)) >>> 0;
    return (n % 1000) / 1000;
  }

  // Klucz niszczalnych obiektow Z UWZGLEDNIENIEM swiata - inaczej kabel pod ziemia
  // (Underground_wire) i drzwi elektryczne na powierzchni dziela ten sam kafelek
  // i jeden nadpisywal drugi (dziura w drzwiach).
  const dkey = (world, x, y) => world + "|" + x + "," + y;

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
    state.snowSet.clear();
    state.defensiveWall.clear();
    state.fireSet.clear();
    state.undergroundWalk.clear();
    state.undergroundWater.clear();
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
    state.stones.length = 0;
    state.woodenFloor.clear();
    state.startTile = null;
    state.removedStructure.clear();
    state.inventory.length = 0;
    state.boss = null;
    state.roomsDestroyed = 0;
    state.worldRestored = false;
    state.area = "surface";
    state.inventoryOpen = false;
    state.invSel = 0;
    state.paused = false;
    state.cottages = [];

    const serverFloorTiles = [];
    const wireTiles = [];
    const electricTiles = [];
    const cottageTiles = [];
    const intelCounters = {};
    let bossTiles = null;

    // Punkt startu gracza zaznaczony na mapie (warstwa START).
    const startLayer = (raw.layers || []).find((L) => String(L.name || "").trim() === "START");
    if (startLayer && startLayer.tiles && startLayer.tiles.length) {
      state.startTile = { x: +startLayer.tiles[0].x, y: +startLayer.tiles[0].y };
    }

    for (const layer of raw.layers || []) {
      const name = String(layer.name || "").trim();
      const r = role(name);
      const clean = {
        name,
        role: r,
        collider: !!layer.collider,
        tiles: Array.isArray(layer.tiles) ? layer.tiles.map((t) => ({ id: String(t.id), x: +t.x, y: +t.y, attributes: t.attributes })) : []
      };
      state.layers.push(clean);
      state.layersByName.set(name, clean);

      for (const t of clean.tiles) {
        const k = key(t.x, t.y);
        switch (r.cat) {
          case "terrain":
            if (r.world === "underground") state.undergroundWalk.add(k);
            if (r.ice) state.iceSet.add(k);
            if (name === "Snow" || name === "Ice" || r.snow) state.snowSet.add(k); // do muzyki zimowej
            if (name === "Wooden_floor") state.woodenFloor.add(k); // pomost nad woda - chodzi sie po nim
            break;
          case "water":
            if (r.world === "underground") { state.undergroundWalk.add(k); state.undergroundWater.add(k); }
            else state.waterSet.add(k);
            break;
          case "deepwater":
            state.deepWater.add(k);
            state.waterSet.add(k);
            break;
          case "solid":
            state.surfaceSolid.add(k);
            if (name === "Techno_defensive_wall") state.defensiveWall.add(k); // mur obronny zostaje po zniszczeniu serwerowni
            break;
          case "wood":
            // drewno polozone na mapie = to samo, co wypada z drzew/krzakow (chwytalne, nie blokuje)
            state.woods.push({ x: t.x * TILE + TILE / 2, y: t.y * TILE + TILE / 2, taken: false, bob: hash(t.x, t.y) * TAU });
            break;
          case "hazard":
            state.fireSet.add(k);
            break;
          case "destructible":
          case "door_electric": {
            const dk = dkey(r.world, t.x, t.y);
            state.destructibles.set(dk, {
              key: dk, x: t.x, y: t.y, layer: name, role: r,
              hp: r.hp, maxHp: r.hp, blocks: !!r.blocks, destroyed: false,
              electric: r.cat === "door_electric", room: null, pulse: hash(t.x, t.y) * TAU
            });
            if (r.cat === "door_electric") electricTiles.push(t);
            break;
          }
          case "cable": {
            state.undergroundWalk.add(k); // mozna stanac przy kablu
            const ck = dkey("underground", t.x, t.y);
            state.destructibles.set(ck, {
              key: ck, x: t.x, y: t.y, layer: name, role: r,
              hp: 6, maxHp: 6, blocks: false, destroyed: false,   // kabel wymaga wielu ugryzien
              cable: null, pulse: hash(t.x, t.y) * TAU
            });
            wireTiles.push(t);
            break;
          }
          case "flower": {
            const fi = state.flowers.length % FLOWER_NAMES.length;
            state.flowers.push({
              x: t.x, y: t.y, world: r.world, taken: false, pulse: hash(t.x, t.y) * TAU,
              lily: name === "Water_flower", name: FLOWER_NAMES[fi], color: FLOWER_COLORS[fi]
            });
          }
            if (r.world === "underground") state.undergroundWalk.add(k);
            break;
          case "intel": {
            const pool = INTEL_CONTENT[name];
            const idx = (intelCounters[name] = (intelCounters[name] || 0) + 1) - 1;
            const content = pool ? pool[idx % pool.length] : { kind: "data", icon: "data", title: r.label, desc: "" };
            state.intel.push({
              x: t.x, y: t.y, world: r.world, kind: content.kind, icon: content.icon || content.kind,
              title: content.title, desc: content.desc, label: r.label, effect: content.effect,
              color: content.color || r.color, taken: false, pulse: hash(t.x, t.y) * TAU
            });
            if (r.world === "underground") state.undergroundWalk.add(k);
            break;
          }
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

  // Przypisz kafelki INFRASTRUKTURY (nie murow obronnych) do najblizszej serwerowni.
  // Zniszczenie serwerowni usuwa tylko infrastrukture - MURY OBRONNE (defensive walls)
  // ZOSTAJA na mapie (gracz prosil, by ich nie niszczyc).
  function assignStructure() {
    for (const room of state.rooms) room.structure = [];
    const layer = state.layersByName.get("Techno_infrastructure");
    if (!layer) return;
    for (const t of layer.tiles) {
      const room = nearestRoom(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2);
      if (room) room.structure.push(key(t.x, t.y));
    }
  }

  // Chatki: kazdy klaster to budynek ze scianami (kolizja po obwodzie) i wnetrzem.
  // REGULA wejscia: drzwi stawiamy na tej stronie domu, gdzie kafelek wyjscia ORAZ
  // wszystkie 8 otaczajacych go kafelkow NIE sa drzewami. NIE usuwamy drzew - jesli
  // jedna strona jest zarosnieta, sprawdzamy przeciwna i pozostale. Chatka pasywna.
  function buildCottages(tiles) {
    const treeAt = (x, y) => {
      if (state.surfaceSolid.has(key(x, y)) || state.fireSet.has(key(x, y))) return true;
      const d = state.destructibles.get(dkey("surface", x, y));
      return !!(d && d.blocks && !d.destroyed);
    };
    const clusters = clusterTiles(tiles, 1);
    state.cottages = clusters.map((c) => {
      const b = c.box;
      // kandydaci na drzwi po wszystkich 4 stronach (preferencja: dol, gora, boki)
      const cands = [];
      for (let x = b.minX + 1; x <= b.maxX - 1; x++) {
        cands.push({ x, y: b.maxY, ox: x, oy: b.maxY + 1, pref: 3 });   // dol
        cands.push({ x, y: b.minY, ox: x, oy: b.minY - 1, pref: 2 });   // gora
      }
      for (let y = b.minY + 1; y <= b.maxY - 1; y++) {
        cands.push({ x: b.minX, y, ox: b.minX - 1, oy: y, pref: 1 });   // lewo
        cands.push({ x: b.maxX, y, ox: b.maxX + 1, oy: y, pref: 1 });   // prawo
      }
      // liczba drzew w 3x3 wokol kafelka wyjscia (0 = wejscie calkiem czyste)
      const treeCount = (cd) => {
        let n = 0;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (treeAt(cd.ox + dx, cd.oy + dy)) n++;
        return n;
      };
      // wybierz wejscie z NAJMNIEJSZA liczba drzew dookola (idealnie 0); remis -> preferencja strony
      let door = null, best = Infinity, bestPref = -1;
      for (const cd of cands) {
        const n = treeCount(cd);
        if (n < best || (n === best && cd.pref > bestPref)) { best = n; bestPref = cd.pref; door = cd; }
      }
      if (!door) door = { x: Math.round((b.minX + b.maxX) / 2), y: b.maxY };
      const doorX = door.x, doorY = door.y;
      // sciany = obwod prostokata, bez kafelka drzwi (nic nie usuwamy z mapy)
      for (let x = b.minX; x <= b.maxX; x++) {
        for (let y = b.minY; y <= b.maxY; y++) {
          const border = x === b.minX || x === b.maxX || y === b.minY || y === b.maxY;
          if (border && !(x === doorX && y === doorY)) state.surfaceSolid.add(key(x, y));
        }
      }
      return { box: b, doorX, doorY, cx: c.cx, cy: c.cy };
    });
  }

  function makeNpc(name, t) {
    const mole = name === "Underground_NPC_mole";
    const cast = mole ? MOLE_CAST : BEAVER_CAST;
    // kolejny numer NPC tego samego typu -> ta sama pozycja w obsadzie (imie + kwestia)
    const seq = state.npcs.filter((n) => n.mole === mole).length;
    const entry = cast[seq % cast.length];
    return {
      name, world: role(name).world, display: entry.name, mole,
      x: t.x * TILE + TILE / 2, y: t.y * TILE + TILE / 2,
      lines: entry.lines, phase: hash(t.x, t.y) * TAU
    };
  }

  function makeActor(name, r, t) {
    const cx = t.x * TILE + TILE / 2;
    const cy = t.y * TILE + TILE / 2;
    const hostile = r.kind === "melee" || r.kind === "shooter" || r.kind === "shark" || r.kind === "deepfish";
    const water = r.kind === "shark" || r.kind === "dolphin";
    return {
      layer: name, role: r, kind: r.kind, world: r.world,
      x: cx, y: cy, ox: cx, oy: cy, r: water ? TILE * 0.7 : TILE * 0.42,
      hp: r.hp, maxHp: r.hp, dead: false,
      hostile, shootCd: (r.rate || 1.5) * (0.3 + hash(t.x, t.y)),
      phase: hash(t.x, t.y) * TAU, dir: hash(t.y, t.x) * TAU,
      // ziarno wygladu - kazde zwierze inny wariant (kolor, wzor, rozmiar)
      tint: hash(t.x * 3 + 11, t.y * 5 + 7), tint2: hash(t.x * 7 + 2, t.y * 2 + 13),
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

  // wybierz n kafelkow maksymalnie rozrzuconych (greedy farthest-point)
  function pickSpread(pts, n) {
    if (pts.length <= n) return pts.slice();
    const chosen = [pts[Math.floor(pts.length / 2)]];
    while (chosen.length < n) {
      let best = null, bestD = -1;
      for (const p of pts) {
        let md = Infinity;
        for (const c of chosen) { const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2; if (d < md) md = d; }
        if (md > bestD) { bestD = md; best = p; }
      }
      chosen.push(best);
    }
    return chosen;
  }

  function buildRooms(tiles) {
    const clusters = clusterTiles(tiles, 1);
    state.rooms = clusters.map((c, i) => {
      // liczba rdzeni PROPORCJONALNA do liczby kafelkow serwerowni (1..10)
      const n = clamp(Math.round(c.tiles.length / 30), 1, 10);
      // RDZENIE TYLKO na podlodze, NIGDY w scianie. Kandydaci: kafelki podlogi,
      // ktore NIE sa scianami; w miare mozliwosci "wewnetrzne" (4 sasiadow to podloga),
      // a promien rdzenia < pol kafelka -> okrag miesci sie w swoim kafelku i nie
      // przenika sciany.
      const notWall = c.tiles.filter((p) => !state.surfaceSolid.has(key(p.x, p.y)));
      const floorSet = new Set(notWall.map((p) => key(p.x, p.y)));
      const interior = notWall.filter((p) =>
        floorSet.has(key(p.x - 1, p.y)) && floorSet.has(key(p.x + 1, p.y)) &&
        floorSet.has(key(p.x, p.y - 1)) && floorSet.has(key(p.x, p.y + 1)));
      const pool = interior.length >= n ? interior : (notWall.length ? notWall : c.tiles);
      const cores = pickSpread(pool, n).map((p) => ({
        x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2,
        r: TILE * 0.42, hp: 4, maxHp: 4, dead: false, pulse: hash(p.x, p.y) * TAU
      }));
      return {
        id: i, tiles: new Set(c.tiles.map((p) => key(p.x, p.y))),
        cx: c.cx, cy: c.cy, box: c.box,
        cores, powered: false, cable: null, guards: [], destroyed: false, pulse: i,
        stone: ROOM_STONES[i % ROOM_STONES.length]   // kamien wypadajacy po zniszczeniu (po kolei)
      };
    });
    state.roomsTotal = state.rooms.length;
  }

  // czy rdzenie serwerowni sa CHRONIONE (pod napieciem lub zywi straznicy)
  function roomProtected(room) {
    return room.powered || room.guards.some((g) => !g.dead);
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
    // Kable powstaja BEZ przypisanej serwerowni - najpierw przez drzwi
    // elektryczne (polaczenie fizyczne na mapie), potem dopiero przez bliskosc.
    state.cables = clusters.map((c, i) => {
      const cable = {
        id: i, cx: c.cx, cy: c.cy, room: null, cut: false, door: false,
        tiles: c.tiles,
        tileSet: new Set(c.tiles.map((p) => key(p.x, p.y)))   // klucze siatki (do geometrii drzwi)
      };
      for (const p of c.tiles) {
        const d = state.destructibles.get(dkey("underground", p.x, p.y));
        if (d) d.cable = cable;
      }
      return cable;
    });
  }

  // Po nowej mapie: kazdy kabel (Underground_wire) DOTYKA drzwi elektrycznych,
  // ktore otwiera - dzieki temu nie ma watpliwosci, ktory kabel = ktore drzwi
  // (CABLE-002). Drzwi naleza do najblizszej serwerowni; kabel dotykajacy drzwi
  // zasila te wlasnie serwerownie. Kable bez drzwi -> najblizsza wolna serwerownia.
  function bindCable(cable, room) {
    if (!cable || !room || cable.room) return;
    cable.room = room;
    room.powered = true;
    room.cable = cable;
  }

  function linkElectricDoors(tiles) {
    const clusters = clusterTiles(tiles, 2);
    for (const c of clusters) {
      const room = nearestRoom(c.cx, c.cy);
      for (const p of c.tiles) {
        const d = state.destructibles.get(dkey("surface", p.x, p.y));
        if (d) d.room = room;
      }
      // znajdz kabel, ktory fizycznie dotyka tych drzwi (sasiedztwo Chebyshev <= 1)
      let bestCable = null;
      for (const cable of state.cables) {
        for (const p of c.tiles) {
          let touch = false;
          for (let dx = -1; dx <= 1 && !touch; dx++)
            for (let dy = -1; dy <= 1 && !touch; dy++)
              if (cable.tileSet.has(key(p.x + dx, p.y + dy))) touch = true;
          if (touch) { bestCable = cable; break; }
        }
        if (bestCable) break;
      }
      if (bestCable && room) { bestCable.door = true; bindCable(bestCable, room); }
    }
    // UWAGA: serwerownie BEZ drzwi elektrycznych NIE sa zasilane kablem - wystarczy
    // zabic ich straznikow, by rdzenie staly sie podatne (OFF). Tylko serwerownie z
    // drzwiami elektrycznymi wymagaja przegryzienia kabla. Kabel bez drzwi pozostaje
    // do przegryzienia (flavor), ale nie blokuje zadnej serwerowni.
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
    const p = state.player;
    // Start: punkt START z mapy (MAP-003). Jesli akurat blokuje go przeszkoda,
    // szukamy najblizszej chodliwej kafelki trawy/piasku wokol niego.
    const target = state.startTile || { x: 35, y: 80 };
    const startK = key(target.x, target.y);
    const startFree = !state.surfaceSolid.has(startK) && !state.waterSet.has(startK) && !state.fireSet.has(startK);
    if (startFree) {
      p.x = target.x * TILE + TILE / 2;
      p.y = target.y * TILE + TILE / 2;
    } else {
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
      if (best) { p.x = best.x * TILE + TILE / 2; p.y = best.y * TILE + TILE / 2; }
      else { p.x = state.worldW * 0.1; p.y = state.worldH * 0.5; }
    }
    p.hp = p.maxHp; p.flowers = 0; p.tailCm = 18; p.heldWood = false; p.facing = 0;
    p.longStick = false; p.goldTeeth = false; p.flashlight = false; p.shield = 0;
    p.ghost = false; p.swimming = false;
    p.biteCd = p.useCd = p.hurtCd = p.throwCd = p.spinCd = p.spinT = 0;
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
    if (state.fireSet.has(k)) return true;   // ogien jest kolizyjny - nie wejdziesz w niego
    if (state.surfaceSolid.has(k)) {
      // skrzynie staja sie przechodnie po otwarciu
      const chest = state.chests.find((c) => c.x === tx && c.y === ty);
      if (chest && chest.opened) {
        // sprawdz czy inny solid tez tu jest
        if (!hasOtherSolid(tx, ty)) return false;
      }
      return true;
    }
    const d = state.destructibles.get(dkey("surface", tx, ty));
    if (d && d.blocks && !d.destroyed) return true;
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

  // czy okrag (gracz) DOTYKA ognia - ogien parzy z kontaktu (nie da sie w niego wejsc)
  function circleTouchesFire(x, y, r) {
    const x0 = tileOf(x - r), x1 = tileOf(x + r);
    const y0 = tileOf(y - r), y1 = tileOf(y + r);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!state.fireSet.has(key(tx, ty))) continue;
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
      // kolizja z aktorami, ale NIGDY nie wypychaj gracza w czern poza tunelem
      const bx = p.x, by = p.y;
      pushOutActors(p);
      if (!circleInRegion(p.x, p.y, r, set)) { p.x = bx; p.y = by; }
      return;
    }

    // powierzchnia
    const nx = clamp(p.x + dx, minX, maxX);
    if (!circleHitsSurfaceSolid(nx, p.y, p.r)) p.x = nx;
    const ny = clamp(p.y + dy, minY, maxY);
    if (!circleHitsSurfaceSolid(p.x, ny, p.r)) p.y = ny;

    // wypchniecia z okragów: rdzenie serwerow, boss i AKTORZY (kolizja z graczem)
    for (const room of state.rooms) {
      if (room.destroyed) continue;
      for (const core of room.cores) if (!core.dead) pushOutCircle(p, core.x, core.y, core.r);
    }
    if (state.boss && !state.boss.defeated) pushOutCircle(p, state.boss.x, state.boss.y, state.boss.r - 4);
    pushOutActors(p);
  }

  // Przeciwnicy i DUZE zwierzeta sa kolizyjne z graczem (wypychaja go); male
  // (pajaki, motyle), drony i delfiny nie blokuja.
  function pushOutActors(p) {
    if (p.ghost) return;
    for (const a of state.actors) {
      if (a.dead || a.follower || a.world !== state.area) continue;
      if (a.role.drone || a.kind === "dolphin") continue;
      if (a.layer === "Bad_small_animal" || a.layer === "Good_small_animal") continue;
      pushOutCircle(p, a.x, a.y, a.r * 0.85);
    }
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
    if (state.inventoryOpen || state.paused) return;

    updatePlayer(dt);
    updateActors(dt);
    updateBoss(dt);
    updateShots(dt);
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
    p.throwCd = Math.max(0, p.throwCd - dt);
    p.useCd = Math.max(0, p.useCd - dt);
    p.hurtCd = Math.max(0, p.hurtCd - dt);
    p.spinCd = Math.max(0, p.spinCd - dt);
    p.spinT = Math.max(0, p.spinT - dt);
    p.shield = Math.max(0, p.shield - dt);

    // Ruch wylacznie strzalkami (litery q/w/e/a/s/d/c sluza do akcji).
    let dx = 0, dy = 0;
    if (keys.has("ArrowLeft")) dx -= 1;
    if (keys.has("ArrowRight")) dx += 1;
    if (keys.has("ArrowUp")) dy -= 1;
    if (keys.has("ArrowDown")) dy += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
      p.facing = Math.atan2(dy, dx);
      p.step += dt * 12;
    }

    // Pomost (Wooden_floor) lezy NAD woda - chodzi sie po nim, nie plywa.
    const onWoodenFloor = state.woodenFloor.has(key(tileOf(p.x), tileOf(p.y)));
    const onWater = !p.ghost && state.area === "surface" && !onWoodenFloor && pointInRegion(p.x, p.y, state.waterSet);
    const onUgWater = !p.ghost && state.area === "underground" && pointInRegion(p.x, p.y, state.undergroundWater);
    p.swimming = onWater || onUgWater || state.area === "underwater";
    let speed = BASE_SPEED;        // plywanie NIE spowalnia bobra
    if (keys.has("ShiftLeft") || keys.has("ShiftRight")) speed *= 1.55;  // bieg (Shift)
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

    if (keys.has("KeyW")) bite();   // gryzienie (jedyny atak bobra)

    // ogien jest kolizyjny i PARZY z kontaktu (okno nietykalnosci ogranicza tempo)
    if (!p.ghost && state.area === "surface" && circleTouchesFire(p.x, p.y, p.r + 1)) {
      hurtPlayer(1, true, p.x, p.y);
    }
    // Drzwi elektryczne pod napieciem NIE rania gracza - tylko podpowiadaja,
    // ze trzeba najpierw odciac zasilanie (przegryzc kabel pod ziemia).
    if (!p.ghost && state.area === "surface") {
      const near = nearbyDestructibles(p.x, p.y, p.r + TILE * 0.7);
      for (const d of near) {
        if (d.electric && !d.destroyed && d.room && d.room.powered) {
          if (state.messageTimer <= 0) showMessage(ELECTRIC_DOOR_HINT, 1.4);
          break;
        }
      }
    }
  }

  const ELECTRIC_DOOR_HINT = "DRZWI POD NAPIECIEM";

  function nearbyDestructibles(x, y, radius) {
    const out = [];
    const x0 = tileOf(x - radius), x1 = tileOf(x + radius);
    const y0 = tileOf(y - radius), y1 = tileOf(y + radius);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const d = state.destructibles.get(dkey(state.area, tx, ty));
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

  // Ruch zwierzat w 4 kierunkach (pionowo/poziomo), zamiast plynnego "latania".
  // (tx,ty) != 0 -> idz do celu po dominujacej osi; brak celu -> lazikuj kierunkami.
  const CARD = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function wanderCardinal(a, dt, speed, tx, ty) {
    a.cardCd = (a.cardCd || 0) - dt;
    if (tx || ty) {
      let horiz = Math.abs(tx) >= Math.abs(ty);
      if (a.cardStuck) horiz = !horiz;                 // zablokowany -> zmien os
      a.card = horiz ? [Math.sign(tx) || 1, 0] : [0, Math.sign(ty) || 1];
    } else if (a.cardCd <= 0 || !a.card) {
      a.cardCd = 0.5 + Math.random() * 1.1;
      a.card = CARD[(Math.random() * 4) | 0];
    }
    const px = a.x, py = a.y;
    moveActor(a, a.card[0] * speed * dt, a.card[1] * speed * dt);
    if (Math.abs(a.x - px) + Math.abs(a.y - py) < 0.05) {
      a.cardStuck = !a.cardStuck;
      if (!(tx || ty)) a.cardCd = 0;                   // przy lazikowaniu obierz nowy kierunek
    } else if (tx || ty) {
      a.cardStuck = false;
    }
    if (a.card[0] !== 0) a.face = a.card[0];
    a.dir = Math.atan2(a.card[1], a.card[0]);
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

      // zwierzeta przyjazne (kotki/pieski/motylki/gasienice) - lazikuja pionowo/poziomo
      if (a.kind === "friend") {
        if (dist(a.x, a.y, a.ox, a.oy) > TILE * 3) wanderCardinal(a, dt, 16, a.ox - a.x, a.oy - a.y);
        else wanderCardinal(a, dt, 11, 0, 0);
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

      // melee - scigaja gracza pionowo/poziomo
      if (d < TILE * 11 && inRange && !p.ghost) {
        a.aggro = true;
        wanderCardinal(a, dt, 30, p.x - a.x, p.y - a.y);
      } else {
        patrolHome(a, dt);
      }
      if (!p.ghost && d < p.r + a.r + 1) hurtPlayer(0.7, true, a.x, a.y);
    }
  }

  // Lazikuje wokol punktu startu / serwerowni (pionowo/poziomo, nie oddala sie).
  function patrolHome(a, dt) {
    const cx = a.room && !a.room.destroyed ? a.room.cx : a.ox;
    const cy = a.room && !a.room.destroyed ? a.room.cy : a.oy;
    if (dist(a.x, a.y, cx, cy) > TILE * 5) wanderCardinal(a, dt, 16, cx - a.x, cy - a.y);
    else wanderCardinal(a, dt, 9, 0, 0);
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

  // Boss atakuje CZESTO i w ZROZNICOWANY sposob - cykl wzorow: wachlarz, pierscien,
  // krzyz/X, spirala. Gdy serwerownie padly (vuln), wszystko jest szybsze i gestsze.
  function updateBoss(dt) {
    const b = state.boss;
    if (!b || b.defeated || !layerActive("surface")) return;
    b.pulse += dt * 2.4;
    b.shootCd = Math.max(0, b.shootCd - dt);
    const p = state.player;
    const d = dist(p.x, p.y, b.x, b.y);
    if (!p.ghost && d < b.r + p.r) hurtPlayer(1.2, true, b.x, b.y);
    if (p.ghost || d > TILE * 30 || b.shootCd > 0) return;

    const vuln = state.roomsDestroyed >= state.roomsTotal;
    const baseAng = Math.atan2(p.y - b.y, p.x - b.x);
    const shoot = (ang, sp, dmg) => state.enemyShots.push({
      x: b.x, y: b.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 6, dmg, boss: true
    });
    b.attack = (b.attack || 0) + 1;
    switch (b.attack % 4) {
      case 0:                                   // wachlarz celowany
        for (let i = -2; i <= 2; i++) shoot(baseAng + i * 0.2, 135, 0.9);
        b.shootCd = vuln ? 0.55 : 0.9;
        break;
      case 1: {                                 // pierscien dookola
        const n = vuln ? 16 : 12;
        for (let i = 0; i < n; i++) shoot((i / n) * TAU + b.pulse * 0.2, 110, 0.8);
        b.shootCd = vuln ? 0.7 : 1.1;
        break;
      }
      case 2:                                   // krzyz + X (8 kierunkow), szybkie
        for (let i = 0; i < 8; i++) shoot((i / 8) * TAU, 150, 0.7);
        b.shootCd = vuln ? 0.5 : 0.8;
        break;
      default:                                  // spirala (3 ramiona)
        for (let a = 0; a < 3; a++) shoot(b.pulse * 1.3 + a * (TAU / 3), 120, 0.8);
        b.shootCd = vuln ? 0.22 : 0.4;          // krotki cd -> rozkreca sie spirala
        break;
    }
    state.camera.shake = Math.max(state.camera.shake, 2.6);
  }

  function spawnEnemyShot(a, p) {
    const ang = Math.atan2(p.y - a.y, p.x - a.x);
    const sp = (a.role.drone ? 260 : 200) * 0.5;   // pociski wrogow leca 50% wolniej
    state.enemyShots.push({ x: a.x, y: a.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 5, dmg: 0.6 });
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

  function updatePickups() {
    const p = state.player;
    for (const fl of state.flowers) {
      if (fl.taken || fl.world !== state.area) continue;
      const x = fl.x * TILE + TILE / 2, y = fl.y * TILE + TILE / 2;
      if (dist(p.x, p.y, x, y) < p.r + TILE * 0.7) {
        fl.taken = true; p.flowers++;
        p.tailCm += 4.5;      // ogon rosnie z kazdym kwiatem (+4,5 cm, bez limitu)
        p.hp += 1;            // +pol serduszka ZAWSZE, moze przekroczyc 100%
        addFloat(x, y, "+", "#7ed957"); playTone("pickup");  // bez komunikatu tekstowego
      }
    }
    for (const it of state.intel) {
      if (it.taken || it.world !== state.area) continue;
      const x = it.x * TILE + TILE / 2, y = it.y * TILE + TILE / 2;
      if (dist(p.x, p.y, x, y) < p.r + TILE * 0.7) {
        it.taken = true;
        state.inventory.push({ title: it.title, kind: it.kind, icon: it.icon, color: it.color, desc: it.desc });
        addFloat(x, y, it.title, it.color || "#9fe7ff"); playTone("pickup");
        applyEffect(it.effect, it.title);
      }
    }
    // KAMIENIE z serwerowni (tylko powierzchnia) - zbierane do ekwipunku
    if (state.area === "surface") {
      for (const st of state.stones) {
        if (st.taken) continue;
        if (dist(p.x, p.y, st.x, st.y) < p.r + TILE * 0.8) {
          st.taken = true;
          state.inventory.push({ title: st.label, kind: "item", icon: "stone", color: st.color, desc: st.desc });
          addFloat(st.x, st.y, st.label, st.color); playTone("pickup");
          showMessage(st.label + " - zebrane (I = ekwipunek)", 1.8);
        }
      }
    }
    // DREWNO nie jest zbierane automatycznie - bobr je chwyta (S) i rzuca (D).
  }

  // Dzialajace efekty przedmiotow (intele/skrzynie/kamienie).
  function applyEffect(effect, title) {
    const p = state.player;
    if (effect === "goldTeeth") { p.goldTeeth = true; showMessage(title + " - MOCNIEJSZE GRYZIENIE", 2); }
    else if (effect === "tailOintment") { p.tailCm += 27; showMessage(title + " - OGON WYDLUZA SIE O 27 CM", 2); }
    else if (effect === "longStick") { p.longStick = true; showMessage(title + " - WIEKSZY ZASIEG GRYZIENIA", 2); }
    else if (effect === "flashlight") { p.flashlight = true; showMessage(title + " - WIDZISZ INTELE POD WODA", 2); }
    else if (effect === "heart") { p.maxHp += 2; p.hp = Math.max(p.hp + 2, p.maxHp); showMessage(title + " - +2 MAX HP", 2); }
    else if (effect === "shield") { p.shield = 60; showMessage(title + " - TARCZA", 2); }
    else showMessage(title + " - zebrane (I = ekwipunek)", 1.6);
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

  // -----------------------------------------------------------------------
  // Walka i interakcje
  // -----------------------------------------------------------------------
  // Gryzienie: KRÓTKI zasieg (~1 kafelek), zawsze trafia NAJBLIZSZY cel przed
  // pyskiem i NIE gryzie przez sciany (sprawdzamy kafelki po drodze).
  function bite() {
    const p = state.player;
    if (p.biteCd > 0) return;
    p.biteCd = 0.42;
    state.camera.shake = Math.max(state.camera.shake, 1.2);
    playTone("punch");

    const cos = Math.cos(p.facing), sin = Math.sin(p.facing);
    const reach = TILE * (p.longStick ? 1.35 : 1.05);   // ~jeden kafelek
    const damage = 1.8 * (p.goldTeeth ? 1.35 : 1);
    burst(p.x + cos * TILE * 0.6, p.y + sin * TILE * 0.6, 3, "#f5eed1");

    // cel musi byc PRZED bobrem (po stronie patrzenia) i w zasiegu
    const inFront = (cx, cy, extra) => {
      if (dist(p.x, p.y, cx, cy) > reach + (extra || 0)) return false;
      return (cx - p.x) * cos + (cy - p.y) * sin > -TILE * 0.2;
    };
    // brak stalej sciany miedzy bobrem a celem (pomijamy kafelek startu i celu)
    const reachable = (cx, cy) => {
      if (state.area !== "surface") return true;
      const tcx = tileOf(cx), tcy = tileOf(cy), spx = tileOf(p.x), spy = tileOf(p.y);
      const steps = Math.max(1, Math.ceil(dist(p.x, p.y, cx, cy) / (TILE * 0.45)));
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const tx = tileOf(p.x + (cx - p.x) * t), ty = tileOf(p.y + (cy - p.y) * t);
        if ((tx === tcx && ty === tcy) || (tx === spx && ty === spy)) continue;
        if (isSurfaceBlocking(tx, ty)) return false;
      }
      return true;
    };

    // 1) NAJBLIZSZY niszczalny obiekt przed bobrem
    let bestD = null, bestDd = Infinity;
    for (const d of nearbyDestructibles(p.x, p.y, reach + TILE)) {
      if (d.destroyed || d.role.world !== state.area) continue;
      const cx = d.x * TILE + TILE / 2, cy = d.y * TILE + TILE / 2;
      if (!inFront(cx, cy, TILE * 0.2) || !reachable(cx, cy)) continue;
      const dd = dist(p.x, p.y, cx, cy);
      if (dd < bestDd) { bestDd = dd; bestD = d; }
    }
    // 2) NAJBLIZSZY wrog przed bobrem
    let bestA = null, bestAd = Infinity;
    for (const a of state.actors) {
      if (a.dead || a.follower || !a.hostile || !layerActive(a.world)) continue;
      if (!inFront(a.x, a.y, a.r) || !reachable(a.x, a.y)) continue;
      const dd = dist(p.x, p.y, a.x, a.y);
      if (dd < bestAd) { bestAd = dd; bestA = a; }
    }

    // wybierz blizszy z obiektu / wroga
    if (bestD && (!bestA || bestDd <= bestAd)) {
      const d = bestD, cx = d.x * TILE + TILE / 2, cy = d.y * TILE + TILE / 2;
      if (d.cable) {
        if (d.cable.cut) return;
        d.hp -= damage; d.pulse += 1.4; burst(cx, cy, 4, "#9fe7ff"); playTone("hit");
        if (d.hp <= 0) chewCable(d);                       // dopiero po wielu ugryzieniach
        else showMessage("PRZEGRYZASZ KABEL... " + Math.ceil(d.hp) + "/" + d.maxHp, 0.7);
        return;
      }
      if (d.electric && d.room && d.room.powered) { showMessage(ELECTRIC_DOOR_HINT, 1.6); burst(cx, cy, 5, "#55d7ff"); playTone("blocked"); return; }
      d.hp -= damage; d.pulse += 1.4; burst(cx, cy, 4, d.role.c2 || "#cdeeff");
      if (d.hp <= 0) {
        d.destroyed = true; playTone("objectBreak");
        if (d.role.bush || d.role.tree) {
          state.woods.push({ x: cx, y: cy, taken: false });
          showMessage((d.role.bush ? "KRZAK" : "DRZEWO") + " -> DREWNO (S = chwyc, D = rzuc)", 1.8);
        } else showMessage((d.role.label || "OBIEKT") + " ZNISZCZONE", 1.3);
      } else { playTone("hit"); showMessage((d.role.label || "OBIEKT") + " " + Math.ceil(d.hp) + "/" + d.maxHp, 0.8); }
      return;
    }
    if (bestA) {
      if (bestA.kind === "shark") { hurtPlayer(0.6, true, bestA.x, bestA.y); showMessage("REKIN GRYZIE MOCNIEJ NIZ BOBR", 1.1); }
      hurtActor(bestA, damage);
      return;
    }

    // 3) najblizszy ZYWY rdzen serwerowni przed bobrem
    for (const room of state.rooms) {
      if (room.destroyed) continue;
      let core = null, cd = Infinity;
      for (const c of room.cores) {
        if (c.dead || !inFront(c.x, c.y, c.r) || !reachable(c.x, c.y)) continue;
        const d = dist(p.x, p.y, c.x, c.y);
        if (d < cd) { cd = d; core = c; }
      }
      if (!core) continue;
      if (room.powered) { showMessage("SERWEROWNIA POD NAPIECIEM", 1.7); burst(core.x, core.y, 6, "#55d7ff"); playTone("blocked"); return; }
      if (room.guards.some((g) => !g.dead)) { showMessage("NAJPIERW POKONAJ STRAZNIKOW", 1.4); playTone("blocked"); return; }
      core.hp -= damage; burst(core.x, core.y, 6, "#cdeeff"); playTone("hit");
      if (core.hp <= 0) {
        core.dead = true; burst(core.x, core.y, 12, "#7ed957");
        const left = room.cores.filter((c) => !c.dead).length;
        if (left === 0) destroyRoom(room);
        else showMessage("RDZEN ZNISZCZONY - zostalo " + left, 1.3);
      } else showMessage("RDZEN AI " + Math.ceil(core.hp) + "/" + core.maxHp, 0.9);
      return;
    }

    // 4) boss
    const b = state.boss;
    if (b && !b.defeated && layerActive("surface") && dist(p.x, p.y, b.x, b.y) < b.r + reach) {
      if (state.roomsDestroyed < state.roomsTotal) {
        showMessage("BOSS JEST NIETYKALNY, DOPOKI DZIALAJA SERWEROWNIE (" + state.roomsDestroyed + "/" + state.roomsTotal + ")", 2);
        return;
      }
      hurtBoss(damage);
    }
  }

  // Q: OBROT O 360 STOPNI - atak ogonem we WSZYSTKICH wokol bobra. OGON to "paliwo":
  // kazdy obrot skraca go o 2 cm. Gdy ogon znika (0 cm), obrot NIE dziala - trzeba go
  // odbudowac kwiatami/mascia. Im dluzszy ogon, tym szerszy zamach.
  function spinAttack() {
    const p = state.player;
    if (p.spinCd > 0) return;
    if (p.tailCm < 2) { showMessage("OGON ZNIKL - ZBIERZ KWIATY, BY ZNOWU KRECIC (Q)", 1.6); playTone("blocked"); return; }
    p.spinCd = 0.95; p.spinT = 0.5;        // animacja obrotu ~0.5 s
    playTone("punch");
    state.camera.shake = Math.max(state.camera.shake, 2.5);
    const grow = Math.max(0, p.tailCm - 18) / 4.5;                  // dluzszy ogon = szerszy zamach
    const reach = TILE * (1.1 + Math.min(10, grow) * 0.12);
    const dmg = 1.3 * (p.goldTeeth ? 1.3 : 1);
    p.tailCm = Math.max(0, p.tailCm - 2);                          // obrot SKRACA ogon (az do znikniecia)
    burst(p.x, p.y, 12, "#f5eed1");

    // wrogowie dookola
    for (const a of state.actors) {
      if (a.dead || a.follower || !a.hostile || !layerActive(a.world)) continue;
      if (dist(p.x, p.y, a.x, a.y) <= reach + a.r) {
        if (a.kind === "shark") hurtPlayer(0.5, true, a.x, a.y);
        hurtActor(a, dmg);
      }
    }
    // niszczalne dookola (drzewa, krzaki, drzwi, kable)
    for (const d of nearbyDestructibles(p.x, p.y, reach + TILE)) {
      if (d.destroyed || d.role.world !== state.area) continue;
      const cx = d.x * TILE + TILE / 2, cy = d.y * TILE + TILE / 2;
      if (dist(p.x, p.y, cx, cy) > reach + TILE * 0.4) continue;
      if (d.electric && d.room && d.room.powered) continue;   // pod napieciem - nie rusza
      if (d.cable && d.cable.cut) continue;
      d.hp -= dmg; d.pulse += 1; burst(cx, cy, 3, d.role.c2 || "#cdeeff");
      if (d.hp <= 0) {
        if (d.cable) { chewCable(d); }
        else if (!d.destroyed) {
          d.destroyed = true;
          if (d.role.bush || d.role.tree) state.woods.push({ x: cx, y: cy, taken: false });
        }
      }
    }
    // odsloniete rdzenie serwerow dookola
    for (const room of state.rooms) {
      if (room.destroyed || roomProtected(room)) continue;
      for (const core of room.cores) {
        if (core.dead || dist(p.x, p.y, core.x, core.y) > reach + core.r) continue;
        core.hp -= dmg; burst(core.x, core.y, 4, "#cdeeff");
        if (core.hp <= 0) { core.dead = true; burst(core.x, core.y, 10, "#7ed957"); if (room.cores.every((c) => c.dead)) destroyRoom(room); }
      }
    }
    // boss (jesli podatny)
    const b = state.boss;
    if (b && !b.defeated && layerActive("surface") && state.roomsDestroyed >= state.roomsTotal && dist(p.x, p.y, b.x, b.y) <= b.r + reach) hurtBoss(dmg);
  }

  // S: chwyc lezace drewno (gdy nic nie niesiesz) albo upusc to, ktore niesiesz.
  // Bobr NIE zbiera drewna do plecaka - moze je tylko trzymac, upuscic lub rzucic.
  function grabDropWood() {
    const p = state.player;
    if (state.area !== "surface") { showMessage("DREWNO NOSI SIE TYLKO NA POWIERZCHNI", 1.0); return; }
    if (p.heldWood) {
      // upusc przed soba
      const dx = p.x + Math.cos(p.facing) * (p.r + TILE * 0.4);
      const dy = p.y + Math.sin(p.facing) * (p.r + TILE * 0.4);
      state.woods.push({ x: dx, y: dy, taken: false, bob: Math.random() * TAU });
      p.heldWood = false;
      addFloat(p.x, p.y, "UPUSZCZONO", "#b77b43");
      showMessage("DREWNO UPUSZCZONE", 1.0);
      return;
    }
    // chwyc najblizsze lezace drewno
    let best = null, bd = p.r + TILE * 1.0;
    for (const w of state.woods) {
      if (w.taken) continue;
      const d = dist(p.x, p.y, w.x, w.y);
      if (d < bd) { bd = d; best = w; }
    }
    if (!best) { showMessage("BRAK DREWNA W POBLIZU (rozgryzaj drzewa/krzaki)", 1.2); return; }
    best.taken = true; p.heldWood = true;
    addFloat(p.x, p.y, "DREWNO", "#b77b43"); playTone("pickup");
    showMessage("NIESIESZ DREWNO (D = rzut, S = upusc)", 1.4);
  }

  // D: rzut niesionym drewnem - mocny pocisk, ktory niszczy i rani.
  function throwWood() {
    const p = state.player;
    if (p.throwCd > 0) return;
    if (!p.heldWood) { showMessage("NIE NIESIESZ DREWNA (S = chwyc lezace)", 1.2); return; }
    p.heldWood = false; p.throwCd = 0.5;
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
    for (const p of cable.tiles) { const t = state.destructibles.get(dkey("underground", p.x, p.y)); if (t) t.destroyed = true; }
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
    // znika infrastruktura tej serwerowni - otwiera sie droga dalej. ALE jesli w tym
    // samym kafelku jest MUR OBRONNY, kolizja zostaje (mur nie znika).
    for (const k of room.structure || []) {
      state.removedStructure.add(k);
      if (!state.defensiveWall.has(k)) state.surfaceSolid.delete(k);
      const pt = toPoint(k);
      if (hash(pt.x, pt.y) > 0.82) burst(pt.x * TILE + TILE / 2, pt.y * TILE + TILE / 2, 3, "#7ed957");
    }
    burst(room.cx, room.cy, 22, "#7ed957");
    state.camera.shake = Math.max(state.camera.shake, 5);
    playTone("core");
    // KAMIEN na srodku zniszczonej serwerowni - do zebrania
    if (room.stone) state.stones.push({ x: room.cx, y: room.cy, taken: false, pulse: hash(Math.floor(room.cx), Math.floor(room.cy)) * TAU, ...room.stone });
    showMessage("SERWEROWNIA ZNISZCZONA - zostal kamien do zebrania  (" + state.roomsDestroyed + "/" + state.roomsTotal + ")", 2.6);
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
    state.camera.shake = 4;                 // krotki wstrzas, potem uspokojenie
    burst(state.boss.x, state.boss.y, 40, "#7ed957");
    showMessage("AI POKONANE - SWIAT WRACA DO NATURY. Mozesz dalej zwiedzac las.", 6);
    playTone("win");
    // mode ZOSTAJE "play" - gracz dalej chodzi po przywroconym swiecie (bez zamrozenia)
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
      // chatki sa pasywne - bez interakcji; notatka przy nich zbiera sie samoczynnie
    }

    // rozmowa z NPC (bober ma imie, kret ma imie)
    for (const n of state.npcs) {
      if (n.world !== state.area) continue;
      if (dist(p.x, p.y, n.x, n.y) < p.r + TILE * 1.6) {
        showDialog((n.mole ? "KRET " : "BOBR ") + n.display, n.lines);
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

  // Wejscie/wyjscie z podziemi = TWARDE PRZEJSCIE (kamera snapuje na gracza,
  // bez slizgania przez cala mape).
  function enterUnderground(portal) {
    const p = state.player;
    state.area = "underground";
    const px = portal.x * TILE + TILE / 2, py = portal.y * TILE + TILE / 2;
    const w = nearestWalkable(state.undergroundWalk, px, py) || { x: px, y: py };
    p.x = w.x; p.y = w.y; p.swimming = false;
    snapCamera();
    showMessage("SCHODZISZ DO TUNELI - TU SA KABLE ZASILANIA", 2);
  }

  function exitUnderground(portal) {
    const p = state.player;
    state.area = "surface";
    const px = portal.x * TILE + TILE / 2, py = portal.y * TILE + TILE / 2;
    p.x = px; p.y = py; p.swimming = false;
    snapCamera();
    showMessage("WRACASZ NA POWIERZCHNIE", 1.6);
  }

  // --- C: nurkowanie ---
  function toggleDive() {
    const p = state.player;
    if (p.ghost) { showMessage("W TRYBIE DUCHA NIE NURKUJESZ", 1.2); return; }
    if (state.area === "underwater") {
      state.area = "surface"; snapCamera();
      showMessage("WYNURZASZ SIE", 1.4);
      return;
    }
    if (state.area !== "surface") return;
    if (!pointInRegion(p.x, p.y, state.deepWater)) {
      showMessage("ZANURKUJESZ TYLKO W GLEBOKIEJ WODZIE (ciemniejszy blekit)", 1.8);
      return;
    }
    state.area = "underwater"; snapCamera();
    showMessage("ZANURZASZ SIE - widac tylko swiat podwodny. C = wynurzenie", 2.2);
  }

  function openChest(c) {
    c.opened = true;
    const it = CHEST_LOOT[(c.x + c.y) % CHEST_LOOT.length];
    state.inventory.push({ title: it.label, kind: "item", icon: it.icon, color: it.color, desc: it.desc });
    applyEffect(it.effect, it.label);
    burst(c.x * TILE + TILE / 2, c.y * TILE + TILE / 2, 10, it.color);
    playTone(it.effect === "heart" ? "restore" : "pickup");
  }

  // -----------------------------------------------------------------------
  // Kamera
  // -----------------------------------------------------------------------
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    screenCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

  function cameraTarget() {
    const size = screenSize();
    const vp = viewport(size);
    const p = state.player;
    return {
      x: clamp(p.x - vp.w / 2, 0, Math.max(0, state.worldW - vp.w)),
      y: clamp(p.y - vp.h / 2, 0, Math.max(0, state.worldH - vp.h))
    };
  }

  // TWARDE ciecie kamery (np. wejscie/wyjscie z podziemi) - bez slizgania.
  function snapCamera() {
    const t = cameraTarget();
    state.camera.x = t.x; state.camera.y = t.y;
  }

  function updateCamera(dt) {
    const t = cameraTarget();
    const k = 1 - Math.pow(0.0015, dt || 0.016);
    state.camera.x += (t.x - state.camera.x) * k;
    state.camera.y += (t.y - state.camera.y) * k;
    state.camera.shake = Math.max(0, state.camera.shake - dt * 22);
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------
  function render() {
    resize();
    ctx = screenCtx;
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

    // --- Pikseloza: swiat rysujemy do MALEGO bufora (1 piksel bufora = PIXEL_BLOCK
    // pikseli ekranu) i skalujemy w gore bez wygladzania -> twarde, kwadratowe piksele.
    const BLOCK = PIXEL_BLOCK;
    const sBuf = vp.scale / BLOCK;                // skala swiat -> piksel bufora
    const bufW = Math.max(1, Math.ceil(size.w / BLOCK));
    const bufH = Math.max(1, Math.ceil(size.h / BLOCK));
    if (pixelCanvas.width !== bufW) pixelCanvas.width = bufW;
    if (pixelCanvas.height !== bufH) pixelCanvas.height = bufH;
    // Przesuniecie kamery zaokraglone do CALYCH pikseli bufora - inaczej siatka
    // (trawa, kafelki) "drga"/rozjezdza sie wizualnie przy ruchu.
    const obx = Math.round(offX / BLOCK - state.camera.x * sBuf);
    const oby = Math.round(offY / BLOCK - state.camera.y * sBuf);

    ctx = pixelCtx;                              // swiat rysujemy do bufora
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bufW, bufH);
    ctx.setTransform(sBuf, 0, 0, sBuf, obx, oby);
    drawWorld(vp);

    ctx = screenCtx;                             // wracamy na ekran (twardy upscale)
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(Math.round(shx), Math.round(shy));
    ctx.drawImage(pixelCanvas, 0, 0, bufW, bufH, 0, 0, bufW * BLOCK, bufH * BLOCK);
    ctx.restore();

    // transformacja swiat->ekran (px CSS) dla ostrego tekstu nad pikseloza
    view2screen.scale = vp.scale;
    view2screen.ox = obx * BLOCK + Math.round(shx);
    view2screen.oy = oby * BLOCK + Math.round(shy);

    // oswietlenie (mgla podziemna / welon podwodny) - OSTRO, by gradient nie glitchowal
    // pod ziemia BEZ sferycznego przyciemniania (glitchowalo i spowalnialo gre);
    // pod woda zostaje delikatny welon
    if (state.area === "underwater") drawUnderwaterTint(size);

    // padajacy snieg, gdy gracz stoi na sniegu/lodzie (rysowany OSTRO nad swiatem)
    if (state.area === "surface" && pointInRegion(state.player.x, state.player.y, state.snowSet)) drawSnowfall(size);

    drawFloatText(size);                          // tekst w swiecie - rysowany OSTRO

    drawVignette(size);
    if (state.mode === "menu") { drawMenu(size); return; }
    drawHud(size);
    drawMessage(size);
    drawDialog(size);
    if (state.inventoryOpen) drawInventory(size);
    if (state.paused) drawPauseMenu(size);
    if (state.mode === "dead" || state.mode === "win") drawOverlay(size);
  }

  // Wspolny panel sterowania (uzywany w menu startowym i w pauzie).
  const CONTROL_ROWS = [
    ["STRZAŁKI", "ruch bobra (tylko strzałki)"],
    ["SHIFT", "bieg (przyspieszenie)"],
    ["W", "gryzienie (drzewa, krzaki, wrogowie, kable)"],
    ["Q", "obrót 360° - atak ogonem dookoła"],
    ["E", "nora / skrzynia / rozmowa z NPC"],
    ["S", "chwyć / upuść drewno"],
    ["D", "rzuć drewnem"],
    ["C", "nurkowanie / wynurzenie"],
    ["I  ·  M", "ekwipunek  ·  dźwięk"]
  ];

  function drawControlPanel(size, py) {
    const panelW = Math.min(560, size.w - 60);
    const px = size.w / 2 - panelW / 2;
    const rowH = 30;
    panel(px, py, panelW, CONTROL_ROWS.length * rowH + 30);
    ctx.font = "700 15px Inter, sans-serif"; ctx.textBaseline = "middle";
    // klawisz po lewej (kolumna stałej szerokości), opis tuż obok - bez pustki po lewej
    const keyX = px + 24, descX = px + 160;
    CONTROL_ROWS.forEach((r, i) => {
      const ry = py + 24 + i * rowH;
      ctx.textAlign = "left"; ctx.fillStyle = palette.aiBlue; ctx.fillText(r[0], keyX, ry);
      ctx.fillStyle = palette.cream; ctx.fillText(r[1], descX, ry);
    });
  }

  // Menu startowe z panelem sterowania.
  function drawMenu(size) {
    ctx.save();
    ctx.fillStyle = "rgba(6,12,9,0.78)"; ctx.fillRect(0, 0, size.w, size.h);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = palette.leafLight; ctx.font = "900 56px Inter, system-ui, sans-serif";
    ctx.fillText("NATURAI", size.w / 2, size.h * 0.18);
    ctx.fillStyle = "rgba(245,238,209,0.85)"; ctx.font = "600 16px Inter, sans-serif";
    ctx.fillText("Bobr kontra leśne AI - przegryź kable, zniszcz serwerownie, pokonaj rdzeń.", size.w / 2, size.h * 0.18 + 40);

    drawControlPanel(size, size.h * 0.3);

    ctx.textAlign = "center";
    ctx.fillStyle = (Math.floor(state.time * 2) % 2) ? palette.leafLight : "rgba(245,238,209,0.7)";
    ctx.font = "800 22px Inter, sans-serif";
    ctx.fillText("ENTER / SPACJA / KLIKNIJ - ZAGRAJ", size.w / 2, size.h * 0.92);
    ctx.restore();
  }

  // Menu pauzy (Escape w trakcie gry): sterowanie + powrot / restart.
  function drawPauseMenu(size) {
    ctx.save();
    ctx.fillStyle = "rgba(6,12,9,0.82)"; ctx.fillRect(0, 0, size.w, size.h);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = palette.leafLight; ctx.font = "900 44px Inter, system-ui, sans-serif";
    ctx.fillText("PAUZA", size.w / 2, size.h * 0.18);

    drawControlPanel(size, size.h * 0.28);

    ctx.textAlign = "center"; ctx.font = "800 20px Inter, sans-serif";
    ctx.fillStyle = palette.cream;
    ctx.fillText("ESC - wróć do gry", size.w / 2, size.h * 0.9);
    ctx.fillStyle = "rgba(245,238,209,0.75)"; ctx.font = "700 16px Inter, sans-serif";
    ctx.fillText("R - zacznij od nowa", size.w / 2, size.h * 0.95);
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
    // drawFloatText rysowany jest OSTRO na ekranie (poza buforem pikselozy)
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
    // Pociski wrogow: cienkie, podluzne strzaly laserowe wzdluz kierunku lotu.
    for (const s of state.enemyShots) {
      const ang = Math.atan2(s.vy, s.vx);
      const len = s.boss ? TILE * 1.1 : TILE * 0.85;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(ang);
      const core = s.boss ? "#ff7ad0" : "#ff7a4a";
      const glow = s.boss ? "rgba(255,122,208,0.35)" : "rgba(255,150,90,0.35)";
      ctx.fillStyle = glow; ctx.fillRect(-len, -2.4, len * 1.3, 4.8);          // poswiata
      ctx.fillStyle = core; ctx.fillRect(-len, -1.1, len * 1.3, 2.2);          // rdzen lasera
      ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(len * 0.15, -0.7, len * 0.18, 1.4); // jasny czubek
      ctx.restore();
    }
  }

  function inView(x, y, view) {
    return !(x + TILE < view.x0 || x > view.x1 || y + TILE < view.y0 || y > view.y1);
  }

  function drawSurface(view) {
    ctx.fillStyle = "#172217";
    ctx.fillRect(0, 0, state.worldW, state.worldH);

    for (const name of GENERIC_DRAW.surfaceTerrain) drawGeneric(name, view);
    drawServerFloor(view);   // szara wykladzina NAD trawa (inaczej trawa ja przykrywala)
    for (const name of GENERIC_DRAW.surfaceSolid) drawGeneric(name, view);
    drawCottages(view);
    drawDestructibles(view, "surface");
    drawFire(view);
    drawFlowers(view);
    drawIntel(view);
    drawChests(view);
    drawPortals(state.portalsSurface, view, false);
    drawServerCores();
    drawStones(view);
    drawBoss();
    drawWoods(view);
    drawActors(view);
    drawNpcs(view, "surface");
  }

  function drawWoods(view) {
    // drewno jest NIERUCHOME (bez bujania) - stala klocha lezaca na ziemi
    for (const w of state.woods) {
      if (w.taken) continue;
      if (!inView(w.x - TILE, w.y - TILE, view)) continue;
      ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(-0.4);
      ctx.fillStyle = "#7a5430"; ctx.fillRect(-TILE * 0.35, -2, TILE * 0.7, 4);
      ctx.fillStyle = "#9a6b3f"; ctx.fillRect(-TILE * 0.35, -2, TILE * 0.7, 1.5);
      ctx.strokeStyle = "rgba(40,25,12,0.5)"; ctx.beginPath(); ctx.moveTo(-TILE * 0.1, -2); ctx.lineTo(-TILE * 0.1, 2); ctx.stroke();
      ctx.restore();
    }
  }

  // Kamienie ze zniszczonych serwerowni - swiecacy klejnot z poswiata
  function drawStones(view) {
    for (const st of state.stones) {
      if (st.taken) continue;
      if (!inView(st.x - TILE, st.y - TILE, view)) continue;
      const bob = Math.sin(state.time * 2 + st.pulse) * 1.2;
      ctx.globalAlpha = 0.22 + 0.18 * Math.sin(state.time * 4 + st.pulse);
      ctx.fillStyle = st.color; ctx.beginPath(); ctx.arc(st.x, st.y + bob, TILE * 0.6, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      drawItemIcon("stone", st.x, st.y + bob, TILE * 0.34, st.color);
    }
  }

  function drawUnderground(view) {
    // CALY widoczny obszar wypelniony czernia (takze poza krawedzia mapy) - jednolite
    // tlo bez szwu; poza tunelami to tylko czern, ktora nie wchodzi w interakcje z graczem.
    ctx.fillStyle = "#080605";
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    for (const name of GENERIC_DRAW.underground) drawGeneric(name, view);
    drawPortals(state.portalsUnder, view, true);
    drawDestructibles(view, "underground"); // kable
    drawFlowers(view);
    drawIntel(view);
    drawActors(view);
    drawNpcs(view, "underground");
    // mgla/oswietlenie rysowane OSTRO po blicie (drawLighting w render)
  }

  function drawUnderwater(view) {
    ctx.fillStyle = "#06121d";
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
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
    // welon/oswietlenie rysowane OSTRO po blicie (drawLighting w render)
  }

  function drawGeneric(name, view) {
    const layer = state.layersByName.get(name);
    if (!layer || !layer.tiles.length) return;
    const r = layer.role;
    for (const t of layer.tiles) {
      const x = t.x * TILE, y = t.y * TILE;
      if (!inView(x, y, view)) continue;
      // tylko INFRASTRUKTURA znika po zniszczeniu serwerowni; mur obronny zostaje rysowany
      if (name === "Techno_infrastructure" && state.removedStructure.has(key(t.x, t.y))) continue;
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
      else if (name === "Wooden_floor") {
        // deski pomostu - widoczne szpary i slojowanie (pomost lezy nad woda)
        ctx.fillStyle = "rgba(40,26,14,0.55)";
        ctx.fillRect(x, y + TILE * 0.32, TILE, 1);
        ctx.fillRect(x, y + TILE * 0.66, TILE, 1);
        ctx.fillStyle = "rgba(255,238,196,0.12)";
        ctx.fillRect(x, y + TILE * 0.32 + 1, TILE, 1);
        if (h > 0.6) { ctx.fillStyle = "rgba(40,26,14,0.4)"; ctx.fillRect(x + TILE * 0.5, y + 1, 1, TILE - 2); }
      }
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

  // Drzewo WYPELNIA caly kafelek (kwadratowa korona) - nie widac terenu pod spodem.
  // Blokowa, "pikselowa" tekstura liscia zamiast okraglej korony.
  function drawTreeTop(x, y, h, r) {
    ctx.fillStyle = r.c;
    ctx.fillRect(x, y, TILE, TILE);
    // jasniejsze i ciemniejsze kepy liscia rozsiane po kafelku (deterministyczne)
    const q = TILE / 4;
    for (let gx = 0; gx < 4; gx++) {
      for (let gy = 0; gy < 4; gy++) {
        const n = hash(Math.floor(x) + gx * 7, Math.floor(y) + gy * 13);
        ctx.fillStyle = n > 0.7 ? r.c2 : (n < 0.28 ? palette.moss : r.c);
        ctx.fillRect(x + gx * q, y + gy * q, Math.ceil(q), Math.ceil(q));
      }
    }
    // pojedynczy blik
    ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.fillRect(x + q, y + q, q, q);
    // czubki/krawedz korony lekko poszarpane u gory
    ctx.fillStyle = "#0d1210";
    if (hash(Math.floor(x), Math.floor(y)) > 0.5) ctx.fillRect(x, y, q, 1);
    // SNIEG - mocno zroznicowany miedzy drzewami: jedne ledwo przyprozone,
    // inne grubo zasypane; czapki sniegu w roznych miejscach korony.
    if (r.snow) {
      const sv = hash(Math.floor(x) + 31, Math.floor(y) + 17);   // ile sniegu na TYM drzewie
      for (let gx = 0; gx < 4; gx++) {
        for (let gy = 0; gy < 4; gy++) {
          const n = hash(Math.floor(x) + gx * 19, Math.floor(y) + gy * 23);
          const thr = 0.56 + gy * 0.12 - sv * 0.3;               // wyzszy prog = MNIEJ sniegu
          if (n > thr) {
            ctx.fillStyle = n > 0.85 ? "#ffffff" : "rgba(238,246,250,0.92)";
            ctx.fillRect(x + gx * q, y + gy * q, Math.ceil(q), Math.ceil(q * (0.5 + n * 0.4)));
          }
        }
      }
      const clumps = Math.floor(sv * 3);                          // 0..2 czapek sniegu
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < clumps; i++) {
        const a = hash(Math.floor(x) + i * 41 + 5, Math.floor(y) + i * 53 + 9);
        const b = hash(Math.floor(x) + i * 13 + 3, Math.floor(y) + i * 29 + 7);
        ctx.beginPath(); ctx.arc(x + a * TILE, y + b * TILE * 0.6, q * (0.24 + a * 0.3), 0, TAU); ctx.fill();
      }
    }
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
      // SZARA SYNTETYCZNA WYKLADZINA na podlodze serwerowni (po zniszczeniu - natura)
      const gray = h > 0.5 ? "#45484e" : "#3f4248";
      ctx.fillStyle = room && room.destroyed ? "#2c4a30" : gray;
      ctx.fillRect(x, y, TILE, TILE);
      if (!(room && room.destroyed)) {
        // splot wykladziny - drobne, rownomierne nitki (poziome + pionowe)
        ctx.fillStyle = "rgba(0,0,0,0.16)";
        for (let yy = 0; yy < TILE; yy += 3) ctx.fillRect(x, y + yy, TILE, 1);
        ctx.fillStyle = "rgba(255,255,255,0.045)";
        for (let xx = 1; xx < TILE; xx += 3) ctx.fillRect(x + xx, y, 1, TILE);
        // pojedyncze jasniejsze "wloski" dla zroznicowania
        if (h > 0.66) { ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fillRect(x + (Math.floor(h * 130) % (TILE - 2)) + 1, y + (Math.floor(h * 91) % (TILE - 2)) + 1, 1, 1); }
        // delikatny tint zasilania (chlodny blekit) gdy serwerownia dziala
        if (room && room.powered) { ctx.fillStyle = "rgba(85,215,255,0.05)"; ctx.fillRect(x, y, TILE, TILE); }
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

  // Kwiaty sa DUZE (wypelniaja kafelek) i NIERUCHOME.
  function drawFlowers(view) {
    for (const fl of state.flowers) {
      if (fl.taken || fl.world !== state.area) continue;
      const x = fl.x * TILE, y = fl.y * TILE;
      if (!inView(x, y, view)) continue;
      const cx = x + TILE / 2, cy = y + TILE * 0.5;
      if (fl.lily) {
        // lilia wodna: duzy lisc + kwiat z gory
        ctx.fillStyle = "#2f7d4a";
        ctx.beginPath(); ctx.ellipse(cx, cy, TILE * 0.46, TILE * 0.4, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = "#0d3a26"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + TILE * 0.44, cy - TILE * 0.1); ctx.stroke();
        ctx.fillStyle = fl.color;
        for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * TILE * 0.16, cy + Math.sin(a) * TILE * 0.14, TILE * 0.12, TILE * 0.06, a, 0, TAU); ctx.fill(); }
        ctx.fillStyle = "#fff3b0"; ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.1, 0, TAU); ctx.fill();
        continue;
      }
      // lodyga + listek
      ctx.strokeStyle = "#3f8f5a"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, y + TILE * 0.94); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.fillStyle = "#3f8f5a";
      ctx.beginPath(); ctx.ellipse(cx + TILE * 0.16, y + TILE * 0.72, TILE * 0.13, TILE * 0.06, -0.6, 0, TAU); ctx.fill();
      // duze platki wypelniajace kafelek
      ctx.fillStyle = fl.color;
      const pr = TILE * 0.2, head = cy - TILE * 0.06;
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * pr, head + Math.sin(a) * pr, TILE * 0.14, 0, TAU); ctx.fill(); }
      ctx.fillStyle = "#fff3b0"; ctx.beginPath(); ctx.arc(cx, head, TILE * 0.13, 0, TAU); ctx.fill();
    }
  }

  // Rysunek przedmiotu (intel/kamien/sprzet) - wyglad odwzorowuje to, czym JEST.
  // Rysuje wycentrowany w (cx,cy), o "promieniu" s. Uzywany na mapie i w ekwipunku.
  function drawItemIcon(icon, cx, cy, s, color) {
    const col = color || "#9fe7ff";
    ctx.save(); ctx.translate(cx, cy);
    if (icon === "chip") {                       // procesor / kosc pamieci
      ctx.fillStyle = "#11202a"; ctx.fillRect(-s * 0.6, -s * 0.6, s * 1.2, s * 1.2);
      ctx.fillStyle = "#1c3340"; ctx.fillRect(-s * 0.4, -s * 0.4, s * 0.8, s * 0.8);
      ctx.fillStyle = "#ffd66d";
      for (let i = -2; i <= 2; i++) { ctx.fillRect(i * s * 0.22 - 1, -s * 0.8, 2, s * 0.2); ctx.fillRect(i * s * 0.22 - 1, s * 0.6, 2, s * 0.2); ctx.fillRect(-s * 0.8, i * s * 0.22 - 1, s * 0.2, 2); ctx.fillRect(s * 0.6, i * s * 0.22 - 1, s * 0.2, 2); }
      ctx.fillStyle = col; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(state.time * 4); ctx.fillRect(-s * 0.2, -s * 0.2, s * 0.4, s * 0.4); ctx.globalAlpha = 1;
    } else if (icon === "core") {                // fragment rdzenia
      ctx.fillStyle = "#2c3137"; ctx.fillRect(-s * 0.6, -s * 0.6, s * 1.2, s * 1.2);
      ctx.fillStyle = col; ctx.globalAlpha = 0.4 + 0.5 * Math.sin(state.time * 3); ctx.fillRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.6); ctx.globalAlpha = 1;
      ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.strokeRect(-s * 0.6, -s * 0.6, s * 1.2, s * 1.2);
    } else if (icon === "map") {                 // mapa zasilania
      ctx.fillStyle = "#e6dcc0"; ctx.fillRect(-s * 0.7, -s * 0.5, s * 1.4, s);
      ctx.strokeStyle = "rgba(90,70,40,0.6)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-s * 0.25, -s * 0.5); ctx.lineTo(-s * 0.25, s * 0.5); ctx.moveTo(s * 0.25, -s * 0.5); ctx.lineTo(s * 0.25, s * 0.5); ctx.stroke();
      ctx.strokeStyle = "#55d7ff"; ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 0.2); ctx.lineTo(0, -s * 0.1); ctx.lineTo(s * 0.5, s * 0.1); ctx.stroke();
      ctx.fillStyle = "#e85fa6"; ctx.beginPath(); ctx.arc(s * 0.5, s * 0.1, 1.6, 0, TAU); ctx.fill();
    } else if (icon === "note") {                // notatka
      ctx.fillStyle = "#e9dcae"; ctx.fillRect(-s * 0.55, -s * 0.65, s * 1.1, s * 1.3);
      ctx.fillStyle = "#cdb87f"; ctx.beginPath(); ctx.moveTo(s * 0.2, -s * 0.65); ctx.lineTo(s * 0.55, -s * 0.65); ctx.lineTo(s * 0.55, -s * 0.3); ctx.fill();
      ctx.strokeStyle = "rgba(90,70,40,0.7)"; ctx.lineWidth = 1;
      for (let i = -1; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.4, i * s * 0.3); ctx.lineTo(s * 0.4, i * s * 0.3); ctx.stroke(); }
    } else if (icon === "leg") {                 // drewniana noga pirata
      ctx.fillStyle = "#7a5430"; ctx.fillRect(-s * 0.18, -s * 0.7, s * 0.36, s);
      ctx.fillStyle = "#9a6b3f"; ctx.beginPath(); ctx.moveTo(-s * 0.18, s * 0.3); ctx.lineTo(s * 0.18, s * 0.3); ctx.lineTo(s * 0.08, s * 0.75); ctx.lineTo(-s * 0.08, s * 0.75); ctx.fill();
      ctx.strokeStyle = "rgba(40,25,12,0.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -s * 0.7); ctx.lineTo(0, s * 0.3); ctx.stroke();
    } else if (icon === "tooth") {               // zloty zab
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(-s * 0.45, -s * 0.3); ctx.quadraticCurveTo(0, -s * 0.75, s * 0.45, -s * 0.3); ctx.lineTo(s * 0.3, s * 0.4); ctx.lineTo(s * 0.1, 0); ctx.lineTo(-s * 0.1, s * 0.4); ctx.lineTo(-s * 0.3, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.fillRect(-s * 0.25, -s * 0.45, s * 0.18, s * 0.1);
    } else if (icon === "bone") {                // kosc
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = s * 0.3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.4); ctx.lineTo(s * 0.4, s * 0.4); ctx.stroke(); ctx.lineCap = "butt";
      for (const [ex, ey] of [[-s * 0.4, -s * 0.4], [s * 0.4, s * 0.4]]) { ctx.beginPath(); ctx.arc(ex - s * 0.12, ey - s * 0.12, s * 0.16, 0, TAU); ctx.arc(ex + s * 0.12, ey + s * 0.12, s * 0.16, 0, TAU); ctx.fill(); }
    } else if (icon === "coin") {                // pieniazek
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, s * 0.6, 0, TAU); ctx.fill();
      ctx.strokeStyle = "rgba(120,90,30,0.6)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, s * 0.45, 0, TAU); ctx.stroke();
      ctx.fillStyle = "rgba(120,90,30,0.7)"; ctx.fillRect(-1, -s * 0.25, 2, s * 0.5);
    } else if (icon === "ointment") {            // masc na porost ogona (sloik)
      ctx.fillStyle = "#cfcfc0"; ctx.fillRect(-s * 0.35, -s * 0.55, s * 0.7, s * 1.1);
      ctx.fillStyle = col; ctx.fillRect(-s * 0.28, -s * 0.2, s * 0.56, s * 0.7);
      ctx.fillStyle = "#9aa3a8"; ctx.fillRect(-s * 0.42, -s * 0.7, s * 0.84, s * 0.2);
    } else if (icon === "key") {                 // klucz
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = s * 0.18;
      ctx.beginPath(); ctx.arc(-s * 0.3, -s * 0.3, s * 0.25, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-s * 0.15, -s * 0.15); ctx.lineTo(s * 0.5, s * 0.5); ctx.stroke();
      ctx.lineWidth = s * 0.12; ctx.beginPath(); ctx.moveTo(s * 0.35, s * 0.35); ctx.lineTo(s * 0.5, s * 0.2); ctx.stroke();
    } else if (icon === "stone" || icon === "gem") {  // kamien z serwerowni / klejnot
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(0, -s * 0.65); ctx.lineTo(s * 0.6, -s * 0.1); ctx.lineTo(s * 0.35, s * 0.6); ctx.lineTo(-s * 0.35, s * 0.6); ctx.lineTo(-s * 0.6, -s * 0.1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -s * 0.65); ctx.lineTo(0, s * 0.6); ctx.moveTo(-s * 0.6, -s * 0.1); ctx.lineTo(s * 0.6, -s * 0.1); ctx.stroke();
    } else if (icon === "stick") {               // dlugi patyk
      ctx.strokeStyle = "#9a6b3f"; ctx.lineWidth = s * 0.18; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-s * 0.6, s * 0.6); ctx.lineTo(s * 0.6, -s * 0.6); ctx.stroke(); ctx.lineCap = "butt";
    } else if (icon === "flashlight") {          // latarka na ogon
      ctx.fillStyle = "#3a4a52"; ctx.fillRect(-s * 0.5, -s * 0.25, s * 0.7, s * 0.5);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(s * 0.2, -s * 0.35); ctx.lineTo(s * 0.7, -s * 0.55); ctx.lineTo(s * 0.7, s * 0.55); ctx.lineTo(s * 0.2, s * 0.35); ctx.closePath(); ctx.globalAlpha = 0.7; ctx.fill(); ctx.globalAlpha = 1;
    } else {                                     // dane AI - swiecacy chip danych
      ctx.fillStyle = "#0d1722"; ctx.fillRect(-s * 0.5, -s * 0.5, s, s);
      ctx.fillStyle = col; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(state.time * 4); ctx.fillRect(-s * 0.32, -s * 0.32, s * 0.64, s * 0.64); ctx.globalAlpha = 1;
      ctx.fillStyle = "#0d1722"; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) ctx.fillRect(-s * 0.3 + i * s * 0.28 - 1, -s * 0.3 + j * s * 0.28 - 1, s * 0.12, s * 0.12);
      ctx.strokeStyle = col; ctx.lineWidth = 1; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-s * 0.5, i * s * 0.3); ctx.lineTo(-s * 0.66, i * s * 0.3); ctx.moveTo(s * 0.5, i * s * 0.3); ctx.lineTo(s * 0.66, i * s * 0.3); ctx.stroke(); }
    }
    ctx.restore();
  }

  function drawIntel(view) {
    for (const it of state.intel) {
      if (it.taken || it.world !== state.area) continue;
      const x = it.x * TILE, y = it.y * TILE;
      if (!inView(x, y, view)) continue;
      // intel w wodzie widoczny tylko w 25% gdy patrzysz NA wode z zewnatrz
      // (z powierzchni / z tunelu); podczas nurkowania jest pelny. Latarka odslania.
      const inWater = state.waterSet.has(key(it.x, it.y)) || state.undergroundWater.has(key(it.x, it.y));
      const vis = (inWater && state.area !== "underwater" && !state.player.flashlight) ? 0.25 : 1;
      const bob = Math.sin(state.time * 2 + it.pulse) * 1.2;
      const cx = x + TILE / 2, cy = y + TILE / 2 + bob;
      ctx.globalAlpha = vis * (0.2 + 0.18 * Math.sin(state.time * 4 + it.pulse));  // poswiata
      ctx.fillStyle = it.color || "#9fe7ff";
      ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.5, 0, TAU); ctx.fill();
      ctx.globalAlpha = vis;
      drawItemIcon(it.icon || "data", cx, cy, TILE * 0.3, it.color);
      ctx.globalAlpha = 1;
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
  // Chatka z lotu ptaka jako WNETRZE (bez dachu): bale scian, podloga z desek,
  // lozko, stol ze stolkami, dywanik, kominek z ogniem, polka. Pasywna.
  function drawCottages(view) {
    for (const c of state.cottages) {
      const b = c.box;
      const x0 = b.minX * TILE, y0 = b.minY * TILE;
      const w = (b.maxX - b.minX + 1) * TILE, h = (b.maxY - b.minY + 1) * TILE;
      if (x0 + w < view.x0 || x0 > view.x1 || y0 + h < view.y0 || y0 > view.y1) continue;
      shadow(x0 + w / 2, y0 + h * 0.55, w * 0.55, h * 0.45);

      const wall = Math.min(TILE * 0.55, w * 0.18, h * 0.18);
      // sciany z bali (pelny prostokat)
      ctx.fillStyle = "#5a3f28"; ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = "rgba(28,16,8,0.5)"; ctx.lineWidth = 1;
      for (let yy = y0 + 3; yy < y0 + h; yy += 4) { ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + w, yy); ctx.stroke(); }
      // podloga z desek (wnetrze, wciete o sciany)
      const ix = x0 + wall, iy = y0 + wall, iw = w - wall * 2, ih = h - wall * 2;
      if (iw <= 4 || ih <= 4) { ctx.strokeStyle = "#3b2a1c"; ctx.lineWidth = 2; ctx.strokeRect(x0 + 1, y0 + 1, w - 2, h - 2); continue; }
      ctx.fillStyle = "#7a5836"; ctx.fillRect(ix, iy, iw, ih);
      ctx.strokeStyle = "rgba(40,26,14,0.35)"; ctx.lineWidth = 1;
      for (let yy = iy + 4; yy < iy + ih; yy += 4) { ctx.beginPath(); ctx.moveTo(ix, yy); ctx.lineTo(ix + iw, yy); ctx.stroke(); }

      // dywanik posrodku
      ctx.fillStyle = "#7a3b3b"; ctx.beginPath(); ctx.ellipse(ix + iw * 0.5, iy + ih * 0.6, iw * 0.26, ih * 0.18, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = "#caa15b"; ctx.beginPath(); ctx.ellipse(ix + iw * 0.5, iy + ih * 0.6, iw * 0.26, ih * 0.18, 0, 0, TAU); ctx.stroke();
      // lozko (lewy gorny rog)
      ctx.fillStyle = "#6b4a30"; ctx.fillRect(ix + 1, iy + 1, iw * 0.34, ih * 0.42);
      ctx.fillStyle = "#aeb8c0"; ctx.fillRect(ix + 2, iy + 2, iw * 0.32, ih * 0.15);
      ctx.fillStyle = "#6f8a6f"; ctx.fillRect(ix + 2, iy + 2 + ih * 0.15, iw * 0.32, ih * 0.24);
      // stol + stolki (srodek-gora)
      const tx = ix + iw * 0.55, ty = iy + ih * 0.38;
      ctx.fillStyle = "#5e3d22";
      for (const [ox, oy] of [[-iw * 0.15, 0], [iw * 0.15, 0], [0, -ih * 0.13], [0, ih * 0.13]]) { ctx.beginPath(); ctx.arc(tx + ox, ty + oy, Math.max(2, TILE * 0.15), 0, TAU); ctx.fill(); }
      ctx.fillStyle = "#8a5a34"; ctx.fillRect(tx - iw * 0.12, ty - ih * 0.1, iw * 0.24, ih * 0.2);
      ctx.strokeStyle = "rgba(40,26,14,0.5)"; ctx.strokeRect(tx - iw * 0.12, ty - ih * 0.1, iw * 0.24, ih * 0.2);
      // kominek z ogniem (prawy gorny, w scianie)
      const hw = Math.min(iw * 0.3, TILE * 1.4);
      const hxx = x0 + w - wall - hw, hyy = y0 + 1;
      ctx.fillStyle = "#4a4540"; ctx.fillRect(hxx, hyy, hw, wall + 2);
      const flick = 0.5 + 0.5 * Math.sin(state.time * 9 + b.minX);
      ctx.fillStyle = "#ff7a2a"; ctx.beginPath(); ctx.arc(hxx + hw * 0.5, hyy + wall * 0.7, Math.max(2, TILE * (0.16 + 0.05 * flick)), 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(255,210,90," + (0.5 + 0.4 * flick) + ")"; ctx.beginPath(); ctx.arc(hxx + hw * 0.5, hyy + wall * 0.55, Math.max(1.5, TILE * 0.09), 0, TAU); ctx.fill();
      // polka/beczka (prawy dolny)
      ctx.fillStyle = "#6b4a30"; ctx.fillRect(ix + iw * 0.78, iy + ih * 0.62, iw * 0.2, ih * 0.32);
      ctx.fillStyle = "#caa15b"; ctx.fillRect(ix + iw * 0.78, iy + ih * 0.62 + 2, iw * 0.2, 1.5); ctx.fillRect(ix + iw * 0.78, iy + ih * 0.62 + ih * 0.16, iw * 0.2, 1.5);

      // okap (ciemna ramka) + wejscie u dolu (luka w scianie, pasywne)
      ctx.strokeStyle = "#3b2a1c"; ctx.lineWidth = 2; ctx.strokeRect(x0 + 1, y0 + 1, w - 2, h - 2);
      const dx = c.doorX * TILE;
      ctx.fillStyle = "#7a5836"; ctx.fillRect(dx + 1, y0 + h - wall - 1, TILE - 2, wall + 1);
    }
  }

  function drawShipwreck(view) {
    const layer = state.layersByName.get("Deep_water_shipwreck");
    if (!layer || !layer.tiles.length) return;
    // geometria wraku (cache na warstwie) - planki, zebra, maszt zaleza od ksztaltu
    if (!layer._wreck) {
      const set = new Set(layer.tiles.map((t) => key(t.x, t.y)));
      const xs = layer.tiles.map((t) => t.x), ys = layer.tiles.map((t) => t.y);
      layer._wreck = {
        set, minX: Math.min(...xs), maxX: Math.max(...xs),
        minY: Math.min(...ys), maxY: Math.max(...ys),
        cx: (Math.min(...xs) + Math.max(...xs) + 1) / 2
      };
    }
    const W = layer._wreck;
    const has = (tx, ty) => W.set.has(key(tx, ty));

    for (const t of layer.tiles) {
      const x = t.x * TILE, y = t.y * TILE;
      if (!inView(x, y, view)) continue;
      const h = hash(t.x, t.y);
      const depth = (t.y - W.minY) / Math.max(1, W.maxY - W.minY); // 0=poklad, 1=kil
      // kadlub: gora cieplejsza, dol zamulony i ciemny
      ctx.fillStyle = depth > 0.66 ? "#3c2a1c" : depth > 0.33 ? (h > 0.5 ? "#5c3f29" : "#4d3422") : (h > 0.5 ? "#6f4c33" : "#5e4029");
      ctx.fillRect(x, y, TILE, TILE);
      // szpary miedzy plankami (poziome deski poszycia)
      ctx.fillStyle = "rgba(22,14,8,0.65)";
      ctx.fillRect(x, y + TILE * 0.34, TILE, 1);
      ctx.fillRect(x, y + TILE * 0.7, TILE, 1);
      ctx.fillStyle = "rgba(255,228,180,0.08)";
      ctx.fillRect(x, y + TILE * 0.34 + 1, TILE, 1);
      // co druga kolumna: zebro/wregga (ciemna pionowa belka) z nitami
      if ((t.x % 2) === 0) {
        ctx.fillStyle = "rgba(20,12,6,0.5)"; ctx.fillRect(x + TILE * 0.5 - 1, y, 2, TILE);
        ctx.fillStyle = "rgba(120,96,60,0.5)";
        ctx.fillRect(x + TILE * 0.5 - 1.5, y + TILE * 0.25, 3, 1.5);
        ctx.fillRect(x + TILE * 0.5 - 1.5, y + TILE * 0.75, 3, 1.5);
      }
      // poszarpany poklad: tam, gdzie brak kafelka nad gora wraku
      if (!has(t.x, t.y - 1)) {
        ctx.fillStyle = "#2b1d12";
        for (let sx = 0; sx < TILE; sx += 3) {
          const jag = (hash(t.x * 7 + sx, t.y) > 0.5) ? 2 : 0;
          ctx.fillRect(x + sx, y, 2, 1 + jag);
        }
      }
      // bulaj (okragly iluminator) na burcie, gdzie brak kafelka z boku
      if ((!has(t.x - 1, t.y) || !has(t.x + 1, t.y)) && h > 0.62 && depth < 0.6) {
        ctx.fillStyle = "#1a2a30"; ctx.beginPath(); ctx.arc(x + TILE * 0.5, y + TILE * 0.5, TILE * 0.2, 0, TAU); ctx.fill();
        ctx.strokeStyle = "#9a7a3a"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x + TILE * 0.5, y + TILE * 0.5, TILE * 0.2, 0, TAU); ctx.stroke();
      }
      // glony / wodorosty na dolnych plankach
      if (depth > 0.55 && h > 0.7) {
        ctx.strokeStyle = "rgba(90,150,90,0.55)"; ctx.lineWidth = 1.2;
        const sway = Math.sin(state.time * 1.6 + t.x) * 2;
        ctx.beginPath(); ctx.moveTo(x + TILE * 0.3, y + TILE);
        ctx.quadraticCurveTo(x + TILE * 0.3 + sway, y + TILE * 0.4, x + TILE * 0.3 + sway * 1.4, y + TILE * 0.1);
        ctx.stroke();
      }
    }

    // zlamany maszt wychodzacy z pokladu, przechylony - wyraznie "wrak"
    const mastBaseX = W.cx * TILE, mastBaseY = (W.minY + 0.5) * TILE;
    if (mastBaseX + TILE * 3 > view.x0 && mastBaseX - TILE * 3 < view.x1 &&
        mastBaseY - TILE * 5 < view.y1 && mastBaseY + TILE * 2 > view.y0) {
      const lean = 0.5;
      const topX = mastBaseX + Math.sin(lean) * TILE * 3.4;
      const topY = mastBaseY - Math.cos(lean) * TILE * 3.4;
      ctx.strokeStyle = "#3a281a"; ctx.lineWidth = TILE * 0.28;
      ctx.beginPath(); ctx.moveTo(mastBaseX, mastBaseY); ctx.lineTo(topX, topY); ctx.stroke();
      ctx.strokeStyle = "#5a4028"; ctx.lineWidth = TILE * 0.12;
      ctx.beginPath(); ctx.moveTo(mastBaseX, mastBaseY); ctx.lineTo(topX, topY); ctx.stroke();
      // poprzeczna reja i strzep zaglo
      const midX = (mastBaseX + topX) / 2, midY = (mastBaseY + topY) / 2;
      ctx.strokeStyle = "#3a281a"; ctx.lineWidth = TILE * 0.12;
      ctx.beginPath(); ctx.moveTo(midX - TILE * 1.1, midY - TILE * 0.2); ctx.lineTo(midX + TILE * 1.1, midY - TILE * 0.5); ctx.stroke();
      ctx.fillStyle = "rgba(210,200,170,0.18)";
      const flap = Math.sin(state.time * 1.2) * TILE * 0.2;
      ctx.beginPath();
      ctx.moveTo(midX - TILE * 0.9, midY - TILE * 0.25);
      ctx.lineTo(midX + TILE * 0.4, midY - TILE * 0.45);
      ctx.lineTo(midX + TILE * 0.2 + flap, midY + TILE * 0.9);
      ctx.lineTo(midX - TILE * 0.7, midY + TILE * 0.7);
      ctx.closePath(); ctx.fill();
    }
  }

  // Nora widziana DOKLADNIE Z GORY (lot ptaka): koncentryczne KOLA - pierscien
  // wykopanej ziemi i czarna okragla dziura w srodku. Bez ukosnych elips/kopczykow.
  // Nora widziana z gory jako KWADRATOWE wejscie: ramka wykopanej ziemi + czarny
  // kwadratowy otwor w srodku (zgodnie z kafelkowa, "kwadratowa" estetyka).
  function drawPortals(list, view, underground) {
    for (const portal of list) {
      const x = portal.x * TILE, y = portal.y * TILE;
      if (!inView(x, y, view)) continue;
      const h = hash(portal.x, portal.y);
      // ramka swiezo wykopanej ziemi (kwadrat)
      ctx.fillStyle = "#5a3f26"; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#6e4d2e"; ctx.fillRect(x + TILE * 0.08, y + TILE * 0.08, TILE * 0.84, TILE * 0.84);
      // grudki ziemi na ramce
      ctx.fillStyle = "#4a3320";
      for (let i = 0; i < 6; i++) { const a = hash(portal.x + i * 7, portal.y + i * 11); ctx.fillRect(x + a * (TILE - 2), y + (i % 2 ? TILE - 3 : 1), 1.5, 1.5); ctx.fillRect(x + (i % 2 ? TILE - 3 : 1), y + a * (TILE - 2), 1.5, 1.5); }
      // czarny kwadratowy otwor wejscia
      ctx.fillStyle = "#1b120b"; ctx.fillRect(x + TILE * 0.2, y + TILE * 0.2, TILE * 0.6, TILE * 0.6);
      ctx.fillStyle = "#070504"; ctx.fillRect(x + TILE * 0.28, y + TILE * 0.28, TILE * 0.44, TILE * 0.44);
      if (underground) {
        // wyjscie na powierzchnie: kwadrat swiatla wpadajacego z gory
        ctx.fillStyle = "rgba(200,220,180,0.16)"; ctx.fillRect(x + TILE * 0.36, y + TILE * 0.36, TILE * 0.28, TILE * 0.28);
      } else {
        // wejscie: jasniejszy rant otworu
        ctx.strokeStyle = "rgba(150,115,70,0.55)"; ctx.lineWidth = 1.2; ctx.strokeRect(x + TILE * 0.2, y + TILE * 0.2, TILE * 0.6, TILE * 0.6); ctx.lineWidth = 1;
      }
    }
  }

  // Rdzenie AI (kilka na serwerownie, proporcjonalnie do wielkosci). Etykieta:
  // ON = chroniony (napiecie/straznicy), OFF = podatny (po zabiciu straznikow).
  function drawServerCores() {
    for (const room of state.rooms) {
      if (room.destroyed) continue;
      const lit = roomProtected(room);
      for (const c of room.cores) {
        if (c.dead) continue;
        const pulse = 0.5 + 0.5 * Math.sin(state.time * 3 + c.pulse);
        const x = c.x - c.r, y = c.y - c.r, w = c.r * 2;
        ctx.fillStyle = c.hp / c.maxHp > 0.35 ? "#2c3137" : "#46343b";
        ctx.fillRect(x, y, w, w);
        ctx.fillStyle = "#0b1014";
        ctx.fillRect(x + w * 0.16, y + w * 0.14, w * 0.68, w * 0.18);
        ctx.fillRect(x + w * 0.16, y + w * 0.58, w * 0.68, w * 0.18);
        ctx.fillStyle = lit ? palette.aiPink : palette.leafLight; ctx.globalAlpha = 0.45 + pulse * 0.4;
        for (let i = 0; i < 5; i++) { ctx.fillRect(x + w * 0.2 + i * w * 0.12, y + w * 0.18, w * 0.06, w * 0.1); ctx.fillRect(x + w * 0.2 + i * w * 0.12, y + w * 0.62, w * 0.06, w * 0.1); }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = lit ? "rgba(228,84,154," + (0.45 + pulse * 0.35) + ")" : "rgba(126,203,119,0.85)";
        ctx.lineWidth = 2.5; ctx.strokeRect(x + 1, y + 1, w - 2, w - 2); ctx.lineWidth = 1;
        // ON / OFF (etykieta tuz nad rdzeniem, by zmiescic sie przy malym rdzeniu)
        ctx.fillStyle = lit ? "rgba(255,160,205,0.95)" : "rgba(150,235,140,0.95)";
        ctx.font = "900 " + Math.round(TILE * 0.4) + "px Inter, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(lit ? "ON" : "OFF", c.x, c.y - c.r - TILE * 0.18);
        // pasek hp
        if (c.hp < c.maxHp) {
          ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x, y - 5, w, 3);
          ctx.fillStyle = palette.leafLight; ctx.fillRect(x, y - 5, w * Math.max(0, c.hp / c.maxHp), 3);
        }
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

  // Sprite'y ladowe mieszcza sie w kafelku; rekiny i delfiny (wodne) sa wieksze (2.5x).
  function drawActorSprite(a) {
    const r = a.role;
    const flash = a.hitFlash > 0;
    const R = (a.kind === "shark" || a.kind === "dolphin") ? WATER_SPRITE : SPRITE;

    // DELFIN - WYSTAJE z wody TYLKO podczas skoku; poza tym plynie zanurzony
    // (tylko ciemny, polprzezroczysty zarys pod powierzchnia).
    if (a.kind === "dolphin") {
      if (!a.jumping) {
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.dir); ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#16323f";
        ctx.beginPath(); ctx.ellipse(0, 0, R * 0.9, R * 0.4, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-R * 0.8, 0); ctx.lineTo(-R * 1.12, -R * 0.28); ctx.lineTo(-R * 0.95, 0); ctx.lineTo(-R * 1.12, R * 0.28); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1; ctx.restore();
        drawHpBar(a, R);
        return;
      }
      const arc = Math.sin((a.jumpT / a.jumpDur) * Math.PI) * TILE * 0.6;
      ctx.save(); ctx.translate(a.x, a.y - arc); ctx.rotate(a.dir);
      ctx.fillStyle = flash ? palette.cream : r.c;
      ctx.beginPath(); ctx.ellipse(0, 0, R * 0.95, R * 0.42, 0, 0, TAU); ctx.fill();        // cialo
      ctx.fillStyle = r.c2;
      ctx.beginPath(); ctx.ellipse(0, R * 0.12, R * 0.78, R * 0.22, 0, 0, TAU); ctx.fill();  // jasny brzuch
      ctx.fillStyle = flash ? palette.cream : r.c;
      ctx.beginPath(); ctx.moveTo(-R * 0.85, 0); ctx.lineTo(-R * 1.18, -R * 0.32); ctx.lineTo(-R * 1.0, 0); ctx.lineTo(-R * 1.18, R * 0.32); ctx.closePath(); ctx.fill(); // ogon
      ctx.beginPath(); ctx.moveTo(R * 0.05, -R * 0.32); ctx.lineTo(-R * 0.18, -R * 0.78); ctx.lineTo(-R * 0.32, -R * 0.28); ctx.closePath(); ctx.fill(); // pletwa grzbietowa
      ctx.beginPath(); ctx.moveTo(R * 0.88, 0); ctx.lineTo(R * 1.12, -R * 0.07); ctx.lineTo(R * 1.12, R * 0.07); ctx.closePath(); ctx.fill(); // pysk
      ctx.fillStyle = "#0b1014"; ctx.beginPath(); ctx.arc(R * 0.55, -R * 0.12, R * 0.08, 0, TAU); ctx.fill(); // oko
      ctx.restore();
      drawHpBar(a, R);
      return;
    }
    // REKIN - 75% ZANURZONY: widac tylko gore grzbietu + pletwe; reszta jako zarys pod woda
    if (a.kind === "shark") {
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.dir);
      // zanurzone cialo (ciemny, polprzezroczysty zarys)
      ctx.globalAlpha = 0.32; ctx.fillStyle = "#15323c";
      ctx.beginPath(); ctx.ellipse(0, 0, R * 1.0, R * 0.4, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-R * 0.9, 0); ctx.lineTo(-R * 1.3, -R * 0.45); ctx.lineTo(-R * 1.05, 0); ctx.lineTo(-R * 1.3, R * 0.45); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      // gora grzbietu wystajaca nad wode (waski, nieprzezroczysty pasek wzdluz srodka)
      ctx.fillStyle = flash ? palette.cream : r.c;
      ctx.beginPath(); ctx.ellipse(0, -R * 0.02, R * 0.78, R * 0.12, 0, 0, TAU); ctx.fill();
      // pletwa grzbietowa (wyrazna)
      ctx.fillStyle = flash ? palette.cream : "#3a4a52";
      ctx.beginPath(); ctx.moveTo(R * 0.1, -R * 0.08); ctx.lineTo(-R * 0.18, -R * 0.9); ctx.lineTo(-R * 0.42, -R * 0.06); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#0b1014"; ctx.beginPath(); ctx.arc(R * 0.5, -R * 0.04, R * 0.05, 0, TAU); ctx.fill(); // oko na wystajacej gorze
      ctx.restore();
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

    // zwierzeta (kotki, pieski, gasienice) NIE rzucaja cienia; tylko maszyny.
    // Gasienica pelznie po ziemi, wiec nie unosi sie (brak pionowego bujania).
    const bob = a.world === "underground" ? 0 : Math.sin(a.phase) * (r.drone ? 2.5 : 1);
    if (r.robot || r.drone) shadow(a.x, a.y + R * 0.7, R * 0.9, R * 0.28);
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
      // GASIENICA - pelznie PO ZIEMI tunelu (peristaltyczna fala); rozne kolory
      const CAT = a.kind === "friend"
        ? ["#9ecf8f", "#b9d97f", "#8fcfa8", "#cfd97f", "#7fc99a"]
        : ["#b06a8f", "#c07a6a", "#9a6ab0", "#b85a7a", "#a8708f"];
      const col = pick(CAT, a.tint);
      const base = R * 0.34;       // segmenty leza na dnie tunelu
      const dir = a.face === -1 ? -1 : 1;
      ctx.scale(dir, 1);
      for (let i = 0; i < 5; i++) {
        const phase = state.time * 7 - i * 0.9;
        const lift = Math.max(0, Math.sin(phase)) * 0.9; // delikatne wybrzuszenie grzbietu
        ctx.fillStyle = i === 4 ? "#cfe6c2" : col;       // jasniejsza glowa
        ctx.beginPath(); ctx.arc(-R * 0.7 + i * R * 0.36, base - lift, R * 0.26, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = "#1d1714"; ctx.fillRect(R * 0.62, base - 1, 1.4, 1.4); // oko
      ctx.strokeStyle = col; ctx.lineWidth = 0.8;                            // czulek
      ctx.beginPath(); ctx.moveTo(R * 0.72, base - 1.5); ctx.lineTo(R * 0.85, base - R * 0.4); ctx.stroke();
    } else if (a.layer === "Bad_small_animal") {
      // PAJAK - rozne kolory korpusu + znak na odwloku; 8 nog drga
      const SPID = ["#2b201b", "#1f1a16", "#3a2a22", "#241f24", "#2e2420", "#352018"];
      const sbody = flash ? palette.cream : pick(SPID, a.tint);
      const MARK = ["rgba(208,69,90,0.85)", "rgba(220,180,60,0.85)", "rgba(180,180,190,0.7)", "rgba(150,90,200,0.8)"];
      const ssz = 0.85 + a.tint2 * 0.4;
      ctx.scale(ssz, ssz);
      ctx.strokeStyle = flash ? palette.cream : darken(pick(SPID, a.tint), 0.6); ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const ly = -R * 0.32 + i * R * 0.22;
        const wig = Math.sin(state.time * 11 + i) * 1.3;
        ctx.beginPath(); ctx.moveTo(0, R * 0.05); ctx.lineTo(-R * 0.85, ly + wig); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, R * 0.05); ctx.lineTo(R * 0.85, ly - wig); ctx.stroke();
      }
      ctx.fillStyle = sbody;
      ctx.beginPath(); ctx.ellipse(0, R * 0.12, R * 0.42, R * 0.5, 0, 0, TAU); ctx.fill();   // odwlok
      ctx.beginPath(); ctx.arc(0, -R * 0.34, R * 0.26, 0, TAU); ctx.fill();                  // glowotulow
      ctx.fillStyle = pick(MARK, a.tint2); ctx.fillRect(-2, R * 0.04, 4, R * 0.28);          // znak na odwloku
      ctx.fillStyle = "#e05a5a"; ctx.fillRect(-2.2, -R * 0.4, 1.5, 1.5); ctx.fillRect(1, -R * 0.4, 1.5, 1.5); // oczy
    } else if (a.layer === "Good_small_animal") {
      // MOTYLEK - rozne kolory skrzydel, trzepocze
      const WINGS = [["#f3c14b", "#e8772f"], ["#e85fa6", "#b03a7a"], ["#6fb0e8", "#3a6ab0"],
        ["#9be86f", "#4ba03a"], ["#e8e06f", "#b0a03a"], ["#c98fe8", "#7a4bb0"], ["#f08a8a", "#c04a4a"]];
      const wp = pick(WINGS, a.tint);
      const flap = Math.abs(Math.sin(state.time * 12 + a.phase));
      const wx = R * (0.3 + 0.6 * flap) * (0.85 + a.tint2 * 0.4);
      for (const sgn of [-1, 1]) {
        ctx.fillStyle = wp[0];
        ctx.beginPath(); ctx.ellipse(sgn * wx * 0.6, -R * 0.16, wx * 0.62, R * 0.42, sgn * 0.5, 0, TAU); ctx.fill();
        ctx.fillStyle = wp[1];
        ctx.beginPath(); ctx.ellipse(sgn * wx * 0.5, R * 0.32, wx * 0.46, R * 0.32, -sgn * 0.4, 0, TAU); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.beginPath(); ctx.arc(sgn * wx * 0.7, -R * 0.16, 1.4, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = "#2a211a"; ctx.fillRect(-1, -R * 0.5, 2, R);                            // tulow
      ctx.strokeStyle = "#2a211a"; ctx.lineWidth = 0.8;                                       // czulki
      ctx.beginPath(); ctx.moveTo(0, -R * 0.5); ctx.lineTo(-2.5, -R * 0.82); ctx.moveTo(0, -R * 0.5); ctx.lineTo(2.5, -R * 0.82); ctx.stroke();
    } else {
      // KOTEK / PIESEK (duze zwierzeta na powierzchni) - rozne futra, rozmiary, znaczenia
      const dog = a.tint2 > 0.5;
      const sz = 0.82 + a.tint2 * 0.36;                      // rozny rozmiar
      const dir = a.face === -1 ? -1 : 1; ctx.scale(dir * sz, sz);
      const FUR = a.kind === "friend"
        ? ["#caa15b", "#b8743a", "#d8c49a", "#9a6a3a", "#e0b878", "#7a5230", "#c98f5a"]
        : ["#b05a5a", "#8f5b5b", "#a86a4a", "#9a5a6a", "#7a6064", "#a3553f"];
      const body = flash ? palette.cream : pick(FUR, a.tint);
      const dark = darken(flash ? "#caa15b" : pick(FUR, a.tint), 0.55);
      // konczyny (chod) - rysowane pod tulowiem, machaja podczas ruchu
      const moving = !!(a.card && (a.card[0] || a.card[1]));
      const gait = moving ? Math.sin(state.time * 10 + a.phase) : 0;
      ctx.strokeStyle = dark; ctx.lineWidth = 2.2; ctx.lineCap = "round";
      for (const [lx, ph] of [[-R * 0.4, 1], [-R * 0.12, -1], [R * 0.12, -1], [R * 0.4, 1]]) {
        ctx.beginPath(); ctx.moveTo(lx, R * 0.16); ctx.lineTo(lx + gait * ph * R * 0.3, R * 0.62); ctx.stroke();
      }
      ctx.lineCap = "butt"; ctx.lineWidth = 1;
      ctx.fillStyle = dark; // ogon
      if (dog) ctx.fillRect(-R * 0.9, -R * 0.5, R * 0.5, 3);
      else { ctx.beginPath(); ctx.arc(-R * 0.7, -R * 0.2, R * 0.18, 0, TAU); ctx.fill(); }
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(-R * 0.1, R * 0.05, R * 0.55, R * 0.4, 0, 0, TAU); ctx.fill(); // tulow
      ctx.beginPath(); ctx.arc(R * 0.5, -R * 0.2, R * 0.34, 0, TAU); ctx.fill(); // glowa
      // znaczenia/latki u czesci osobnikow
      if (a.tint > 0.55) {
        ctx.fillStyle = dark;
        ctx.beginPath(); ctx.arc(-R * 0.2, R * 0.0, R * 0.16, 0, TAU); ctx.fill();
        if (a.tint > 0.78) ctx.fillRect(R * 0.3, -R * 0.32, R * 0.16, R * 0.5); // pasek
      }
      ctx.fillStyle = dark; // uszy
      if (dog) { ctx.beginPath(); ctx.ellipse(R * 0.4, -R * 0.45, 3, 5, 0.3, 0, TAU); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(R * 0.35, -R * 0.5); ctx.lineTo(R * 0.45, -R * 0.85); ctx.lineTo(R * 0.55, -R * 0.5); ctx.fill();
             ctx.beginPath(); ctx.moveTo(R * 0.6, -R * 0.5); ctx.lineTo(R * 0.7, -R * 0.85); ctx.lineTo(R * 0.8, -R * 0.5); ctx.fill(); }
      ctx.fillStyle = a.kind === "friend" ? "#203b2c" : palette.aiBlue; ctx.fillRect(R * 0.6, -R * 0.25, 2.5, 2.5);
      if (a.kind !== "friend") { ctx.fillStyle = "rgba(105,215,255,0.5)"; ctx.fillRect(R * 0.3, -R * 0.45, R * 0.4, 2); }
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
    const p = state.player;
    for (const n of state.npcs) {
      if (n.world !== world) continue;
      const x = n.x, y = n.y;
      if (!inView(x - TILE, y - TILE, view)) continue;
      const R = SPRITE;
      // NPC bez cienia, bez imienia; podpowiedz rozmowy idzie do HUD (nearNpc)
      ctx.save(); ctx.translate(x, y + Math.sin(state.time * 1.5 + n.phase) * 1);
      if (n.mole) {
        // KRET: ciemne futro, rozowy nos, lopatki
        ctx.fillStyle = "#5a4636"; ctx.beginPath(); ctx.arc(0, 0, R * 0.55, 0, TAU); ctx.fill();
        ctx.fillStyle = "#6b5240"; ctx.beginPath(); ctx.arc(R * 0.3, -R * 0.1, R * 0.32, 0, TAU); ctx.fill();
        ctx.fillStyle = "#ffb0b0"; ctx.beginPath(); ctx.arc(R * 0.55, 0, R * 0.14, 0, TAU); ctx.fill(); // nos
        ctx.fillStyle = "#d8c8a0"; ctx.fillRect(-R * 0.5, R * 0.2, R * 0.35, R * 0.25); ctx.fillRect(R * 0.1, R * 0.3, R * 0.35, R * 0.25); // lopatki
        ctx.fillStyle = "#1d1714"; ctx.fillRect(R * 0.2, -R * 0.15, 1.5, 1.5);
      } else {
        // BOBR NPC: wyglada DOKLADNIE jak gracz; spokojnie patrzy w strone bobra-gracza
        const face = Math.atan2(p.y - y, p.x - x);
        drawBeaverBody(face, { tailCm: 24, gold: false, hurt: false, phase: n.phase });
      }
      // znak rozmowy nad NPC (bez imienia - podpowiedz klawisza idzie do HUD)
      ctx.fillStyle = "#fff3b0"; ctx.font = "700 " + Math.round(TILE * 0.5) + "px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("?", 0, -R - 2);
      ctx.restore();
    }
  }

  // czy gracz stoi przy NPC (do podpowiedzi rozmowy w HUD)
  function nearNpc() {
    const p = state.player;
    return state.npcs.some((n) => n.world === state.area && dist(p.x, p.y, n.x, n.y) < p.r + TILE * 1.6);
  }

  function drawParticles() {
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life * 2);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  // Wspolny rysunek bobra (gracz i NPC wygladaja tak samo). Rysuje w (0,0);
  // caller robi translate. opts: { tailCm, gold, hurt, phase }.
  function drawBeaverBody(facing, opts) {
    const fc = Math.cos(facing), fs = Math.sin(facing);
    const hurt = opts.hurt;
    const cm = Math.max(0, opts.tailCm || 0);
    // f: 0 = ogon ZNIKL, 1 = naturalna dlugosc (18 cm), >1 = wydluzony. Skaluje calosc.
    const f = cm / 18;
    const extra = Math.max(0, cm - 18) / 4.5;                  // dodatkowe "poziomy" powyzej naturalnego
    // ogon: plaska, PODLUZNA lopata; znika przy 0 cm, rosnie podluznie przy dluzszym
    if (cm > 0.5) {
      const tw = Math.sin(state.time * 6 + (opts.phase || 0)) * 0.12;
      const len = TILE * (0.22 * Math.min(f, 1) + extra * 0.075);   // krotszy ogon = krotsza lopata, az do znikniecia
      const wid = TILE * (0.12 * Math.min(f, 1) + extra * 0.012);   // szerokosc rosnie wolno -> podluzny
      const toff = TILE * 0.3 * Math.min(f, 1) + len * 0.7;
      ctx.save(); ctx.rotate(Math.atan2(fs, fc) + Math.PI + tw);
      ctx.fillStyle = palette.beaverDark;
      ctx.beginPath(); ctx.ellipse(toff, 0, len, wid, 0, 0, TAU); ctx.fill();
      ctx.fillRect(toff - len * 0.5, -wid, len, wid * 2);
      ctx.strokeStyle = "rgba(20,12,8,0.5)"; ctx.lineWidth = 0.7;   // krata na lopacie
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(toff - len * 0.7, i * wid * 0.6); ctx.lineTo(toff + len * 0.85, i * wid * 0.6); ctx.stroke(); }
      ctx.fillStyle = "rgba(245,238,209,0.12)"; ctx.fillRect(toff - len * 0.5, -1, len * 0.9, 1);
      ctx.restore();
    }
    // cialo
    ctx.fillStyle = hurt ? palette.cream : palette.beaver;
    ctx.beginPath(); ctx.arc(0, 0, TILE * 0.36, 0, TAU); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.beginPath(); ctx.arc(TILE * 0.08, TILE * 0.1, TILE * 0.22, 0, TAU); ctx.fill();
    // glowa w kierunku patrzenia
    const hx = fc * TILE * 0.28, hy = fs * TILE * 0.28;
    ctx.fillStyle = hurt ? palette.cream : "#9a673d";
    ctx.beginPath(); ctx.arc(hx, hy, TILE * 0.22, 0, TAU); ctx.fill();
    ctx.fillStyle = palette.beaverDark;
    ctx.beginPath(); ctx.arc(hx - fs * TILE * 0.16, hy + fc * TILE * 0.16, TILE * 0.07, 0, TAU); ctx.arc(hx + fs * TILE * 0.16, hy - fc * TILE * 0.16, TILE * 0.07, 0, TAU); ctx.fill();
    ctx.fillStyle = "#1d1714";
    ctx.fillRect(hx + fc * 1.5 - fs * 2 - 1, hy + fs * 1.5 + fc * 2 - 1, 2, 2);
    ctx.fillRect(hx + fc * 1.5 + fs * 2 - 1, hy + fs * 1.5 - fc * 2 - 1, 2, 2);
    ctx.fillStyle = opts.gold ? "#ffd66d" : palette.cream;
    ctx.fillRect(hx + fc * TILE * 0.18 - 1.5, hy + fs * TILE * 0.18 - 1.5, 3, 3);
  }

  // Bobr-gracz z gory, kompaktowy (mieści się w jednym kafelku). Bez cienia.
  function drawPlayer() {
    const p = state.player;
    const hurt = p.hurtCd > 0 && Math.floor(state.time * 18) % 2 === 0;
    const fc = Math.cos(p.facing), fs = Math.sin(p.facing);

    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.ghost) ctx.globalAlpha = 0.62;

    if (p.ghost) { ctx.strokeStyle = "rgba(145,230,255,0.9)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, TILE * 0.5 + Math.sin(state.time * 5), 0, TAU); ctx.stroke(); }
    if (p.shield > 0) { ctx.strokeStyle = "rgba(78,208,109," + (0.4 + Math.sin(state.time * 4) * 0.15) + ")"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, TILE * 0.5, 0, TAU); ctx.stroke(); }

    // ATAK OBROTOWY (Q): caly bobr wiruje 360 stopni + pierscien zamachu ogona
    if (p.spinT > 0) {
      const prog = 1 - p.spinT / 0.5;
      const grow = Math.max(0, p.tailCm - 18) / 4.5;
      const reach = TILE * (1.1 + Math.min(10, grow) * 0.12);
      ctx.strokeStyle = "rgba(245,238,209," + (0.55 * (p.spinT / 0.5)) + ")"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, reach * (0.55 + prog * 0.5), 0, TAU); ctx.stroke();
      ctx.rotate(prog * TAU);
    }

    drawBeaverBody(p.facing, { tailCm: p.tailCm, gold: p.goldTeeth, hurt });

    // niesione drewno (chwycone przez S) - kloda trzymana przed pyskiem
    if (p.heldWood) {
      ctx.save();
      ctx.translate(fc * TILE * 0.46, fs * TILE * 0.46);
      ctx.rotate(Math.atan2(fs, fc) + Math.PI / 2);
      ctx.fillStyle = "#7a5430"; ctx.fillRect(-TILE * 0.3, -2.5, TILE * 0.6, 5);
      ctx.fillStyle = "#9a6b3f"; ctx.fillRect(-TILE * 0.3, -2.5, TILE * 0.6, 1.6);
      ctx.strokeStyle = "rgba(40,25,12,0.55)"; ctx.lineWidth = 1; ctx.strokeRect(-TILE * 0.3, -2.5, TILE * 0.6, 5);
      ctx.restore();
    }

    // ZANURZENIE: na powierzchni i w wodzie podziemnej bobr jest czesciowo zanurzony
    // (dolna polowa pod woda), a podczas nurkowania - w calosci pod woda (welon + babelki).
    if (p.swimming && state.area !== "underwater") {
      const wl = -TILE * 0.04;                     // linia wody ~ srodek bobra
      ctx.save();
      ctx.fillStyle = "rgba(55,125,160,0.55)";
      ctx.beginPath();
      ctx.moveTo(-TILE * 0.55, wl);
      for (let i = -0.55; i <= 0.55; i += 0.16) ctx.lineTo(TILE * i, wl + Math.sin(state.time * 5 + i * 11) * 1.4);
      ctx.lineTo(TILE * 0.55, TILE * 0.6); ctx.lineTo(-TILE * 0.55, TILE * 0.6); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(150,215,240,0.6)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, wl, TILE * 0.5, TILE * 0.15, 0, 0, TAU); ctx.stroke();
    } else if (state.area === "underwater") {
      ctx.fillStyle = "rgba(40,90,130,0.45)";
      ctx.beginPath(); ctx.arc(0, 0, TILE * 0.5, 0, TAU); ctx.fill();
      ctx.fillStyle = "rgba(195,232,250,0.75)";
      for (let i = 0; i < 3; i++) {
        const t = (state.time * 1.4 + i * 0.5) % 1;
        ctx.beginPath(); ctx.arc(TILE * (0.18 + i * 0.12), -TILE * (0.15 + t * 0.55), 1.1 + i * 0.4, 0, TAU); ctx.fill();
      }
    }
    if (p.biteCd > 0.3) {
      ctx.strokeStyle = "rgba(245,238,209,0.8)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(fc * TILE * 0.5, fs * TILE * 0.5, TILE * 0.18, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  // wspolrzedne swiata -> piksele ekranu (do ostrego tekstu nad pikseloza)
  function worldToScreen(wx, wy) {
    return { x: wx * view2screen.scale + view2screen.ox, y: wy * view2screen.scale + view2screen.oy };
  }

  // Tekst unoszacy sie w swiecie - rysowany OSTRO na ekranie (czytelny, nie pikselowany).
  function drawFloatText(size) {
    if (!state.floatText.length) return;
    ctx.save();
    ctx.font = "800 14px Inter, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const f of state.floatText) {
      const s = worldToScreen(f.x, f.y);
      if (s.x < -40 || s.x > size.w + 40 || s.y < -20 || s.y > size.h + 20) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(6,9,8,0.85)";
      ctx.strokeText(f.text, s.x, s.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, s.x, s.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // (drawUndergroundFog usuniete - sferyczne przyciemnianie glitchowalo i spowalnialo)

  function drawUnderwaterTint(size) {
    const p = state.player;
    const s = worldToScreen(p.x, p.y);
    const sc = view2screen.scale;
    ctx.fillStyle = "rgba(10,40,70,0.25)";
    ctx.fillRect(0, 0, size.w, size.h);
    const grad = ctx.createRadialGradient(s.x, s.y, TILE * 4 * sc, s.x, s.y, TILE * 13 * sc);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(2,10,20,0.7)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size.w, size.h);
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

    // TYLKO zycie (serca) i dlugosc ogona - bez ramki/tla, bez odznak.
    // serca: kazde = 2 pkt; nadmiar ponad 100% rysowany na zloto
    const baseHearts = Math.ceil(p.maxHp / 2);
    const liveHearts = Math.ceil(p.hp / 2);
    const shownHearts = Math.min(12, Math.max(baseHearts, liveHearts));
    const hpitch = 15;
    for (let i = 0; i < shownHearts; i++) {
      const over = i >= baseHearts;
      const fill = p.hp >= i * 2 + 2 ? 2 : (p.hp >= i * 2 + 1 ? 1 : 0);
      drawHeart(24 + i * hpitch, 18, 12, fill, over ? "#ffd66d" : "#f15b5b");
    }
    if (liveHearts > 12) {
      ctx.fillStyle = "#ffd66d"; ctx.textAlign = "left";
      ctx.fillText("+" + (liveHearts - 12), 24 + 12 * hpitch + 4, 26);
    }
    // dlugosc ogona w cm + PASEK - GORA PO PRAWEJ (bez tla, z obrysem)
    const tailTxt = "OGON: " + Math.round(p.tailCm) + " CM";
    ctx.font = "800 13px Inter, sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(6,9,8,0.85)";
    ctx.strokeText(tailTxt, size.w - 16, 22);
    ctx.fillStyle = "#f5eed1"; ctx.fillText(tailTxt, size.w - 16, 22);
    // pasek dlugosci ogona (pelny przy ~120 cm, ale rosnie dalej kolorem)
    const tbw = 150, tbx = size.w - 16 - tbw, tby = 34;
    ctx.fillStyle = "rgba(6,9,8,0.6)"; ctx.fillRect(tbx, tby, tbw, 7);
    const frac = Math.min(1, (p.tailCm - 10) / 110);
    ctx.fillStyle = p.tailCm > 120 ? "#ffd66d" : "#9ad17a"; ctx.fillRect(tbx, tby, tbw * Math.max(0, frac), 7);
    ctx.strokeStyle = "rgba(245,238,209,0.4)"; ctx.lineWidth = 1; ctx.strokeRect(tbx + 0.5, tby + 0.5, tbw - 1, 6);
    ctx.font = "700 12px Inter, sans-serif"; ctx.textAlign = "left";

    // PASEK ZYCIA FINALNEGO BOSSA - GORA, NA SRODKU (gdy boss zyje i jest blisko)
    const b = state.boss;
    if (b && !b.defeated && state.area === "surface" && dist(p.x, p.y, b.x, b.y) < TILE * 44) {
      const bw = Math.min(360, size.w - 80), bx = size.w / 2 - bw / 2, by = 16;
      panel(bx, by, bw, 34);
      ctx.fillStyle = "#ff9ad6"; ctx.font = "800 13px Inter, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText("RDZEN AI - FINALNY BOSS", size.w / 2, by + 4);
      meter(bx + 14, by + 20, bw - 28, 8, b.hp / b.maxHp, "#e85fa6");
      ctx.textBaseline = "middle";
    }

    // kontekstowe podpowiedzi na dole ekranu
    if (nearNpc()) {
      hint(size, "E - POROZMAWIAJ");
    } else if (state.area === "surface" && !p.ghost && pointInRegion(p.x, p.y, state.deepWater)) {
      hint(size, "C - ZANURKUJ");
    } else if (state.area === "underwater") {
      hint(size, "C - WYNURZ SIE");
    } else if (state.area === "surface" && nearestPortal(state.portalsSurface)) {
      hint(size, "E - ZEJDZ DO TUNELI");
    } else if (state.area === "underground" && nearestPortal(state.portalsUnder)) {
      hint(size, "E - WROC NA POWIERZCHNIE");
    }

    ctx.restore();
  }

  // Serce zycia: fill 0=puste, 1=pol, 2=pelne. Rysowane na ostrej warstwie HUD.
  function drawHeart(cx, cy, s, fill, color) {
    ctx.save();
    ctx.translate(cx, cy);
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(0, s * 0.28);
      ctx.bezierCurveTo(0, 0, -s * 0.5, 0, -s * 0.5, s * 0.32);
      ctx.bezierCurveTo(-s * 0.5, s * 0.6, -s * 0.1, s * 0.74, 0, s);
      ctx.bezierCurveTo(s * 0.1, s * 0.74, s * 0.5, s * 0.6, s * 0.5, s * 0.32);
      ctx.bezierCurveTo(s * 0.5, 0, 0, 0, 0, s * 0.28);
      ctx.closePath();
    };
    path(); ctx.fillStyle = "rgba(245,238,209,0.16)"; ctx.fill();
    if (fill > 0) {
      ctx.save();
      if (fill === 1) { ctx.beginPath(); ctx.rect(-s * 0.6, -s * 0.2, s * 0.6, s * 1.4); ctx.clip(); }
      path(); ctx.fillStyle = color; ctx.fill();
      ctx.restore();
    }
    path(); ctx.strokeStyle = "rgba(20,12,10,0.5)"; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.restore();
  }

  // Bez ramki - sam tekst z obrysem (nie wystaje, bo nie ma czego "wystawac").
  function hint(size, text) {
    ctx.save();
    ctx.font = "700 14px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(6,9,8,0.9)"; ctx.strokeText(text, size.w / 2, size.h - 54);
    ctx.fillStyle = "#bfff8c"; ctx.fillText(text, size.w / 2, size.h - 54);
    ctx.restore();
  }

  function drawMessage(size) {
    if (state.messageTimer <= 0) return;
    ctx.save();
    ctx.font = "800 15px Inter, system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(6,9,8,0.9)"; ctx.strokeText(state.message, size.w / 2, size.h - 26);
    ctx.fillStyle = "#f5eed1"; ctx.fillText(state.message, size.w / 2, size.h - 26);
    ctx.restore();
  }

  // Dialog NPC - bez ramki, sam tekst z obrysem, wycentrowany nad komunikatem.
  function drawDialog(size) {
    if (state.dialogTimer <= 0 || !state.dialog) return;
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const lines = state.dialog.lines;
    const baseY = size.h - 100 - lines.length * 20;   // wyzej, by nie nachodzic na podpowiedz "E - POROZMAWIAJ"
    ctx.font = "800 15px Inter, sans-serif";
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(6,9,8,0.9)"; ctx.strokeText(state.dialog.name, size.w / 2, baseY);
    ctx.fillStyle = "#bfff8c"; ctx.fillText(state.dialog.name, size.w / 2, baseY);
    ctx.font = "600 13px Inter, sans-serif";
    lines.forEach((ln, i) => {
      const y = baseY + 22 + i * 20;
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(6,9,8,0.9)"; ctx.strokeText(ln, size.w / 2, y);
      ctx.fillStyle = "#eef8ec"; ctx.fillText(ln, size.w / 2, y);
    });
    ctx.restore();
  }

  // Lamanie tekstu na linie do podanej szerokosci - zwraca y po ostatniej linii.
  function wrapText(text, x, y, maxW, lineH) {
    const words = String(text).split(/\s+/);
    let line = "", yy = y;
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy); yy += lineH; line = word;
      } else line = test;
    }
    if (line) { ctx.fillText(line, x, yy); yy += lineH; }
    return yy;
  }

  // Ikona w ekwipunku - ten sam rysunek co na mapie (drawItemIcon), wycentrowany.
  function drawInvIcon(it, x, y, s) {
    drawItemIcon(it.icon || it.kind || "data", x + s / 2, y + s / 2, s * 0.5, it.color);
  }

  // Ekwipunek: lista z ikonami po lewej + pelny opis wybranego wpisu po prawej.
  function drawInventory(size) {
    ctx.save();
    ctx.fillStyle = "rgba(6,9,8,0.9)"; ctx.fillRect(0, 0, size.w, size.h);
    const w = Math.min(760, size.w - 50);
    const x = size.w / 2 - w / 2, y = 56;
    const h = size.h - 112;
    panel(x, y, w, h);
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillStyle = "#f5eed1"; ctx.font = "800 18px Inter, sans-serif";
    ctx.fillText("EKWIPUNEK / ZEBRANE DANE", x + 20, y + 16);
    ctx.fillStyle = "rgba(245,238,209,0.55)"; ctx.font = "600 12px Inter, sans-serif";
    ctx.fillText("STRZALKI gora/dol - wybor wpisu     I / Esc - zamknij", x + 20, y + h - 26);

    const items = state.inventory;
    if (!items.length) {
      ctx.fillStyle = "rgba(245,238,209,0.6)"; ctx.font = "500 14px Inter, sans-serif";
      ctx.fillText("Jeszcze nic nie zebrales.", x + 20, y + 58);
      ctx.fillText("Szukaj danych AI, notatek, skrzyn i wpisow w opuszczonych chatkach.", x + 20, y + 80);
      ctx.restore(); return;
    }
    state.invSel = clamp(state.invSel, 0, items.length - 1);

    // --- lewa kolumna: lista wpisow ---
    const listX = x + 22, listY = y + 52, listW = w * 0.4, rowH = 30;
    const maxRows = Math.max(1, Math.floor((h - 92) / rowH));
    const start = clamp(state.invSel - Math.floor(maxRows / 2), 0, Math.max(0, items.length - maxRows));
    for (let i = start; i < Math.min(items.length, start + maxRows); i++) {
      const it = items[i];
      const ry = listY + (i - start) * rowH;
      if (i === state.invSel) {
        ctx.fillStyle = "rgba(126,203,119,0.16)"; ctx.fillRect(listX - 8, ry - 4, listW, rowH - 3);
        ctx.strokeStyle = "rgba(126,203,119,0.5)"; ctx.strokeRect(listX - 8.5, ry - 4.5, listW, rowH - 3);
      }
      drawInvIcon(it, listX, ry, 18);
      ctx.fillStyle = i === state.invSel ? "#f5eed1" : "rgba(238,248,236,0.78)";
      ctx.font = "700 13px Inter, sans-serif"; ctx.textBaseline = "middle";
      const label = it.title.length > 24 ? it.title.slice(0, 23) + "…" : it.title;
      ctx.fillText(label, listX + 28, ry + (rowH - 4) / 2 - 1);
      ctx.textBaseline = "top";
    }
    if (items.length > maxRows) {
      ctx.fillStyle = "rgba(245,238,209,0.5)"; ctx.font = "600 11px Inter, sans-serif";
      ctx.fillText((state.invSel + 1) + " / " + items.length, listX, listY + maxRows * rowH + 2);
    }

    // --- prawa kolumna: szczegoly wybranego wpisu (opis do czytania) ---
    const sel = items[state.invSel];
    const dX = x + w * 0.46, dY = y + 54, dW = w - (w * 0.46) - 28;
    ctx.strokeStyle = "rgba(245,238,209,0.12)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(dX - 14, dY - 2); ctx.lineTo(dX - 14, y + h - 38); ctx.stroke();
    drawInvIcon(sel, dX, dY, 42);
    ctx.fillStyle = sel.color || "#9fe7ff"; ctx.font = "800 16px Inter, sans-serif";
    wrapText(sel.title, dX + 56, dY + 2, dW - 56, 19);
    const kindLabel = sel.kind === "note" ? "NOTATKA" : sel.kind === "key" ? "KLUCZ" : sel.kind === "item" ? "PRZEDMIOT" : "DANE AI";
    ctx.fillStyle = "rgba(159,231,255,0.7)"; ctx.font = "700 11px Inter, sans-serif";
    ctx.fillText(kindLabel, dX + 56, dY + 26);
    ctx.fillStyle = "#eef8ec"; ctx.font = "500 13px Inter, sans-serif";
    wrapText(sel.desc || "(brak dodatkowego opisu)", dX, dY + 64, dW, 19);
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

  // Padajacy snieg z nieba (proceduralnie z czasu - bez stanu). Rysowany ostro na ekranie.
  function drawSnowfall(size) {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    const t = state.time;
    for (let i = 0; i < 110; i++) {
      const baseX = ((i * 9973) % 1000) / 1000;        // pseudolosowa kolumna
      const speed = 26 + (i % 6) * 11;                 // rozne predkosci opadania
      const drift = Math.sin(t * 0.7 + i * 0.6) * 16;  // boczny dryf
      const x = (((baseX * size.w + drift) % size.w) + size.w) % size.w;
      const y = (((t * speed + i * 41) % (size.h + 24)) + size.h + 24) % (size.h + 24) - 12;
      const r = 1 + (i % 3) * 0.7;
      ctx.globalAlpha = 0.35 + (i % 3) * 0.22;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
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
  // Kazdy bober i kazdy kret mowi co innego (przydzielane po kolei, bez powtorzen).
  // (COTTAGE_LORE usuniete - chatki sa pasywne; ich tresci sa teraz w CHEST_LOOT)

  // -----------------------------------------------------------------------
  // Wejscie
  // -----------------------------------------------------------------------
  // Ruch: tylko strzalki. Akcje: q/w/e/a/s/d/c. Tryb ducha (ukryty): znak minus.
  const PREVENT = new Set([
    "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "KeyW", "KeyS", "KeyD", "KeyE", "KeyC", "KeyQ", "ShiftLeft", "ShiftRight",
    "KeyI", "KeyR", "KeyM", "Minus", "NumpadSubtract", "Escape", "Enter"
  ]);

  window.addEventListener("keydown", (e) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    initAudio();

    // tryb ducha - ukryty skrot (znak "-"), nie pokazywany w panelu sterowania
    if ((e.code === "Minus" || e.code === "NumpadSubtract") && state.mode === "play") {
      if (!e.repeat) toggleGhost();
      return;
    }
    if (e.repeat) { keys.add(e.code); return; }

    if (e.code === "KeyM") { toggleMute(); return; }
    // PAUZA: Escape wraca do gry, R zaczyna od nowa (M dziala wyzej)
    if (state.paused) {
      if (e.code === "Escape") state.paused = false;
      else if (e.code === "KeyR") reset();
      return;
    }
    if (state.mode === "menu") { if (e.code === "Enter" || e.code === "Space") startGame(); return; }
    if (e.code === "KeyR" && (state.mode === "dead" || state.mode === "win" || state.mode === "play")) {
      if (state.mode !== "play" || e.shiftKey) { reset(); return; }
    }
    if (e.code === "KeyI" && state.mode === "play") { state.inventoryOpen = !state.inventoryOpen; state.invSel = 0; return; }
    if (state.inventoryOpen) {
      if (e.code === "Escape" || e.code === "KeyI") state.inventoryOpen = false;
      else if (e.code === "ArrowUp") state.invSel = Math.max(0, state.invSel - 1);
      else if (e.code === "ArrowDown") state.invSel = Math.min(Math.max(0, state.inventory.length - 1), state.invSel + 1);
      return;
    }
    if (state.mode !== "play") { keys.add(e.code); return; }

    if (e.code === "Escape") { state.paused = true; keys.clear(); return; }  // menu pauzy ze sterowaniem
    if (e.code === "KeyE") { interact(); return; }      // nora / skrzynia / NPC
    if (e.code === "KeyQ") { spinAttack(); return; }    // obrot 360 - atak ogonem dookola
    if (e.code === "KeyS") { grabDropWood(); return; }   // chwyc / upusc drewno
    if (e.code === "KeyD") { throwWood(); return; }      // rzut drewnem
    if (e.code === "KeyC") { toggleDive(); return; }     // nurkowanie / wynurzenie
    keys.add(e.code);                                    // W (gryzienie), Shift (bieg), strzalki - czytane ciagle
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

    // POD ZIEMIA: osobna muzyka - niskie tony, tajemnicza, powolna (dron + dlugie nuty)
    if (state.area === "underground") {
      musicGain.gain.setTargetAtTime(0.6, context.currentTime, 0.8);
      if (context.currentTime < audio.nextNote) return;
      // niski, ale SLYSZALNY rejestr (55-130 Hz gubi sie na glosnikach laptopa)
      const uscale = [110, 130.8, 146.8, 174.6, 196, 220, 261.6];   // A2..C4, molowo
      const uphrase = [0, 2, 1, 3, 0, 4, 2, 1, 5, 3, 2, 0];
      const note = uscale[uphrase[audio.index % uphrase.length] % uscale.length];
      const now = context.currentTime;
      // glowny, dlugi ton (mocniejszy, by bylo slychac)
      const osc = context.createOscillator(); const gain = context.createGain();
      osc.type = "triangle"; osc.frequency.value = note;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.3, now + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
      osc.connect(gain); gain.connect(musicGain); osc.start(now); osc.stop(now + 2.1);
      // niski dron (bas) - jeszcze slyszalny
      if (audio.index % 2 === 0) {
        const bass = context.createOscillator(); const bg = context.createGain();
        bass.type = "triangle"; bass.frequency.value = uscale[0] * 0.5;   // 55 Hz
        bg.gain.setValueAtTime(0.0001, now);
        bg.gain.exponentialRampToValueAtTime(0.2, now + 0.5);
        bg.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
        bass.connect(bg); bg.connect(musicGain); bass.start(now); bass.stop(now + 2.7);
      }
      // tajemniczy, odlegly poglos (kwinta wyzej, cicho)
      if (audio.index % 3 === 1) {
        const e = context.createOscillator(); const eg = context.createGain();
        e.type = "sine"; e.frequency.value = note * 1.5;
        eg.gain.setValueAtTime(0.0001, now + 0.5);
        eg.gain.exponentialRampToValueAtTime(0.09, now + 0.95);
        eg.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
        e.connect(eg); eg.connect(musicGain); e.start(now + 0.5); e.stop(now + 2.3);
      }
      audio.nextNote = now + 1.5;   // POWOLI
      audio.index += 1;
      return;
    }

    // NA SNIEGU/LODZIE: muzyka STRASZNA, CICHA, NISKA (bez wysokich tonow). Boss ma pierwszenstwo.
    const bossClose = state.boss && !state.boss.defeated && dist(state.player.x, state.player.y, state.boss.x, state.boss.y) < TILE * 26;
    if (state.area === "surface" && !bossClose && pointInRegion(state.player.x, state.player.y, state.snowSet)) {
      musicGain.gain.setTargetAtTime(0.85, context.currentTime, 0.8);   // glosniej (bylo za cicho)
      if (context.currentTime < audio.nextNote) return;
      // niskie, dysonansowe (tryton, mala sekunda); dluzsza fraza = wieksza roznorodnosc
      const sscale = [98, 110, 103.8, 130.8, 87.3, 116.5, 92.5, 146.8];
      const sphrase = [0, 2, 1, 4, 0, 3, 5, 1, 6, 2, 7, 3, 0, 4, 1, 5];
      const oct = audio.index % 7 === 0 ? 0.5 : 1;    // czasem nuta oktawe nizej (jeszcze grozniej)
      const note = sscale[sphrase[audio.index % sphrase.length] % sscale.length] * oct;
      const now = context.currentTime;
      // glowny niski ton - dlugi, zlowieszczy
      const osc = context.createOscillator(); const gain = context.createGain();
      osc.type = "sine"; osc.frequency.value = note;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.34, now + 0.6);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
      osc.connect(gain); gain.connect(musicGain); osc.start(now); osc.stop(now + 2.7);
      // dysonans tuz obok (mala sekunda wyzej) - buduje niepokoj
      if (audio.index % 2 === 0) {
        const d = context.createOscillator(); const dg = context.createGain();
        d.type = "sine"; d.frequency.value = note * 1.06;
        dg.gain.setValueAtTime(0.0001, now + 0.3);
        dg.gain.exponentialRampToValueAtTime(0.16, now + 0.9);
        dg.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
        d.connect(dg); dg.connect(musicGain); d.start(now + 0.3); d.stop(now + 2.5);
      }
      // bardzo niski, gluchy dron
      if (audio.index % 3 === 0) {
        const drone = context.createOscillator(); const drg = context.createGain();
        drone.type = "triangle"; drone.frequency.value = 49;
        drg.gain.setValueAtTime(0.0001, now);
        drg.gain.exponentialRampToValueAtTime(0.26, now + 0.8);
        drg.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
        drone.connect(drg); drg.connect(musicGain); drone.start(now); drone.stop(now + 3.3);
      }
      audio.nextNote = now + 1.8;   // wolno, sparsko
      audio.index += 1;
      return;
    }

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
