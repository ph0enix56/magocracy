# Game design document

# Executive summary

Magocracy je multiplayer real-time strategická hra pro uzavřené lobby 2-8 hráčů. Každý z nich spravuje magické město složené z šestiúhelníkové mřížky, do které strategicky staví čtvrti, které poskytují různé zdroje, jednotky, či bonusy tak, aby se sousední čtvrti navzájem co nejvýhodněji ovlivňovali. Vybudovanou ekonomiku pak hráč přetaví do armády, která úspěšným soubojem získá věhlas potřebný k vítězství nad ostatními. Magocracy je real-time, ale postupuje v diskrétních časových jednotkách, jejichž délku v reálném čase, stejně jako další prvky, lze plně nastavit. Hra staví na deskových hrách založených na umisťování dílků a alokaci zdrojů, a ty kombinuje se zápasy v auto-battler formátu.

### Herní smyčka

Partie hry probíhá v opakujících se epochách, které se skládají z těchto fází:

- fáze pokroku: jsou zpřístupněny nové stavby a hráči si z nabídky rozdělí balíčky, kterými rozvinou svá města: rozšíří hranice a získají blueprinty čtvrtí
- fáze budování: hráči se věnují vládě nad svým městem - sledují produkci zdrojů, blueprinty využijí na stavbu nových čtvrtí, vylepšují stávající čtvrti a cvičí armádní jednotky a čerpají magické schopnosti; mimo to kontrolují postup ostatních hráčů
- fáze boje: hráči sestaví své formace a vyšlou armádu do boje, aby si zajistili věhlas - v závislosti na konfiguraci bojují hráči proti sobě navzájem nebo proti generovaným hrozbám

Hra se takto opakuje, dokud některý z hráčů nenasbírá potřebný počet bodů věhlasu, aby se stal vítězem hry. Podle nich je pak sestaveno celkové pořadí.

### Klíčové vlastnosti

- city/engine builder: hráč během celé partie rozvíjí své jedno dokonalé město - Magocracy, na rozdíl od klasických RTS, nezná destrukci ani rychlé stavění budov za účelem záboru území na mapě; každý si pečlivě plánuje své město, a pak sklízí odměny na základě výsledků jeho armády
- kombinační stavění: města se skládají z mnoha čtvrtí - každá z nich je sama o sobě jednoduchá, ale celkový počet vazeb mezi nimi rychle narůstá; kdo vymyslí nejlépe funkční strategii na základě kreativního kombinování efektů, zvítězí
- konfigurovatelnost: parametry partie Magocracy jsou flexibilní - hráči si tak mohou zvolit, jakým způsobem chtějí hrát; mnoho parametrů pro generování herních prvků lze při tvorbě partie přenastavit, stejně jako trvání fází v reálném čase, čímž je zajištěno, že hra bude trvat dobu, na které se hráči předem dohodnou

### Cílová platforma a skupina

Platforma: moderní webový prohlížeč s podporou WebGL/Canvas

Publikum: hráč, který rád strategizuje a líbí se mu hry s inkrementálním postupem; díky dostupné platformě a jednoduchému ovládání pomocí dialogů vhodné i pro hráče bez předchozích zkušeností s videohrami

# Mechaniky

## Komponenty hry

Každý hráč během hry hospodaří s jedním městem a jemu příslušnou armádou. K tomu slouží komponenty popsané v následující sekci.

### Mřížka čtvrtí

Samotné město hráče tvoří čtvrti umístěné do pravidelné šestiúhelníkové mřížky. Každá čtvrť tak má nejvýše 6 sousedů a poskytuje městu určité funkce:

- produkční: čtvrť poskytne obnos zdroje nebo zdrojů, pravidelně každou časovou jednotku, nebo trvale v případě jídla; míra produkce může být implicitně ovlivněna okolními čtvrti města
- armádní: čtvrť “ubytovává” armádní oddíl; po vystavění přidá oddíl do hráčovy armády, za stanovenou cenu umožňuje oddíl cvičit, čímž zvýší jeho úroveň a bojové vlastnosti - maximální úroveň výcviku není omezena, každý další výcvik ale stojí násobně více zdrojů
- vliv na okolí: čtvrť může ovlivnit okolní čtvrti následujícími způsoby:
    - změna míry produkce zdrojů (aplikované u produkčních)
    - změna bojových vlastností ubytovaného oddílu, změna ceny cvičení (aplikované u armádních)
