# Závěrečná zpráva

Tento dokument shrnuje práci na prototypu hry vytvořeném v rámci NI-VGA.

## Herní mechaniky

V této části jsou detailně rozebrány hlavní herní mechaniky a systémy.

### Komponenta správy města

Každé město je tvořeno šestiúhelníkovou sítí parcel, na každé z nich může stát district (čtvrť) určitého typu, který poskytuje různé efekty, ať už obecně pro město/říši (produkce zdrojů, výcvik oddílu armády, ...), nebo pro ostatní districty (vyšší produkce, rychlejší stavba, ...).

Hráč zde mohou iniciovat výstavbu nových districtů.
K tomu potřebují "blueprint" (kartu) districtu, volnou parcelu, kam jej umístí, a zdroje pro výstavbu, které jsou uvedené na blueprintu.
Po zahájení je district ve stavbě po určitý počet časových jednotek (TU).
Po dokončení district začne poskytovat své efekty.

Každý district začíná na úrovni 1, typicky může být následně vylepšen.
Vylepšení trvá určitý počet TU a stojí určité množství zdrojů.
Během vylepšování district stále funguje identicky jako svá původní verze.
Cena, doba a efekt vylepšení je určena blueprintem (čímž vznikají rozdíly mezi i jinak podobnými districty), typicky roste s každou další úrovní.

Hlavním druhem jsou produkční districty, které průběžně tvoří zdroje pro hráčovo město.
Districty v sousedství se mohou navzájem ovlivňovat, tj. upravovat multiplikátor své produkce.

Zvláštním druhem districtu je vojenské cvičiště, které poskytuje armádní oddíl.
Jakmile je district postaven, hráči je k dispozici jeden oddíl typu určeného blueprintem (např. kasárna poskytne oddíl pěchoty).
Ten může být následně vyslán na výpravy mimo město.
Cvičiště mají místo vylepšení districtu možnost tréninku oddílu.
To probíhá v principu stejně jako vylepšení, ale výsledkem je zvýšení úrovně poskytovaného oddílu, což zlepší jeho bojové vlastnosti.
Maximální úroveň oddílu (počet možných tréninků) obecně není omezena, narozdíl od vylepšení districtů.

Na začátku má hráč dostupných 7 polí, jakákoli sousední jsou blokována a může je za určenou cenu odklidit.
Tím se odhalí další sousední pole k odklizení.

Rozšíření: do budoucna je plánovano rozšířit hru o "magické" districty, které budou sloužit jako research systém.
Po výstavbě hráči nabídnou zaplatit za stackovatelná magická vylepšení, která budou celkově vylepšovat hráčovo město.
Dále je v plánu dle potřeby herní komplexity přidat další mechanismy vzájemného ovlivnění districtů.

#### Systém obchodu

Hráč získává nové blueprinty nákupem v obchodu.
Ten průběžně generuje náhodné blueprinty k nákupu, vždy po 4.
Hráč jich může zakoupit libovolný počet, a poté zaplatit za vygenerování nové nabídky.

Systém je zatím jednoduchý, jelikož bude následně rozšířen v multiplayerové verzi.
Zde bude fungovat na principu sdíleného poolu blueprintů, kdy budou pro každou hru dostupné různé blueprinty v různém množství a mezi hráči tak bude fungovat nabídka a poptávka.

Dále budou v rámci herního balancingu rozděleny blueprinty do "tierů", kdy vyšší tiery budou dražší a stavět náročnější, ale silnější districty.
Postupem času hry se bude měnit skladba obchodu, co se týče podílu zastoupení tierů.

### Komponenta mapy světa

Hráč má k dispozici pohled s mapou světa.
V jeho středu se nachází hráčovo město, okolo něj se pak postupně generují cizí objekty, které může hráč dobýt svou armádou.
Po vybrání jednoho z nich lze na dané místo vyslat armádu, což trvá určitý počet TU v závislosti na vzdálenosti (ta se zobrazí po rozkliknutí bodu) a rychlosti nejpomalejší jednotky v armádě.
Jakmile armáda dorazí na místo, hráč může kliknutím spustit souboj.
Ten probíhá mezi hráčovým vojskem a obránci daného objektu, kteří jsou vidět předem opět po rozkliknutí.

V případě úspěchu hráč převezme kontrolu nad objektem (zatím bez dalšího efektu) a zároveň se mu vygenerují další sousedící místa.
V případě porážky je hráčovo vojsko vráceno zpět do domovského města.

