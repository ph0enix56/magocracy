Vzhledem k vlastnostem Magocracy je p2p lockstep podstatně životaschopnější než p2p state replication, ale i tak bych ho pro cílovou verzi považoval za horší volbu než client-server s autoritativním serverem. Důvod není hlavně v tickingu nebo combatu, tam by lockstep naopak mohl fungovat dobře, ale v kombinaci skrytých informací, fázového řízení a potřeby mít jednoznačnou autoritu nad průběhem partie.

**Shrnutí**
Pro váš GDD jsou důležité tyto vlastnosti:
- hra není twitch real-time, ale spíš tahově-fázová s hrubými rozhodovacími okny,
- combat je deterministický,
- build tick může být deterministický,
- na začátku některých fází je potřeba autoritativně vygenerovat společné parametry,
- část informací má být skrytá nebo jen aproximovaná,
- reconnect a spectating nejsou teď klíčové.

Tohle dělá lockstep výrazně realističtější než u klasické RTS, ale pořád ne lepší než server-authoritative model.

**Kde by p2p lockstep naopak seděl dobře**
Lockstep je nejsilnější tam, kde:
- hráči posílají málo commandů,
- commandy jsou relativně hrubé,
- simulace je deterministická,
- všichni účastníci mohou znát celý stav,
- hra jde přirozeně po diskrétních krocích.

A přesně tady máte několik bodů, které lockstepu nahrávají:
- ve fázi pokroku hráči nedělají desítky akcí za sekundu, ale jednotky rozhodnutí za desítky sekund,
- ve fázi boje hráč jen nastaví formaci a vybere střetnutí,
- combat lze vyhodnotit čistě z formace a statistik,
- build ekonomika může být vyhodnocovaná po ticku, ne kontinuálně.

Čistě z hlediska síťové frekvence by lockstep mohl být velmi efektivní. Neposílaly by se snapshoty města každou chvíli, ale jen:
- výběry ve fázi pokroku,
- build/upgrade/train akce,
- případně tick commandy,
- výběr střetnutí a formace ve fázi boje.

Na papíře je to elegantní.

**Hlavní problém lockstepu pro Magocracy: skrytý stav**
Nejsilnější argument proti p2p lockstepu u téhle hry není latency, ale informace.

Podle GDD:
- cizí blueprinty hráči nevidí,
- přesné zdroje ostatních vidí jen odhadem,
- před PvP nevidí soupeřovu formaci,
- některé odměny a volby mají být individuální.

V čistém lockstepu musí každý klient simulovat celý stav, aby došel ke stejnému výsledku. To prakticky znamená, že každý klient musí mít:
- přesné resource counts všech hráčů,
- přesné blueprint inventory všech hráčů,
- přesný army stav a průběžné training/upgrading progresy,
- skrytá rozhodnutí ostatních, pokud mají ovlivnit budoucí simulaci.

To je v browserové hře zásadní problém. I kdybyste tyto hodnoty nezobrazili v UI, klient je bude mít v paměti a půjdou vyčíst. Tím se rozbije velká část informační asymetrie z designu.

Tohle je bod, kde client-server model vyhrává velmi výrazně:
- server drží plný stav,
- klient dostane jen to, co má vidět,
- skryté informace zůstanou skutečně skryté.

Pokud je pro vás utajení blueprintů, přesných resource counts a formací skutečná součást designu, čistý p2p lockstep je velmi špatný fit.

**Generování parametrů fází**
Uvádíš, že na začátku některých fází je potřeba autoritativně vygenerovat:
- balíčky ve fázi pokroku,
- párování hráčů a střetnutí ve fázi boje.

V client-server modelu je to jednoduché:
- server vygeneruje parametry,
- rozešle každému správný view,
- případně si nechá část údajů neveřejnou.

V p2p lockstepu jsou v zásadě tři možnosti:
1. všichni klienti si parametry dopočítají ze shared seeda,
2. jeden peer je vygeneruje a ostatní mu věří,
3. použijete commit-reveal nebo jiný distribuovaný random protokol.

První možnost je jednoduchá jen tehdy, když všichni smí znát všechno.
Druhá možnost už je de facto host-authoritative model.
Třetí možnost je technicky zbytečně drahá vůči tomu, co řešíte.

U Magocracy tedy lockstep naráží už na samotném startu každé významné fáze.

**Combat fáze**
Combat je z obou modelů asi nejméně problematická část, protože píšeš, že bude plně deterministický. To znamená:
- client-server: server spočítá výsledek a rozešle log/snapshot,
- lockstep: klienti si vymění formace a lokálně dopočítají stejný výsledek.

Z hlediska čisté výpočetní logiky je lockstep v combat fázi reálně použitelný.

Ale i tady zůstávají dva rozdíly:
- V client-server modelu lze snadno udržet skrytou formaci do momentu uzávěrky.
- V lockstepu musíš pečlivě řešit, kdy je formace odhalena a jak zabránit tomu, aby klient reagoval na soupeřovo rozhodnutí až po jeho odeslání.

To znamená, že bys téměř jistě potřeboval commit/lock-in mechaniku:
- hráč nejdřív odešle hash svého rozhodnutí,
- po uzávěrce odhalí skutečný obsah,
- ostatní ověří shodu.

To je implementačně zvládnutelné, ale už je to další distribuovaná složitost, kterou server řeší přirozeně.

**Fáze pokroku**
Tady lockstep také technicky jde, ale jen pokud rozhodnutí a dostupné volby nejsou tajné.

