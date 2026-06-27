# Naturai rules

Ten plik jest listą reguł utrzymujących logikę gry. Reguły są zapisane jako stabilne
identyfikatory, żeby później można było je sprawdzać testami albo prostym walidatorem mapy.

Aktualna gra to **`game.js`** — rozgrywana na mapie z `map.json` (ładowanej przez
`map-data.js`, czyli `window.NATURAI_MAP_JSON`; plik buduje `build-map-data.py`,
uruchamiany w `index.html`). Poprzednia, ręcznie budowana wersja jest zachowana jako
`game_old.js` (referencja stylu graficznego i dźwięku).

Reguły z dopiskiem „(map)” wynikają z analizy struktury `map.json` albo dotyczą mechanik
dodanych w wersji mapowej.

## Wygląd i interfejs

- UI-001 (map): Gra startuje od **menu z panelem sterowania**; ENTER / Spacja / kliknięcie
  rozpoczyna rozgrywkę.
- UI-002 (map): Każdy element świata (bóbr, drzewa, wrogowie, NPC, przedmioty) mieści się
  w co najwyżej jednym kafelku.
- UI-003 (map): Renderowanie w stylu `game_old.js` (cieniowanie, paleta, poświaty), ale
  rysowane w skali kafelka.
- UI-004: **Pikseloza** — świat rysowany jest do MAŁEGO bufora (1 piksel bufora = `PIXEL_BLOCK`
  pikseli ekranu, domyślnie 2) i skalowany nearest-neighbour bez wygładzania → twarde,
  kwadratowe piksele (nie rozmazane). Przesunięcie kamery jest zaokrąglane do **całych pikseli
  bufora**, żeby siatka (trawa, kafelki) się nie rozjeżdżała. Tekst w świecie (np. nazwa
  zebranego intelu) rysowany jest **OSTRO** na ekranie (poza buforem) przez `worldToScreen`.
  HUD/menu/ekwipunek też są ostre. Tempo gry wolniejsze (`BASE_SPEED`), bez biegu. Drzewa
  **wypełniają cały kafelek** (kwadratowa korona) — nie widać pod nimi terenu.
- UI-005: Zwierzęta (kotki, pieski, pająki, motyle, gąsienice, NPC) **i sam bóbr-gracz nie
  rzucają cienia** ani nie mają nad sobą zielonej kropki/imienia; cień zostaje tylko pod
  maszynami, chatkami i drzewami. Zwierzęta na powierzchni mają **kończyny machające podczas
  ruchu**. NPC-bóbr wygląda **dokładnie jak gracz** (`drawBeaverBody`) i patrzy w jego stronę;
  pokazuje tylko „?", a podpowiedź rozmowy (`E`) idzie na dół ekranu (HUD).
- UI-006: HUD bez ramki/tła i bez odznak: **serca życia w lewym górnym rogu** (każde = 2 pkt;
  nadmiar ponad 100% na złoto), a **długość ogona w cm w prawym górnym rogu**. Brak licznika
  kwiatów, brak środkowego panelu i brak minimapy.
- UI-008: Oświetlenie (mgła podziemna, welon podwodny) rysowane jest **OSTRO na ekranie** po
  upscale pikselozy (gradient w niskiej rozdzielczości bufora glitchował).
- UI-007: `Escape` w trakcie gry otwiera **menu pauzy** ze sterowaniem (`Escape` wraca do gry,
  `R` zaczyna od nowa).

## Mapa, warstwy i kafelki

- MAP-001: Rozmiar świata pochodzi z `map.json` (`mapWidth` × `mapHeight`; obecnie 832×171).
- MAP-002: Pozycje kafelków z `map.json` są współrzędnymi siatki, nie pikselami; skalę
  dobieramy tak, aby okno pokazywało **dokładnie 15 rzędów wysokości i najwyżej 30 kolumn
  szerokości** (`TILE = 14 px`).
- MAP-003: Punkt startowy bobra pochodzi z warstwy `START` w `map.json` (pojedyncza kafelka).
  Jeśli akurat jest zablokowany, bierzemy najbliższą przechodnią kafelkę trawy/piasku.