Mapa je v této verzi reprezentována jako graf, který se postupně generuje a rozvětvuje směrem od středu, jak hráč obsazuje body na mapě.
Délky cest mezi body se generují náhodně a jednotky pak hledají nejkratší cestu pro přesun mezi dvěma body.

#### Soubojový systém

Hra disponuje připraveným tahovým systémem pro odehrání bojů mezi libovolnými armádami (soubory jednotek).
Boje probíhají automaticky, v UI ale může hráč postupně svým tempem krokovat souboj, aby se mohl přesvědčit o průběhu pomocí grafického stavu jednotek a logu akcí.

Obě armády se střídají v útočení, v rámci armády jednotky vykonávají své akce ve směru odpředu dozadu (v UI orientováno shora dolů).
Souboj končí, jakmile je jedna armáda zcela eliminována.

Každá jednotka má svém tahu specifikovaný počet akčních bodů, které spotřebuje. Zároveň má frontu akcí, které postupně cyklicky opakuje.
Tím je možné dynamicky tvořit různé chování jednotek - jeden útok za tah, mnoho útoků v jednom tahu, střídání útoků, "charge up" útoky, které se spustí po několika tazích čekání (viz příklady ve hře).

V rámci útoku je specifikované poškození, dosah a cílení útoku.
Možnosti cílení jsou:
- first: první (zepředu) nepřítel v dosahu
- last: poslední nepřítel v dosahu
- weak: nepřítel s nejméně HP v dosahu
- all: všichni nepřátelé v dosahu

Dosah specifikuje, přes kolik jiných jednotek může být útok veden.
Jednotky nablízko mají 1, a tedy musí být první v pořadí, aby mohly útočit.
Například pokud má jednotka dosah 4 a stojí na 3. pozici v armádě, dosáhne na první 2 nepřátelské jednotky.

Do cílených jednotek je uděleno poškození, které může být redukováno o fixní číslo i procentuálně v závislosti na atributech cíle.

V okně hráčovy armády je kromě náhledu možné přeskupit pořadí, v jakém budou jednotky v boji seřazené.

Jednotka má dále stanoveno, jaké atributy se vylepšují a o jaké hodnoty.
Dále je stanoven multiplikátor ceny vylepšení, tudíž je možné nastavit exponenciální nárůst cen, který kompenzuje fakt, že jednotky nemají pevnou maximální úroveň.

## Implementační detaily

V této části jsou uvedeny zajímavé implementační detaily.

### Použití Phaser

