# Game design document

Tento dokument popisuje koncepční návrh hry Magocracy, její herní mechaniky, cíle a součásti.

## Přehled hry

Magocracy je multiplayer real-time strategická hra pro uzavřené lobby hráčů (primárně 4-8).
Každý z nich vládne své magické říši na společné procedurálně generované 2D mapě, kde se snaží co nejefektivněji rozšířit svá města, budovat v nich armády a ty vyslat na výpravy za zdroji a dobytí nepřátel.



Hra disponuje variabilní časovou škálou - čas nutný pro výstavbu budov, přesuny armád a další akce je vázán na abstraktní časové jednotky (time units - TU), jejichž délku v reálném čase si hráči zvolí při tvorbě lobby.
Je tak možné hrát jak rychlé zápasy (dohratelné v jednom sezení), tak i dlouhodobé kampaně (probíhající týdny či měsíce), kdy se předpokládá občasné připojování hráčů pro zkontrolování stavu jejich říše a zadání dalších příkazů.

## Komponenta správy města

Každé město je tvořeno čtvercovou sítí parcel, na každé z nich může stát district (čtvrť) určitého typů, který poskytuje různé efekty, ať už obecně pro město/říši (produkce zdrojů, výcvik oddílu armády, ...), nebo pro ostatní districty (vyšší produkce, rychlejší stavba, ...).

Hráči zde mohou iniciovat výstavbu nových districtů. K tomu potřebují "blueprint" (kartu) districtu, volnou parcelu, kam jej umístí, a zdroje pro výstavbu, které jsou uvedené na blueprintu.
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
Maximální úroveň oddílu (počet možných tréninků) obecně není omezen, narozdíl od vylepšení districtů.



### Typy districtů

| Typ districtu | Barva | Popis |
|---------------|-------|-------|
| 

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