- MAP-004 (map): Kolizja wynika z flagi `collider` warstwy w `map.json`. Warstwy
  `collider = true` blokują ruch, `collider = false` nie. To jest źródło prawdy o kolizjach.
- MAP-005 (map): Każda warstwa należy do dokładnie jednego świata: powierzchnia,
  podziemia (warstwy `Underground_*`) albo świat podwodny (`Deep_water_*` oraz
  `Underwater_intel`). Warstwa jest rysowana, kolizyjna i interaktywna tylko, gdy gracz
  jest w odpowiadającym jej świecie.
- MAP-010: Kabel pod ziemią (`Underground_wire`) jest obiektem interaktywnym do gryzienia
  i nie blokuje ruchu.
- MAP-011: Kwiat (`Flower`, `Water_flower`, `Underground_flower`, `Deep_water_flower`) jest
  zbieralny i nie blokuje ruchu.
- MAP-012: `Techno_final_boss` opisuje obszar bossa na mapie. Dopóki boss żyje, traktujemy
  go jako przeszkodę i źródło obrażeń.
- MAP-013 (map): `Techno_serwer_room` to podłoga serwerowni (nie blokuje), pokryta **szarą
  syntetyczną wykładziną** (splot nitek). Sąsiadujące kafelki tej warstwy tworzą pojedyncze
  serwerownie (klastrowanie); na wykładzinie stoją szafy serwerowe z diodami i rdzenie.
- MAP-017 (map): `Abandoned_cottage` to budynek **z lotu ptaka jako WNĘTRZE** (bez dachu): bale
  ścian (kolizja po obwodzie), podłoga z desek, łóżko, stół ze stołkami, dywanik, kominek, półka.
  Wejście to luka w ścianie. **REGUŁA: kafelek drzwi, kafelek wyjścia ORAZ wszystkie 8 kafelków
  otaczających każdy z nich są oczyszczane z drzew** (krzaków/śnieżek) — czyszczenie odbywa się
  **przed** postawieniem ścian, żeby ich nie skasować. Dzięki temu do każdej chatki da się wejść.
  Chatka pasywna (notatka jest już na mapie).
- MAP-019: Nora (wejście/wyjście) rysowana jest jako **kwadratowy** otwór (ramka ziemi + czarny
  kwadrat), spójnie z kafelkową estetyką. Wykładzina serwerowni rysowana jest **po terenie**
  (nad trawą), ale **pod ścianami** — inaczej trawa ją przykrywała.
- MAP-018 (map): Wygląd istot: duże zwierzęta na powierzchni to kotki/pieski (`Good/Bad_animal`),
  **`Good_small_animal` to motyle, `Bad_small_animal` to pająki**, podziemne zwierzęta to
  gąsienice (`Underground_*_animal`), NPC na powierzchni to bobry (`Beaver_NPC`), a podziemny
  NPC to kret (`Underground_NPC_mole`). Zwierzęta poruszają się **pionowo/poziomo** (kierunki
  kardynalne), nie po skosie „lotem". Każde zwierzę ma **inny wariant wyglądu** (`a.tint`/`tint2`):
  futra kotków/piesków z palety + rozmiar + łatki/paski, różne kolory skrzydeł motyli, korpusów
  pająków i gąsienic — nie wyglądają tak samo.
- MAP-014 (map): `Techno_infrastructure` i `Techno_defensive_wall` są stałymi ścianami
  (blokują). Wejście do serwerowni prowadzi przez przegryzialne drzwi (`Interactive_door`)
  lub drzwi elektryczne (`Interactive_electric_door`).
- MAP-015: Warstwy `Underground_*` są aktywne tylko pod ziemią; na powierzchni i pod wodą
  nie są rysowane, kolizyjne ani interaktywne.
- MAP-016: Warstwy powierzchniowe nie powinny działać pod ziemią ani pod wodą; warstwy
  podwodne nie działają na powierzchni ani pod ziemią.

## Ruch i kolizje