Potíže:
- pořadí picků je důležité,
- parametry nabídky jsou sdílený herní stav,
- výběr jednoho hráče mění nabídku pro ostatní,
- může existovat hidden-state aspekt v tom, kdo co získal.

V lockstepu by to šlo jako sekvence:
- všichni se shodnou na seedovaně vygenerované nabídce,
- aktivní hráč odešle pick,
- všichni aplikují pick,
- přejde se na dalšího hráče.

To není těžké. Ale znovu: pokud některé výsledky nemají být plně veřejné, lockstep je problém.

**Build fáze a otázka tickingu**
Tady je srovnání nejzajímavější.

Pokud zvolíš automatický globální tick každých $x$ sekund:
- client-server: server drží oficiální tick counter a vyhodnocuje produkci/progress,
- lockstep: všichni klienti musí přesně souhlasit, kdy nastal tick a jaké commandy do něj spadly.

To je možné, ale musíš vyřešit:
- okna pro příjem commandů,
- jednotné pořadí commandů v rámci ticku,
- zpožděné pakety,
- případné pause/timeout chování.

Pořád realizovatelné, ale přidává to synchronizační režii.

Pokud zvolíš ruční tickování v rámci build fáze:
- hráč má třeba 10 ticků na 3 minuty,
- může dlouho plánovat a pak tickovat po blocích.

To je herně zajímavé, ale síťově je to mnohem přirozenější pro client-server než pro lockstep.

Důvod:
- už to není čistý globální synchronní clock,
- jednotliví hráči mohou posouvat své město různým tempem,
- ostatní do toho mohou jen nahlížet,
- ale skutečný stav každého města se v čase mění individuálně.

V client-server modelu je to snadné:
- server drží per-player tick budget a aktuální stav města,
- klient pošle `advance build tick` nebo dávku ticků,
- server stav posune a vrátí nový snapshot.

V lockstepu bys buď:
- replikoval plný stav všech měst na všech klientech,
- nebo zavedl lokálně téměř nezávislé sub-simulace, což už přestává být čistý lockstep.

Jinak řečeno: ruční tickování je pro lockstep spíš zhoršení než zlepšení, protože rozbíjí jednoduchý model „všichni aplikují stejný tick ve stejnou chvíli“.

**Složitost implementace**
Pro Magocracy bych ji odhadl takto:

Client-server:
- vyšší backend práce,
- nižší distribuovaná složitost,
- jasná autorita,
- přirozené místo pro phase manager, validaci a hidden info.

P2P lockstep:
- nižší backend,
- vyšší síťově-protokolová složitost,
- nutnost velmi přísné determinističnosti,
- problém se skrytými informacemi,
- potřeba řešit commit/reveal, ordering a desync detection.

Na malé hobby prototypy je lockstep často lákavý, ale jen pokud je hra:
- plně deterministická,
- bez hidden info,
- s minimálním anti-cheat požadavkem,
- a bez velké potřeby autoritativního phase managementu.

Magocracy nesplňuje minimálně dva z těchto bodů: hidden info a potřebu centrálně řídit fáze.

**Ověřování stavu a desync**
V lockstepu není hlavní otázka „jak přenést méně dat“, ale „jak poznat, že se simulace nerozjela“.

Musel bys řešit:
- canonical ordering commandů,
- stavové hashe po ticku nebo po každé významné události,
- recovery při neshodě,
- případně resync mechanismus.

To je práce navíc, která v client-server modelu prakticky mizí, protože klient nic autoritativně nepočítá. Pokud se klient rozjede, server snapshot ho vrátí do reality.

U lockstepu je každý desync problém celé partie.

**Cheat a férovost**
I kdybys přijal, že anti-cheat není prvořadý cíl, lockstep u browserové hry stále otevírá:
- čtení hidden state z klienta,
- modifikaci lokální simulace,
- pozdní reakce na odhalené informace, pokud commit flow není neprůstřelný,
- denial-style problémy, kdy peer zdržuje potvrzení kroku.

Client-server tohle zásadně omezuje, i když nevyřeší všechno.

**Celkové doporučení vzhledem k tvým parametrům**
Kdyby Magocracy byla:
- plně veřejná hra bez hidden info,
- s čistě synchronním společným tickem,
- bez potřeby autoritativního generování parametrů,
- bez budoucí potřeby reconnectu a bez větších obav z cheatingu,

pak by p2p lockstep byl reálně silný kandidát.

Ale vzhledem k tomu, co popisuje GDD a tvoje doplnění, bych vhodnost viděl takto:

Client-server:
- velmi vhodný jako cílový model
- nejlepší pro hidden info, phase orchestration, pairing, rewards a budoucí rozvoj

P2P lockstep:
- technicky možný
- zajímavý pro experiment nebo velmi úspornou variantu
- nevhodný, pokud chceš zachovat skutečně skryté informace a čistou autoritu nad fázemi

Nejsilnější verdikt je tento: determinismus sám o sobě ještě neznamená, že lockstep je správná volba. U vás je rozhodující spíš to, že hra má centrálně řízené fáze a částečně neveřejný stav. To jsou přesně vlastnosti, které tlačí návrh zpět k autoritativnímu serveru.

Pokud chceš, další užitečný krok je jeden z těchto:
1. rozebrat konkrétně, jak by vypadal phase manager v client-server modelu pro `progress -> build -> combat`,
2. nebo udělat tabulkové srovnání client-server vs lockstep po jednotlivých mechanikách z GDD.