- jednorázový bonus: po výstavbě čtvrť hráči přidá obnos určeného zdroje nebo blueprinty

Jedna čtvrť může kombinovat několik těchto funkcí najednou, např.:

**Povrchový důl.** Produkuje 8 kamene/TU; míra produkce sousedních čtvrtí -30 %.

**Statek.** Produkuje 1 jídlo; ubytovává jednotku *Rolník*; sousední bojové jednotky získají +15 HP.

**Magická fontána.** Jednorázově přidá 10 many; sousední čtvrti produkce +5 %, cena cvičení -5 %.

Některé čtvrti mohou mít definovaná vylepšení, která typicky zvyšují poskytované efekty. Armádní čtvrti vylepšení typicky nemají, tuto možnost nahrazuje výcvik jejich oddílu.

Čtvrti jsou kategorizovány do škol magie, jako např. *Sylvan*, *Geomancy*, *Pyromancy*, *Hydromancy* a další. Všechny školy by měly obsahovat podobný poměr produkčních/armádních/podporujících čtvrtí, každá škola by ovšem měla být charakteristická z hlediska produkce a spotřeby zdrojů, způsobu, jakým se navzájem čtvrti ovlivňují a povahy armádních oddílů, které produkují. Například Sylvan čtvrti produkují a z většiny stojí dřevo, často mají bonusy za volná místa okolo sebe a poskytované armádní oddíly jsou především lučištníci s velkým dosahem a malou odolností.

### Zdroje

Hráči náleží zásoba několika druhů zdrojů, kterou hráč doplňuje především produkcí a bonusy čtvrtí. Ty se používají primárně na tyto účely:

- **dřevo** a **kámen**: stavba a vylepšení čtvrtí města
- **mana:** nákup blueprintů čtvrtí, čtvrti s magickými oddíly, další zvláštní schopnosti
- **jídlo:** na rozdíl od ostatních nefunguje jako zásoba, ze které hráč platí, ale okamžitý rozdíl výroba-spotřeba; např. pokud aktuálně produkuji +6 jídla a 3 spotřebovávám, mohu postavit čtvrť se spotřebou 3, nebo dvě se spotřebami 1 a 2, nikoliv ale čtvrť se spotřebou 4 jídla; armádní čtvrti spotřebovávají jídlo

### Blueprinty

Hráč má v rámci správy města také zásobu aktuálně držených blueprintů čtvrtí. Jedná se o kartu opravňující k výstavbě čtvrti města, kterou zobrazuje. Graficky jsou na kartě zobrazeny požadované zdroje a čas pro výstavbu, spolu s efekty čtvrti, pokud je postavena. Po použití je spotřebována a hráč tak musí blueprinty průběžně doplňovat, pokud chce stavět nové čtvrti.

Blueprinty, resp. i samotné čtvrti, se dělí do stupňů. Blueprinty vyššího stupně jsou typicky dražší, nicméně vzniklé čtvrti nabízejí silnější efekty či oddíly. V průběhu hry se průběžně zvyšují šance získat blueprinty vyšších stupňů, postupem času se naopak zmenšuje podíl nabízených blueprintů nižších stupňů, a to jak při nákupu, tak získání ve fázích pokroku a boje jako odměna.

Při nákupu blueprintů se losuje ze seznamu běžně dostupných blueprintů, naopak jako odměny v ostatních fázích mohou být nabízeny i speciální blueprinty.

### Armáda

Každá armádní čtvrť poskytuje jeden oddíl do společné armády města. Armáda se využívá ve fázi boje.

### Body věhlasu

Hráči tyto body získávají úspěšným bojem. Fungují jako vítězné body - jakmile některý z hráčů dosáhne potřebné bodové hranice, hra končí a výsledné pořadí se určí na základě počtu bodů věhlasu. Hráči mohou kdykoli vidět průběžné počty bodů věhlasu všech hráčů.

## Fáze hry

Jak bylo popsáno v sekci herní smyčka, hra probíhá v opakujících se “epochách”. Každá epocha se skládá ze 3 fází, které jsou popsány níže. Epocha končí fází boje, po které se vyhodnotí počty bodů věhlasu, dle čehož nastává další epocha, nebo hra končí.

### Fáze pokroku