- MOVE-001: W trybie normalnym bóbr nie może przechodzić przez warstwy `collider = true`:
  ściany, drzewa, krzaki, śnieżki, infrastrukturę, zamknięte drzwi, aktywnego bossa, rdzenie
  serwerów ani niewidzialną granicę świata.
- MOVE-002: Kolizje rozwiązywane są osiowo (najpierw X, potem Y), żeby bóbr nie prześlizgiwał
  się przez narożniki.
- MOVE-003: Bóbr pozostaje w granicach świata nawet w trybie ducha.
- MOVE-006: Na **wodzie podziemnej** (`Underground_water`) bóbr także **pływa** (częściowe
  zanurzenie jak na powierzchni), nie tylko na wodzie powierzchniowej i podczas nurkowania.
- MOVE-004: Pod ziemią ruch jest ograniczony do tuneli (`Underground_path`, plus
  `Underground_water`). Pod wodą ruch jest ograniczony do obszaru głębokiej wody
  (`Deep_water`). Wszystko poza tymi obszarami jest czarne i nieprzejezdne.
  `Underground_water` rysowana jest **nad** podłogą tunelu (kafelki się pokrywają, więc
  kolejność rysowania to `Underground_path` → `Underground_water`).
- MOVE-005 (map): Wrogowie i zwierzęta są ograniczani tymi samymi przeszkodami co gracz
  (drzewa, ściany, infrastruktura, chatki) i nie wchodzą do wody; rekiny i delfiny pozostają
  w wodzie, a istoty podziemne/podwodne w swoim obszarze. Strzelcy strzelają tylko mając
  czystą linię strzału.

## Tryb ducha

- GHOST-001: Klawisz `G` przełącza tryb ducha (służy też do eksploracji i testów).
- GHOST-002: W trybie ducha gracz jest nieśmiertelny.
- GHOST-003: W trybie ducha gracz przenika przez wszystkie przeszkody i granice (z wyjątkiem
  krawędzi świata).
- GHOST-004: Tryb ducha nie usuwa przeszkód z mapy; tylko ignoruje je dla gracza.
- GHOST-005: Tryb ducha nie zbiera przedmiotów z dystansu, nie kończy walki automatycznie i
  nie pozwala nurkować; zmienia tylko ruch i odporność.

## Nurkowanie i głęboka woda (nowy element)

- DIVE-001: `Deep_water` to nowy typ terenu. Na powierzchni można po niej pływać; gdy gracz
  znajduje się w głębokiej wodzie, klawisz `F` pozwala zanurkować.
- DIVE-002: Nurkowanie jest podwodnym odpowiednikiem podziemi. Po zanurzeniu widać wyłącznie
  warstwy świata podwodnego (`Deep_water_flower`, `Deep_water_intel`, `Deep_water_shipwreck`,
  `Deep_water_fish`, `Underwater_intel`); reszta świata jest ciemna.
- DIVE-003: Pod wodą ruch ogranicza obszar głębokiej wody. Klawisz `F` wynurza gracza w tym
  samym miejscu (znów na powierzchni).
- DIVE-004: W trybie ducha nie można nurkować. Zanurzenie i zejście do nory rozpędza
  (czyści) towarzyszy.
- DIVE-005: Atakujące ryby (`Deep_water_fish`) ranią nurkującego gracza, tak jak rekiny na
  powierzchni.

## Interakcje

- ACT-001: Gryzienie (`W`) — **krótki zasięg ~1 kafelka**, zawsze trafia **NAJBLIŻSZY** cel
  przed pyskiem i **NIE działa przez ściany**. Bóbr **nie strzela nasionami**.
- ACT-001b: Atak obrotowy (`Q`) — bóbr **obraca się o 360°** i **uderza ogonem WSZYSTKICH
  dookoła** (wrogów, krzaki/drzewa/drzwi/kable, odsłonięte rdzenie, podatnego bossa). Zasięg
  zamachu **rośnie z długością ogona**; wolniejszy i nieco słabszy od gryzienia (cooldown).
- ACT-002: Interaktywne krzaki i drzewa (`Interactive_bush`, `Interactive_tree`,
  `Interactive_tree_with_snow`) mogą zostać przegryzione i po zniszczeniu przestają blokować ruch.
