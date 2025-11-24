## Milník 1: do konce zimního semestru
Termín: 21. 12. 2025

Cíle:
- vytvoření základní verze klienta po technické stránce - herní engine + UI vrstva
- funkční scéna pro správu města:
	- zobrazení města s parcelami a districty (placeholder grafika)
	- zobrazení "ruky" s blueprinty districtů
	- zobrazení seznamu jednotek armády (jednoduché, zatím bez detailů)
	- možnost stavby a vylepšení districtu + UI pro tyto akce
	- správa zdrojů města - spotřeba a produkce (herní smyčka s časovými jednotkami) + stav v UI
	- obrazovka pro nákup blueprintů districtů za zdroje
	- příprava konfigurace districtů (datový model, načítání do hry)
- implementované typy districtů:
	- výrobní (produkuje zdroje)
	- vojenské (poskytuje oddíl armády)
	- posilující (zvyšuje efekt jiných districtů)

Plán:
| Checkpoint | Cíl |
|------------|-----|
| 18. 11. | Základ projektu, vykreslení gridu města a kostry UI |
| 2. 12. | Stavba do města, herní smyčka s časem a zdroji, výrobní districty |
| 16. 12. | Vylepšení districtů, kalkulace bonusů/efektů, ostatní typy districtů |

## Milník 2: do uzavření NI-VGA
Termín: zkouškové období (leden/únor 2026)

Cíle:
- funkční scéna s mapou světa:
	- zobrazení měst jako bodů + jejich zóny vlivu dle velikosti města
	- zobrazení putujících armád na mapě, jejich pohyb + zóna detekce/vlivu
	- možnost výběru města a přechodu do jeho správy
	- možnost vyslání armády z města na bod zájmu na mapě/stažení armády zpět do města
	- tooltip s informacemi o městě/armádě při najetí
- zjednodušený soubojový systém:
	- detekce setkání armád na mapě (překryv zón vlivu), příp. doražení do cíle armády
	- vyhodnocení souboje podle hodnoty síly a obrany jednotek v armádě (bez detailního UI)
	- aktualizace stavu armád po souboji (zranění jednotek, případné zničení armády)
- implementace jednoho cíle/typu hry:
	- např. na mapě se vygeneruje určitý počet neutrálních měst (pevně dané districty + bránící armáda, bez změn v čase), hráč soupeří o dobytí nejvyššího počtu v limitu/všech měst
- AI protivníci:
	- AI hráči, kteří dokáží spravovat svá města a manipulovat s armádami na mapě
	- hraní podle stejného cíle jako hráč - zohlednit volbu cíle hry s ohledem na složitost AI

## Milník 3: do uzavření NI-DIP
Termín: 7. 5. 2026

Cíle:
- převod na multiplayer:
	- rozdělení logiky hry mezi klienta a server
	- synchronizace stavu hry mezi klienty přes server
	- možnost provozu více her současně na serveru - lobby systém + odpovídající UI klienta
- první kolo playtestů:
	- sběr zpětné vazby z upraveného prototypu vytvořeného v rámci NI-VGA od reálných hráčů
	- analýza hratelnosti v aktuálním stavu, identifikace oblastí pro zlepšení
- možnosti rozšíření mechanik (dle urgence podle playtestů):
	- přidání nových typů/více districtů
	- robustnější soubojový systém (real-time automatizovaný souboj ve stylu "auto battler/auto chess" her)
	- více typů her z hlediska generování mapy, cílů a podmínek vítězství
- další testování (až finální, nebo iterované během implementace rozšíření):
	- identifikace chyb, nedostatků v UX/UI, vyváženosti herních mechanik
	- opravy/patching na základně zpětné vazby