V této fázi si hráči rozeberou “listiny”, které jejich městům přidávají bonusy - typicky obnos zdrojů, konkrétní blueprinty a právo rozšířit hranice města. Rozšířením hranic města se rozumí přidání dalšího místa (hexu) do mřížky vedle již existujícího. Dalším možným bonusem jsou např. plošné vylepšení jednotek a další zvláštní efekty. Každá listina představuje balíček, který typicky kombinuje několik těchto prvků, tedy např. rozšíření města o 1 pole + 100 dřeva a kamene, nebo 2 blueprinty stupně 1 a 1 blueprint stupně 2, ale žádné rozšíření ani zdroje.

Listiny se generují náhodně, v pozdějších epochách obsahují silnější efekty, aby odpovídaly stavu hry, přičemž je kladen důraz na to, aby byly všechny balíčky vždy srovnatelné v hodnotě.

Hráči listiny vybírají postupně a každou listinu může vzít pouze jeden hráč, přičemž pořadí výběru je od hráče s nejmenším počtem bodů věhlasu k tomu s nejvíce body. Momentálně slabší hráči tak mají větší možnost volby, která jim může pomoci vrátit se zpět do hry. Počet listin k výběru odpovídá počtu hráčů a několika navíc, aby i poslední hráč měl nějakou volbu.

Zvláštním případem této fáze je začátek hry, kdy tento výběr probíhá dvakrát - nejprve hráči volí “zakládací” listinu, následně počáteční obnos zdrojů. Dostupné zakládací listiny nejsou úplně náhodné, ale vylosované z předem definovaného seznamu, a vždy obsahují blueprint s “centrem města” - počáteční čtvrtí, kterou hráč zdarma ihned umístí do své prázdné mřížky. Tyto centra poskytují různé efekty tak, aby vedly k diverzifikování hráčských strategií hned od počátku hry.

Jelikož na začátku mají všichni hráči 0 věhlasu, pořadí výběru je určeno náhodně. Po výběru zakládací listiny ale nastává výběr počátečních zdrojů (náhodně generovaných v ekvivalentní celkové hodnotě), kde je pořadí výběru opačné předchozímu. Například hráč, který vybírá listinu jako první, bude vybírat zdroje až jako poslední.

### Fáze budování

Jedná se o hlavní fázi hry, kdy hráč rozhoduje o tom, jak ve městě investovat zdroje a co nejlépe ho rozšířit. Po dobu fáze hráč vidí všechny komponenty města popsané v předchozí sekci - postavené čtvrti, zdroje, blueprinty a armádu. Během této fáze může hráč:

- zahájit stavbu nové čtvrti: hráč určí volné místo (hex) ve městě, zvolí vlastněný blueprint a zaplatí zdroje příslušné pro výstavbu dané čtvrti; tím se vytvoří na tomto místě rozestavěná čtvrť
- zahájit vylepšení čtvrti: hráč zvolí postavenou čtvrť a zaplatí příslušné zdroje (vylepšení nevyžaduje blueprint); čtvrť se začne vylepšovat, před dokončením vylepšení se stále chová jako původní čtvrť
- demolice čtvrti: hráč může určit místo (hex) s postavenou čtvrtí a nechat ji zničit - proces je okamžitý, místo se uvolní, hráč ale nedostane zpět žádné investované zdroje ani blueprint
- výcvik armády: hráč vybere armádní oddíl a zaplatí příslušné zdroje; oddíl se začne cvičit, před dokončením výcviku má stále původní úroveň
- nákup blueprintů: hráči je během fáze dostupná nabídka několika náhodných blueprintů ke koupi, každý blueprint stojí stanovený počet many; hráč může zároveň za fixní počet many vylosovat novou nabídku - v ní by měly být garantované čtvrti různých rolí (produkční, armádní)
- sledování hráčů: hráč může nahlédnout i do měst ostatních hráčů; vidí mřížku čtvrtí, dostupné zdroje pouze odhadem (přibližné počty), cizí blueprinty hráči nevidí, úrovně a přesné vlastnosti armády hráči vidí až při střetu ve fázi boje
6
Během fáze budování navíc ve městě “plyne čas” - za fázi uběhne v pravidelném tempu daný počet časových jednotek (time units - TU). Po každé uplynuté TU hra přidá hráčům zdroje podle součtu jejich produkčních čtvrtí a posune postup stavby/vylepšení čtvrtí a výcviku oddílů. V případě dokončení některé z těchto akcí hra vyhodnotí příslušné efekty.