- ACT-003: Drzwi zwykłe (`Interactive_door`) mogą zostać przegryzione po utracie wytrzymałości.
- ACT-004: Drzwi elektryczne (`Interactive_electric_door`) są pod napięciem i nieprzebijalne,
  dopóki nie odetnie się zasilania ich serwerowni kablem pod ziemią (zob. CABLE-*). Pod
  napięciem **NIE rażą gracza** — kontakt z nimi pokazuje tylko informację, że najpierw
  trzeba wyłączyć zasilanie (przegryźć kabel). Po odcięciu prądu drzwi można przegryźć.
- ACT-005: Przegryzienie kabla pod ziemią wyłącza zasilanie powiązanej (najbliższej) serwerowni.
- ACT-006: Opuszczone chatki (`Abandoned_cottage`) są **pasywne** (brak interakcji `E`) — przy
  wejściu leży notatka, która zbiera się samoczynnie. NPC (`Beaver_NPC`, `Underground_NPC_mole`)
  rozmawiają na `E`; skrzynie (`Chest`) dają przedmioty na `E`.
- ACT-007 (map): Przejście między powierzchnią a podziemiami odbywa się przy **norach**
  (`Entrance_underground`, `Underground_exit`) klawiszem `E`. Nora wygląda **naturalnie**
  (kopczyk ziemi + ciemna dziura, nie „portal kosmiczny"). Przejście to **twarde cięcie** kamery
  (`snapCamera`) — bez ślizgania przez całą mapę.
- ACT-008 (map): **Ruch tylko strzałkami**; akcje na q/w/e/s/d/c, **`Shift` = bieg**.
  `W` gryzienie, `Q` atak obrotowy (ogon dookoła), `E` interakcja (nora/skrzynia/NPC),
  `S` chwyć/upuść drewno, `D` rzuć drewnem, `C` nurkowanie/wynurzenie. `Escape` = pauza,
  `I` ekwipunek, `M` dźwięk, `R` reset, `-` tryb ducha (ukryty). **`A`/karmienie usunięte;
  `Q` to teraz atak obrotowy (nie plucie nasionami).**
- ACT-009: Podchodząc do NPC gracz widzi podpowiedź klawisza rozmowy (`E`). Imię i wypowiedź
  każdego bobra/kreta są **wprost sparowane w kodzie** (`BEAVER_CAST`/`MOLE_CAST`) i przydzielane
  po kolei wg pojawienia się na mapie (1. bóbr = BORYS itd.) — łatwo skojarzyć, kto co mówi.
  W ekwipunku każdy `Intel`/notatka ma osobny tytuł i opis (lista + treść; strzałki wybierają).

## Dźwięk

- AUDIO-001 (map): Gra ma generatywną muzykę w tle — melodia gęstnieje w pobliżu data center
  i bossa — oraz efekty dźwiękowe. `M` wycisza/włącza dźwięk; audio startuje po pierwszym
  klawiszu/kliknięciu.
- AUDIO-002: **Pod ziemią gra osobna muzyka** — niskie tony, tajemnicza i powolna (długie nuty
  + bardzo niski dron + cichy pogłos kwintę wyżej), wyraźnie wolniejsza niż na powierzchni.

## Walka

- COMBAT-001: Gracz ma punkty życia. Gdy HP spada do zera w trybie normalnym, gra przechodzi
  w stan porażki.
- COMBAT-002: Obrażenia gracza są ignorowane w trybie ducha.
- COMBAT-003: Czas nietykalności po trafieniu zapobiega wielokrotnemu naliczeniu obrażeń w tej
  samej chwili (dotyczy też ognia i prądu).
- COMBAT-004: Przeciwnicy mogą zranić gracza kontaktem (`Bad_animal`, `Robot_easy`) albo
  pociskiem (`Robot_shooting`, `Robot_shooting_alot`, `Robot_drone_shooting`, boss).
- COMBAT-005: Pociski gracza i przeciwników nie powinny przechodzić przez stałe ściany ani
  poza dozwolony obszar (tunele/woda). Pociski przeciwników **lecą o 50% wolniej** (łatwiej je
  ominąć) — mają dłuższy czas życia, by zachować zasięg.
- COMBAT-006: Atak na rekina (`Water_attacking_fish`) karze gracza obrażeniami.
- COMBAT-007: Pociski przeciwników rysowane są jako **cienkie, podłużne strzały laserowe**
  wzdłuż kierunku lotu (rdzeń + poświata + jasny czubek).

## Serwery, kable, bramy i boss

- SERVER-001: Serwerownia ma podłogę, ściany, drzwi, strażników i **kilka rdzeni** — ich
  liczba jest **proporcjonalna do liczby kafelków** serwerowni (`~ tiles/30`, **zakres 1–10**),
  rozrzuconych po sali. Serwerownia pada, gdy zginą WSZYSTKIE jej rdzenie. Rdzenie stawiane są
  **tylko na kafelkach podłogi (nie-ściana)**, w miarę możliwości „wewnętrznych", a ich promień
  jest **mniejszy niż pół kafelka** — więc rdzeń mieści się w swoim kafelku i **nigdy nie znajduje
  się w ścianie ani jej nie przenika** (zgodność z fizyką).
- SERVER-002: Rdzenie są CHRONIONE (nie przyjmują obrażeń), dopóki serwerownia jest pod
  napięciem albo żyje choć jeden strażnik. Etykieta rdzenia pokazuje **ON** (chroniony) i
  zmienia się na **OFF** (podatny) po zabiciu wszystkich strażników / odcięciu prądu.
- SERVER-003: Zniszczenie rdzenia niszczy serwerownię i przywraca jej obszar naturze.
- SERVER-004: Zniszczona serwerownia może zostawić wpis/przedmiot.
- SERVER-005: Wszystkie serwerownie muszą zostać zniszczone, żeby boss stał się podatny na obrażenia.
- SERVER-006 (map): Zniszczenie serwerowni usuwa całą przypisaną do niej infrastrukturę
  (`Techno_infrastructure` / `Techno_defensive_wall`) — znika blokada otwierająca drogę dalej.
- GUARD-001 (map): Przeciwnicy techno (roboty/drony) strzegą swojej serwerowni i nie oddalają
  się od niej (leash); poza zasięgiem wracają do pokoju i nie ścigają gracza.
- CABLE-001 (map): Pod ziemią są dokładnie trzy kable (trzy klastry warstwy `Underground_wire`).
  Kabel **wymaga wielu ugryzień** (hp 6) — dopiero po przegryzieniu odcina prąd. Niszczalne
  obiekty są kluczowane **z uwzględnieniem świata** (`dkey`), bo kabel i drzwi elektryczne dzielą
  ten sam kafelek — inaczej kabel nadpisywał drzwi i robił w nich dziurę.
- CABLE-002 (map): Każdy kabel (`Underground_wire`) **dotyka na mapie drzwi elektrycznych**,
  które otwiera — dzięki temu nie ma wątpliwości, który kabel zasila które drzwi/serwerownię
  (powiązanie przez sąsiedztwo kafelków). Kabel bez drzwi zasila najbliższą wolną serwerownię.
  Jeden kabel = jedna serwerownia.
- CABLE-003 (map): Serwerownia pod napięciem ma nietykalny rdzeń i nieprzebijalne drzwi
  elektryczne; po odcięciu prądu rdzeń i drzwi tej serwerowni stają się podatne.
- BOSS-003: Pokonanie bossa przywraca świat, wyłącza wrogów i kończy główny konflikt. Boss jest
  nietykalny, dopóki działa choć jedna serwerownia.
- BOSS-004: Boss atakuje **często i w zróżnicowany sposób** — cykl wzorów: wachlarz celowany,
  pierścień dookoła, krzyż+X (8 kierunków), spirala. Po padnięciu wszystkich serwerowni (podatny)
  ataki są szybsze i gęstsze.

## Przedmioty i sprzymierzeńcy

- ITEM-001 (map): Kwiaty mają różne nazwy (stokrotka, mak, chaber…). Każdy zerwany **dodaje pół
  serca ZAWSZE** (życie może **przekroczyć 100%** — nadmiar widać jako złote serca) i powiększa
  ogon. Bez komunikatu tekstowego przy zbieraniu. `Water_flower` to lilie wodne. Kwiaty są
  **duże** (wypełniają kafelek) i **nieruchome**, podobnie jak leżące drewno.
- ITEM-004: Długi patyk (ze skrzyni) zwiększa zasięg gryzienia.
- ITEM-005: Złoty ząb (ze skrzyni) zwiększa obrażenia gryzienia.
- ITEM-006: Serce lasu (ze skrzyni) zwiększa maksymalne HP i leczy gracza.
- ITEM-007 (map): Skrzynie (`Chest`) są otwierane klawiszem `E` i dają jeden przedmiot
  (długi patyk / złoty ząb / serce lasu / tarcza).
- ITEM-008 (map): Dane i notatki (`Intel`, `Intel_note`, `Underground_intel`,
  `Underground_note`, `Underground_underwater_intel`, `Deep_water_intel`, `Underwater_intel`)
  są zbierane do ekwipunku (podgląd `I`). **Intel leżący w wodzie** (powierzchniowej lub
  podziemnej) jest widoczny tylko w **25%** (ledwo prześwituje spod wody).
- FRIEND-001: **USUNIĘTE** — nie ma karmienia zwierząt ani towarzyszy (klawisz `A` skasowany,
  cały system followerów wycięty). Przyjazne zwierzęta tylko łażą po świecie.

## Woda i zagrożenia

- WATER-001 (map): Rekiny (`Water_attacking_fish`) są **75% zanurzone** — nad wodą widać tylko
  **górę grzbietu i płetwę grzbietową** (reszta jako półprzezroczysty zarys pod wodą); **bez
  kółek „obecności"**. Gryzą pływającego gracza.
- WATER-002 (map): Delfiny (`Water_good_fish`) **wystają z wody TYLKO podczas wyskoku** (pełne
  ciało, łuk); poza tym płyną zanurzone (sam ciemny zarys), bez kółek. `Deep_water_fish` to
  ryby głębinowe.
- HAZARD-001 (map): Ogień (`Fire`) jest **kolizyjny** (nie da się w niego wejść) i **parzy z
  kontaktu** (gdy bóbr go dotknie; okno nietykalności ogranicza tempo obrażeń).
- LOD-001 (map): Po wejściu na lód (`Ice`) bóbr ślizga się w kierunku wejścia i nie może skręcać;
  zatrzymuje się dopiero po zjechaniu z lodu lub uderzeniu w ścianę.
- WOOD-001 (map): Rozgryzione **drzewo lub krzak** zostawia drewno; **drewno położone na mapie
  (`Wood`) to dokładnie to samo** chwytalne drewno (nie blokuje ruchu). Bóbr **nie zbiera go do
  plecaka** — może je tylko chwycić/upuścić (`S`) albo rzucić (`D`) jako mocny pocisk (nie
  przechodzi przez ściany). Niesie się najwyżej jeden kawałek; widać go przed pyskiem bobra.
- WATER-003: `Wooden_floor` to pomost rysowany **nad warstwą wody** — chodzi się po nim
  normalnie (nie pływa). Pływanie **nie spowalnia** bobra (ta sama prędkość co na lądzie).
- WATER-004: Zwierzęta wodne (rekiny, delfiny) są rysowane **większe o 150%** (`WATER_SPRITE =
  SPRITE*2.5`), z większym zasięgiem kontaktu; **bez kółek sugerujących obecność**.
- ITEM-009: Każdy zjedzony kwiat **wydłuża ogon bobra o 50% bardziej niż dawniej** (HUD: ~+4,5 cm
  na kwiat; rysunek ogona rośnie szybciej). Dłuższy ogon = większy zasięg ataku obrotowego (`Q`).
- MAP-018b: Podziemne gąsienice pełzną **po ziemi tunelu** (peristaltyczna fala, bez unoszenia
  się i bez cienia).
