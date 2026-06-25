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

## Mapa, warstwy i kafelki

- MAP-001: Rozmiar świata pochodzi z `map.json` (`mapWidth` × `mapHeight`; obecnie 832×171).
- MAP-002: Pozycje kafelków z `map.json` są współrzędnymi siatki, nie pikselami; skalę
  dobieramy tak, aby okno pokazywało **dokładnie 15 rzędów wysokości i najwyżej 30 kolumn
  szerokości** (`TILE = 14 px`).
- MAP-003: W `map.json` nie ma warstwy `START`. Punkt startowy bobra to najbliższa
  przechodnia kafelka trawy/piasku w lewej części świata (ojczyzna bobra). W `game.js`
  start jest stałym punktem w kodzie.
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
- MAP-013 (map): `Techno_serwer_room` to podłoga serwerowni (nie blokuje). Sąsiadujące
  kafelki tej warstwy tworzą pojedyncze serwerownie (klastrowanie sąsiedztwa). Serwerownia
  jest „wyposażona": szafy serwerowe z migającymi diodami, kratka podłogowa, świecący rdzeń.
- MAP-017 (map): `Abandoned_cottage` to budynek widziany **z lotu ptaka** — widać dach z
  kalenicą, kominem i świetlikiem; obwód klastra to ściany (kolizja), na dole wejście, wpis (E).
- MAP-018 (map): Wygląd istot: zwierzęta na powierzchni to kotki i pieski (`Good/Bad_animal`,
  `Good/Bad_small_animal`), podziemne zwierzęta to gąsienice (`Underground_*_animal`), NPC na
  powierzchni to bobry (`Beaver_NPC`), a podziemny NPC to kret (`Underground_NPC_mole`).
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
- MOVE-004: Pod ziemią ruch jest ograniczony do tuneli (`Underground_path`, plus
  `Underground_water`). Pod wodą ruch jest ograniczony do obszaru głębokiej wody
  (`Deep_water`). Wszystko poza tymi obszarami jest czarne i nieprzejezdne.
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

- ACT-001: Gryzienie (`Spacja`) działa przed bobrem, w kierunku patrzenia gracza.
- ACT-002: Interaktywne krzaki i drzewa (`Interactive_bush`, `Interactive_tree`,
  `Interactive_tree_with_snow`) mogą zostać przegryzione i po zniszczeniu przestają blokować ruch.
- ACT-003: Drzwi zwykłe (`Interactive_door`) mogą zostać przegryzione po utracie wytrzymałości.
- ACT-004: Drzwi elektryczne (`Interactive_electric_door`) są pod napięciem i nieprzebijalne,
  dopóki nie odetnie się zasilania ich serwerowni kablem pod ziemią (zob. CABLE-*). Pod
  napięciem rażą gracza prądem.
- ACT-005: Przegryzienie kabla pod ziemią wyłącza zasilanie powiązanej (najbliższej) serwerowni.
- ACT-006: Opuszczone chatki (`Abandoned_cottage`) i NPC (`Beaver_NPC`, `Underground_NPC_mole`)
  są źródłem wpisów fabularnych; skrzynie (`Chest`) dają przedmioty. Interakcja klawiszem `E`.
- ACT-007 (map): Przejście między powierzchnią a podziemiami odbywa się przy portalach
  (`Entrance_underground` na górze, `Underground_exit` na dole) klawiszem `E`.
- ACT-008 (map): Sterowanie pomocnicze — `F` nurkowanie/wynurzenie, `L` nakarm zwierzę,
  `Q` plucie nasionami, `I` ekwipunek, `Shift`/`B` bieg, `M` wycisz dźwięk, `R` reset.

## Dźwięk

- AUDIO-001 (map): Gra ma generatywną muzykę w tle (jak `game_old.js`) — melodia gęstnieje
  w pobliżu data center i bossa — oraz efekty dźwiękowe (gryzienie, trafienia, zbieranie,
  zniszczenie rdzenia, zwycięstwo). `M` wycisza/włącza dźwięk. Audio startuje po pierwszym
  klawiszu/kliknięciu (wymóg przeglądarek).

## Walka

- COMBAT-001: Gracz ma punkty życia. Gdy HP spada do zera w trybie normalnym, gra przechodzi
  w stan porażki.
- COMBAT-002: Obrażenia gracza są ignorowane w trybie ducha.
- COMBAT-003: Czas nietykalności po trafieniu zapobiega wielokrotnemu naliczeniu obrażeń w tej
  samej chwili (dotyczy też ognia i prądu).
- COMBAT-004: Przeciwnicy mogą zranić gracza kontaktem (`Bad_animal`, `Robot_easy`) albo
  pociskiem (`Robot_shooting`, `Robot_shooting_alot`, `Robot_drone_shooting`, boss).