Na konci fáze budování je čas zastavený, rozestavěné čtvrti jsou nedokončené, vylepšované čtvrti/oddíly zůstávají na stávající úrovni, postup v nich je však zachován do další fáze budování.

### Fáze boje

Ve fázi boje hráč nepracuje s městem, ale je mu zobrazena pouze aktuální podoba jeho armády. Během této fáze se hráči ujímají role generálů a volí souboje, které jejich armáda podstoupí. Hráč může před jakýmkoli soubojem změnit pořadí oddílů v armádě (formaci), aby maximalizoval její efektivitu pro následující souboj.

V této fázi vždy proběhnou 2 typy bojových střetnutí - postavení se hrozbám a zápas s ostatními armádami. Na začátku fáze se pro každý z nich vygenerují/určí příslušné parametry a podrobnosti obou se zobrazí hráčům:

- **Postavení se hrozbám (PvE).** Souboj s náhodně vygenerovanou skupinou jednotek; jedná se o cizí nepřátele, se kterými se město setkává. Všem hráčům se každou fázi zobrazí stejný seznam střetnutí, ze kterého si každý vybere jedno, které se provede. Střetnutí u každého z hráčů probíhá nezávisle, i když se více hráčů rozhodlo pro stejné z nich. Parametry každého střetnutí se liší v skladbě a celkové síle nepřátel a s tím související odměny (zdroje, blueprinty, vylepšení oddílů). Hráčům jsou nabídnuty dva druhy hrozeb:
    - lokální (standardní) - obtížnostně snazší střetnutí s běžnou odměnou, každou fázi se vždy generují nové
    - globální - těžší střetnutí s větší odměnou, která obsahuje i body věhlasu; zůstávají ve hře, dokud je jeden z hráčů úspěšně neporazí, do další fáze se pak vygeneruje nová hrozba (v případě, že globální hrozbu porazí více hráčů ve stejné fázi, odměny dostanou všichni)
- **Zápas armád (PvP).** Armády hráčů bojují proti sobě navzájem. Každému hráči je přidělen jako soupeř jiný hráč, párování napříč fázemi probíhá systémem round-robin, aby se během hry hráč utkal se svými soupeři ideálně rovnoměrně. Hráč před zápasem vidí, jakou armádu má soupeř, nikoliv však její formování (pořadí oddílů). Vítěz zápasu získá body věhlasu.

Střetnutí probíhají v tomto pořadí, u všech hráčů současně. Průběh celé fáze je tedy následující:

1. vygenerují se střetnutí pro tuto fázi a zobrazí se hráčům (tj. nabízené hrozby a následující soupeř v zápasu)
2. hráči dostanou čas na výběr hrozby, které se postaví, a zvolení formace armády
3. každý hráč se utká s vybranou hrozbou - souboje se vyhodnotí, rozdají se odměny, hráč si může po alokovaný čas prohlédnout záznam svého souboje a zároveň nahlédnout, s jakou hrozbou se utkali soupeři a s jakým výsledkem (bez dalších podrobností)
4. hráči dostanou čas na zvolení formace armády před zápasem
5. hráči se navzájem utkají v zápasech - souboje se vyhodnotí, rozdají se body věhlasu, hráč si může po alokovaný čas prohlédnout záznam svého souboje a výsledky ostatních

Pro jakýkoli souboj platí, že do boje vždy nastupují všechny jednotky v plném zdraví, i přesto, že byly v předchozím souboji poraženy. Každý souboj tak probíhá s novou “kopií” armády, hra nepracuje s trvalým zraněním či smrtí jednotek.

Zápasy armád fáze boje končí. Pokud na konci fáze některý z hráčů dosáhl potřebného počtu bodů věhlasu pro vítězství, hra končí a určí se finální pořadí hráčů podle počtu bodů. Pokud hranici překročí více hráčů v rámci stejné fáze, o vítězi stále rozhodne až finální počet na konci fáze. V případě rovnosti bodů hráči sdílí umístění v pořadí.

## Soubojový systém

