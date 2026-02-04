# Game design document

Tento dokument popisuje koncepční návrh hry Magocracy, její herní mechaniky, cíle a součásti.

_Poznámka: tento dokument reflektuje původní plán celé hry, z níž je v rámci VGA dodán singleplayerový prototyp, viz také závěrečná zpráva._

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

- Tým - Sólo: 5
- Engine - Web framework (Phaser): 15
- Vizuál - Jednoduchá 2D grafika: 10
- Audio - Bez zvuku: 0
- ECS: 10
- Přebarvování assetů karet/jednotek/budov: 5
- Procedurální generování herní mapy*: 15
- Politická mapa*: 5
- Diskrétní pathfinding: 5

\* implementována základní varianta s grafovou reprezentací mapy

### Nerealizované aspekty v rámci VGA

- Základní hra po síti (WebSockets)
- AI protihráčů - behaviorální strom