- COMBAT-005: Pociski gracza i przeciwników nie powinny przechodzić przez stałe ściany ani
  poza dozwolony obszar (tunele/woda).
- COMBAT-006: Atak na rekina (`Water_attacking_fish`) karze gracza obrażeniami.
- COMBAT-007 (map): Po zebraniu kwiatów bóbr może pluć nasionami (`Q`) — atak dystansowy.

## Serwery, kable, bramy i boss

- SERVER-001: Serwerownia ma podłogę, ściany, drzwi, strażników i rdzeń.
- SERVER-002: Rdzeń serwerowni nie przyjmuje skutecznych obrażeń, dopóki żyją jej strażnicy
  (roboty/zwierzęta przypisane do pokoju).
- SERVER-003: Zniszczenie rdzenia niszczy serwerownię i przywraca jej obszar naturze.
- SERVER-004: Zniszczona serwerownia może zostawić wpis/przedmiot.
- SERVER-005: Wszystkie serwerownie muszą zostać zniszczone, żeby boss stał się podatny na obrażenia.
- SERVER-006 (map): Zniszczenie serwerowni usuwa całą przypisaną do niej infrastrukturę
  (`Techno_infrastructure` / `Techno_defensive_wall`) — znika blokada otwierająca drogę dalej.
- GUARD-001 (map): Przeciwnicy techno (roboty/drony) strzegą swojej serwerowni i nie oddalają
  się od niej (leash); poza zasięgiem wracają do pokoju i nie ścigają gracza.
- CABLE-001 (map): Pod ziemią są dokładnie trzy kable (trzy klastry warstwy `Underground_wire`).
- CABLE-002 (map): Przegryzienie kabla odcina prąd TYLKO w najbliższej serwerowni
  (najmniejsza odległość centroidu kabla do centroidu serwerowni). Jeden kabel = jedna serwerownia.
- CABLE-003 (map): Serwerownia pod napięciem ma nietykalny rdzeń i nieprzebijalne drzwi
  elektryczne; po odcięciu prądu rdzeń i drzwi tej serwerowni stają się podatne.
- BOSS-003: Pokonanie bossa przywraca świat, wyłącza wrogów i kończy główny konflikt. Boss jest
  nietykalny, dopóki działa choć jedna serwerownia.

## Przedmioty i sprzymierzeńcy

- ITEM-001 (map): Kwiaty mają różne nazwy (stokrotka, mak, chaber…) i każdy leczy o pół życia;
  zebranie któregokolwiek odblokowuje plucie nasionami (`Q`). `Water_flower` to lilie wodne.
- ITEM-004: Długi patyk (ze skrzyni) zwiększa zasięg gryzienia.
- ITEM-005: Złoty ząb (ze skrzyni) zwiększa obrażenia gryzienia.
- ITEM-006: Serce lasu (ze skrzyni) zwiększa maksymalne HP i leczy gracza.
- ITEM-007 (map): Skrzynie (`Chest`) są otwierane klawiszem `E` i dają jeden przedmiot
  (długi patyk / złoty ząb / serce lasu / tarcza).
- ITEM-008 (map): Dane i notatki (`Intel`, `Intel_note`, `Underground_intel`,
  `Underground_note`, `Underground_underwater_intel`, `Deep_water_intel`, `Underwater_intel`)
  są zbierane do ekwipunku (podgląd `I`).
- FRIEND-001: Nakarmione zwierzę (`Good_animal`, `Good_small_animal`, `Underground_good_animal`)
  idzie za bobrem przez ograniczony czas (`L`); ucieka, gdy bóbr nurkuje lub schodzi do nory.

## Woda i zagrożenia

- WATER-001 (map): Rekiny (`Water_attacking_fish`) są zanurzone — widać tylko płetwę i ciemny
  zarys; gryzą pływającego gracza.
- WATER-002 (map): Delfiny (`Water_good_fish`) są nieszkodliwe i widoczne tylko gdy okresowo
  wyskakują łukiem nad wodę; poza tym widać samą zmarszczkę. `Deep_water_fish` to ryby głębinowe.
- HAZARD-001 (map): Ogień (`Fire`) jest przechodni, ale parzy gracza co tyk okna nietykalności.
- LOD-001 (map): Po wejściu na lód (`Ice`) bóbr ślizga się w kierunku wejścia i nie może skręcać;
  zatrzymuje się dopiero po zjechaniu z lodu lub uderzeniu w ścianę.
- WOOD-001 (map): Rozgryziony krzak zostawia drewno; gracz je podnosi (wchodząc na nie) i rzuca
  klawiszem `K` jako mocny pocisk (nie przechodzi przez ściany).