Magocracy disponuje tahovým systémem pro odehrání bojů mezi armádami. V Magocracy se bojem vždy rozumí souboj dvou armád (souborů oddílů) proti sobě. Boje probíhají plně automaticky a deterministicky bez přičinění hráčů a mohou tak být vyhodnoceny instantně pouze na základě zadání obou armád (včetně pořadí oddílů v nich). V uživatelském rozhraní má však hráč možnost průběh boj “krokovat” vlastním tempem, aby se přesvědčil o stavu a akcích oddílů během boje.

### Bojové vlastnosti oddílů

Jednotkou v armádách a soubojích je oddíl. Armáda se skládá z konečného počtu oddílu, kterým je dáno pořadí, jak jsou seřazeny (formace). První oddíl v armádě je “vpředu”, druhý “za ním”, a tak dále, poslední oddíl je “vzadu”. Jakmile je oddíl poražen, vypadává z pořadí (oddíly za ním se “posunou” o jedna vpřed). Když se armády utkají, jednotky vpředu z obou se považují za sousední (stojí proti sobě). Každý oddíl má následující bojové vlastnosti:

- Body zdraví (HP): množství poškození, které může oddíl přijmout, než je poražen a tím vyřazen ze souboje
- Fixní redukce zranění: každé poškození, které má oddíl utrpět, je redukováno o tento počet
- Procentuální redukce zranění: každé poškození, které má oddíl utrpět, je redukováno tímto procentem
- Akční body: určuje, kolik útoků může oddíl každý tah provést
- Iniciativa: stanovuje pořadí, v jakém se oddíly dostávají na tah

Dále má definovanou frontu útoků, které cyklicky opakuje. Každá útok má vlastnosti:

- Poškození: kolik poškození útok způsobuje cíli
- Dosah: na jakou vzdálenost jsou pro útok hledány cíle (vysvětleno níže)
- Metoda cílení: jakým způsobem je vybrán cíl z dosažitelných
- Cena: kolik akčních bodů je spotřebováno provedením útoku

Cílení funguje následovně:

1. Nejprve jsou vybrány nepřátelské oddíly, které se mohou stát cílem - hodnota dosahu určuje, do jaké vzdálenosti sousedství se může cíl nacházet. Například pokud má oddíl dosah 4 a stojí na 3. pozici v armádě, dosáhne na první 2 nepřátelské oddíly (vzdálenost 2 musí překonat, aby se dostal na začátek své armády, a zbývající 2 pokryjí první dvě nepřátelské oddíly).
2. Z možných cílů je pomocí metody vybrán ten, proti kterému se útok skutečně provede. Metody jsou následující:
    1. první (zepředu) nepřítel v dosahu
    2. poslední nepřítel v dosahu
    3. nepřítel s nejméně HP v dosahu
    4. všichni nepřátelé v dosahu

Tento systém útoků poskytuje dostatečnou flexibilitu pro různé chování oddílů - jeden nebo více vždy stejných útoků za tah, střídaní více druhů útoků, útok jednou za několik tahů (”nabíjení”). Je ho možné také zobecnit i na jiné akce, kdy by oddíl mohl akcí namísto útoku např. léčit HP nebo dočasně měnit bojové vlastnosti své nebo jiných oddílů.

### Průběh

Boj probíhá tahově po oddílech (napříč oběma armádami) dle iniciativy. Jako první tedy provede svůj tah oddíl s nejvyšší iniciativou, pak druhou nejvyšší, a tak dále. Jakmile odehraje poslední oddíl, kolo souboje končí, na tah se dostává opět první oddíl v pořadí a celý proces se opakuje.

Oddíl na tahu vždy použije útok, který má jako následující ve frontě - spotřebuje daný počet akčních bodů a provede ho. Oddíl útočí, dokud má dostatek akčních bodů na provedení následujícího útoku. Fronta je cyklická, po provedení posledního útoku následuje opět první. Jakmile nemá dostatek bodů, tah oddílu končí. Pozice ve frontě se zachová do dalšího tahu, potenciálně nevyužité akční body nikoli.

Boj končí a vítěz je určen, jakmile je jedna armáda zcela eliminována. Aby se zamezilo nekonečnému souboji (jednotky redukují všechno poškození/léčení je větší než poškození), jednou za určený počet kol boje se (i opakovaně) zdvojnásobí všechno udělované poškození. Tento potenciální exponenciální nárůst poškození garantuje ukončení souboje v rozumném počtu kol.