K tvorbě herního jádra byl použitý herní framework [Phaser](https://phaser.io/).
Jedná se o čistě JavaScriptový framework pro tvorbu 2D her, zároveň má i podporu TypeScript anotací, která byla v rámci projektu maximálně využita.
Phaser se v projektu stará o správu scén, vykreslení herních objektů do prohlížeče pomocí WebGL, příp. Canvas API, zpracování vstupů při klikání na herní objekty (hexy, mapové body) a dále o uložení herních dat, ke kterým pak přistupují scény a mohou tak vyměňovat informace.

Do budoucna je možné zároveň přes Phaser snímkově animovat herní sprity a přehrávat zvuky.
V projektu nebyl a pravděpodobně ani bude potřeba využít fyzikální systém v rámci frameworku, proto by bylo možné funkcionalitu Phaseru nahradit jednodušším `pixi.js`, což teď nebylo provedeno z časového hlediska.

#### Flow herních scén

Ve hře jsou aktuálně zavedeny 4 herní scény:
- BootScene: defaultní pseudo-scéna, která je zavedena při spuštění; stará se o inicializaci herního stavu, poté na pozadí spustí RunLoopScene a následně přepne na KingdomScene
- RunLoopScene: jednoduchá pseudo-scéna, která běží celou dobu na pozadí, a po uplynutí konfigurovatelného množství reálného času ve smyčce volá metodu `advanceTick`, která posouvá celý herní stav o 1 TU dopředu
- KingdomScene: první zobrazovaná scéna, renderuje hexgrid s městem, stará se o zpracování vstupů a komunikací s UI, volá odpovídající ECS systémy
- WorldMapScene: druhá zobrazovaná scéna, renderuje mapu světa a publikuje informací o ní do UI

Mezi Kingdom a WorldMap může hráč libovolně přepínat pomocí UI tlačítka nebo kláves 'M' pro vstup a 'Esc' pro opuštění mapy.

(viz zdroj: https://docs.phaser.io/phaser/concepts/scenes)

### Práce s hexagonální mřížkou

Pole hexagonální mřížky města jsou v rámci ECS spravovány jako entity.
Jejich pozice je dána souřadnicemi, pro implementaci byl zvolen "double-width" souřadnicový systém s pointy-top hex.
Ten při posunu v řádku mění první souřadnici (`q`) vždy o 2, zatímco při posunu ve sloupci mění druhou souřadnici (`r`) vždy o 1.
Řádky se sudým `r` mají i `q` vždy sudé a naopak.

Tento systém oproti prostému offsetu umožňuje elegantněji najít sousedy daného hexu.
Phaser kód pak zajišťuje tyto funkce i převod z hexových souřadnic na pixely na plátně v závislosti na konfigurovatelné velikosti hexu.

(viz zdroj: https://www.redblobgames.com/grids/hexagons/)

### Datový model districtů a jednotek

Definice districtů a jejich vojenských jednotek patří do složky `game/scenes/Kingdom/data/buildingDefs`.
Všechny objekty ze souborů v této složce se při startu hry dynamicky načítají do seznamu districtů a jednotek.
Stačí, když soubor exportuje pole `BUILDING_DEFS`, které načte komponenta `buildings.ts`.
Té se pak dotazují ostatní herní komponenty na seznamy dostupných districtů/jednotek, nebo získávají jejich atributy pomocí id.

Datový model definic districtů i jednotek je zaveden jako interfaces v témže souboru.
Je opatřen komentáři a spolu s připravenými příklady lze snadno pochopit význam atributů a vytvořit další případné prvky.

To umožňuje snadno rozšiřovat hru o další prvky bez nutnosti přímého zásahu do kódu.
Do budoucna by bylo možné tuto integraci ještě rozšířit, příp. připravit GUI pro modování hry bez nutnosti práce se zdrojovými soubory.

### Synchronizace hry a UI

Zatímco hra běží v rámci Phaser kódu a renderuje se v rámci DOM jako jeden WebGL/Canvas element, UI běží v oddělené vrstvě a vykresluje se pomocí komponentního frameworku Svelte jako standardní samostatné DOM komponenty nad herním plátnem.
Tento setup umožňuje tvořit UI standardními webovými techonologiemi (HTML + CSS vč. flexboxů, ...) a zároveň ho pomocí skriptů navázat na hru, která běží v rámci Phaser frameworku.

Díky tomu se uplatní silné stránky obou technologií: pixel-perfect renderování herních komponent do WebGL a zároveň pružné stylování UI pomocí CSS.
Jediným problémem, který je potřeba řešit, je synchronizace inputů a stavu mezi oběma částmi, jelikož se jedná o naprosto oddělené celky, které sdílí pouze použitý jazyk (TypeScript).

Proto byla vytvořena `eventBus` komponenta, která implementuje jednoduchý Publisher-Subsriber model pro oboustrannou výměnu zpráv mezi UI a hrou.
Ta definuje jednoduché formáty zpráv, které jsou opatřeny `type` labelem pro odlišení, který příjemce má zprávu zpracovat (jaký typ eventu to je).
Poté definuje metody pro připojení listenera ze strany hry i UI a metody pro odeslání zprávy na jednu i druhou stranu.

Ze strany UI poslouchají jednotlivé Svelte komponenty a na straně hry Phaser třídy scén, které na základě zpráv volají odpovídající systémy.
Veškerý stav je autorativně udržován na straně hry, UI pouze komunikuje vstupy a jsou mu zasílány aktuální snapshoty stavu, které UI maximálně udržuje v rámci cachování do další změny.

(viz zdroj: https://www.baeldung.com/cs/publisher-subscriber-model)

### Časová škála

Jak bylo zmíněno výše, postup herního stavu v závislosti na reálném čase je zajištěno čistě skrz metodu `advanceTick`, jejíž volání dle časové delty je prováděno pouze ve scéně RunLoop.
Jednou konstantou v `game/configuration.ts` je možné upravit interval těchto volání a tak změnit časovou škálu celé hry.
Toto slouží jako příprava pro budoucí nastavení škály v rukou hráču při multiplayerovém využití.
