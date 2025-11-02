# Game design document

Tento dokument popisuje koncepční návrh hry Magocracy, její herní mechaniky, cíle a součásti.

## Executive summary

Magocracy je multiplayer real-time strategická hra pro uzavřené lobby hráčů (primárně 4-8).
Každý z nich vládne své magické říši na společné procedurálně generované 2D mapě, kde buduje města z jednotlivých částí, rekrutuje v nich armády a ty vysílá na výpravy za zdroji a dobytí nepřátel.

Města jsou tvořena šestiúhelníkovou sítí, do které hráči umisťují districty (čtvrti) s různými funkcemi - produkce zdrojů, výcvik armád, magické efekty a další možnosti.
Efekty a vlastnosti se často ovlivňují vzájemným umístěním districtů, čímž vzniká prostor pro plánování a optimalizaci měst.

Stavební plány nutné pro výstavbu districtů hráči primárně získávají ze sdíleného trhu, kde se tak hráči nepřímo ovlivňují svou poptávkou po určitých plánech.
Trh je navíc generován každou hru jinak, což odměňuje hráče schopné za běhu adaptovat svou strategii podle dostupné nabídky.

Na celkové mapě světa pak hráči plánují výpravy svých armád vedených magickými generály.
Tím zajišťují zdroje a výhody pro svou říši, případně v závislosti na typu hry plní herní cíle, jako je dobytí určitých území či eliminace nepřátelských hráčů.
Armády hráč skládá z oddílů, které plní různé bojové role, a jejich taktická kombinace je klíčová pro úspěch v bitvách.

Stavba měst a aktivita armád probíhají v reálném čase, avšak s využitím abstraktních časových jednotek, jejichž délku si hráči zvolí při tvorbě lobby.
Je tak možné hrát jak rychlé zápasy (dohratelné v jednom sezení), tak i dlouhodobé kampaně (probíhající týdny či měsíce), kdy se předpokládá občasné připojování hráčů pro zkontrolování stavu jejich říše a zadání dalších příkazů.

## Pilíře designu

- Soutěživost; hráči soupeří v tom, kdo pro danou hru a situaci vymyslí nejlépe funkční strategii. Strategická hloubka je vytvořena dostatečně různorodým souborem districtů a jednotek, spolu s jejich proměnlivou dostupností v každé hře.
- Sociální interakce; hráči se navzájem ovlivňují během celé hry, a to jak nepřímo skrze vzájemné rozdělování zdrojů (trh s blueprinty, zábor území), tak přímo skrze diplomacii a vojenské konflikty.
- Tvoření; hráči mají bohaté možnosti, jak rozvíjet svá města a skládat své armády, přičemž jsou odměněni za kreativní a efektivní řešení.

## Aspekty práce (kartičky)

Jisté:

- Tým - Sólo: 5
- Engine - Web framework (Phaser / pixi.js): 15
- Vizuál - Jednoduchá 2D grafika: 10
- Audio - Přehrávání samplů: 5
- Procedurální generování herní mapy: 15

Pravděpodobné:

- Základní hra po síti (pokud bude server-side v rámci VGA): 5
- Fog of War: 5
- Politická mapa: 5
- Přebarvování assetů jednotek/budov: 5

Možné:

- ECS (podle potřeby použití v rámci frameworku): 10
- AI se stavovým automatem pro logiku jednotek v soubojích: 5
- Behaviorální stromy (to samé, pokud by bylo složitější): 10

## Herní mechaniky *(under construction)*

V této části jsou detailně rozebrány hlavní herní mechaniky a systémy.

### Komponenta správy města

Každé město je tvořeno šestiúhelníkovou sítí parcel, na každé z nich může stát district (čtvrť) určitého typu, který poskytuje různé efekty, ať už obecně pro město/říši (produkce zdrojů, výcvik oddílu armády, ...), nebo pro ostatní districty (vyšší produkce, rychlejší stavba, ...).

Hráči zde mohou iniciovat výstavbu nových districtů.
K tomu potřebují "blueprint" (kartu) districtu, volnou parcelu, kam jej umístí, a zdroje pro výstavbu, které jsou uvedené na blueprintu.
Po zahájení je district ve stavbě po určitý počet TU, během kterých se postupně odčerpávají potřebné zdroje ze zásob města.
Po dokončení district začne poskytovat své efekty.

Základní typy districtů jsou uvedené v následující sekci.
Každý district začíná na úrovni 1, typicky může být následně 3x vylepšen.
Vylepšení trvá určitý počet TU a stojí určité množství zdrojů, případně vyžaduje splnění určité podmínky (např. přítomnost počtu jiných districtů ve městě).
Cena, doba a efekt vylepšení je určena blueprintem (čímž vznikají rozdíly mezi i jinak podobnými districty), typicky roste s každou další úrovní.

Zvláštním druhem districtu je vojenské cvičiště, které poskytuje armádní oddíl.
Jakmile je district postaven, hráči je k dispozici jeden oddíl typu určeného blueprintem (např. kasárna poskytne oddíl pěchoty).
Ten může být následně vyslán na výpravy mimo město, pokud je naopak přítomen ve městě, stává se součástí jeho obrany před nepřáteli.
Cvičiště mají místo vylepšení districtu možnost tréninku oddílu.
To probíhá v principu stejně jako vylepšení, ale výsledkem je zvýšení úrovně poskytovaného oddílu, což zlepší jeho bojové vlastnosti.
Maximální úroveň oddílu (počet možných tréninků) obecně není omezena, narozdíl od vylepšení districtů.

## 

### Přehled typů districtů

| Typ districtu | Barva | Popis |
|---------------|-------|-------|
| 

Hra disponuje variabilní časovou škálou - čas nutný pro výstavbu budov, přesuny armád a další akce je vázán na abstraktní časové jednotky (time units - TU), jejichž délku v reálném čase si hráči zvolí při tvorbě lobby.
