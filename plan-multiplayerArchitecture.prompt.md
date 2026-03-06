## Plan: Multiplayer architektura

Doporučený směr je čistý TypeScript end-to-end, autoritativní server a realtime komunikace přes `Socket.IO` nad WebSocket. Pro tenhle prototyp bych nevolil těžký backend framework; současný klient je dost přímočarý a největší hodnota teď není v DI nebo dekorátorech, ale v rychlém vytažení sdílené herní logiky mimo Phaser a mimo UI bus.

Nejdůležitější zjištění z codebase je, že dnešní hranice mezi UI a hrou už existuje, ale na špatné vrstvě: [src/eventBus.ts](src/eventBus.ts) dobře odděluje Phaser a Svelte, jenže samotná herní logika v [src/game/scenes/Kingdom/ecs/ECSBase.ts](src/game/scenes/Kingdom/ecs/ECSBase.ts) a [src/game/run/GameRun.ts](src/game/run/GameRun.ts) zároveň přímo publikuje UI eventy. To je hlavní technický dluh pro multiplayer, protože stejná logika pak nejde rozumně spustit na serveru.

**Doporučení**
- Jazyk/framework: čistý `TypeScript` na klientu i serveru. Na spojení `Socket.IO`; je pragmatičtější než raw `ws`, protože už řeší rooms, reconnect, heartbeat a acknowledgements, což přesně sedí na lobby model.
- API: pro vlastní lobby a hru použít WebSocket vrstvu. Praktický kompromis je hybrid: `HTTP` jen pro bootstrap a provozní endpointy, samotné `create/join/ready/start/gameplay` vést po socketu.
- Model komunikace: neobsluhovat serverovou komunikaci čistě z Phaser. Vznikne samostatná `session/network` vrstva s kanonickým lokálním stavem, na kterou se napojí jak Phaser, tak Svelte. Phaser má být renderer a input controller, ne vlastník spojení ani zdroj pravdy.

**Cílové rozdělení codebase**
- `shared domain`: serializovatelné typy, building defs, konfigurace, combat model, command/event kontrakty, snapshoty.
- `server runtime`: lobby manager, room/session lifecycle, tick scheduler, autoritativní game state, RNG, validace commandů.
- `client app`: Phaser rendering, Svelte UI, session klient, store/projection vrstva, dočasně i bridge do stávajícího event busu.

**Postup**
1. Vymezit hranici odpovědností: server vlastní lobby, hráče, tick, RNG a veškeré mutace herního stavu; klient vlastní render, input a lokální prezentační stav.
2. Vyseparovat sdílenou doménu z [src/game/run/GameRun.ts](src/game/run/GameRun.ts), [src/game/scenes/Kingdom/ecs/ECSBase.ts](src/game/scenes/Kingdom/ecs/ECSBase.ts), [src/game/scenes/Kingdom/ecs/systems/CombatSystem.ts](src/game/scenes/Kingdom/ecs/systems/CombatSystem.ts) a datových definic tak, aby tato vrstva neznala Phaser ani event bus.
3. Zavést explicitní síťový protokol `client command -> authoritative event/snapshot`. Klient neposílá “state”, ale jen záměry: build, upgrade, reorder army, travel, ready, start game.
4. Postavit serverové room sessions nad `Socket.IO`. Jedna room drží celý stav partie a substate všech hráčů; to je vhodnější než oddělené autoritativní instance bez centrální room state.
5. Přidat klientskou session vrstvu, která drží socket, reconnect, pending commandy a lokální projekce stavu.
6. Přepojit [src/ui/gameState.ts](src/ui/gameState.ts) a [src/ui/App.svelte](src/ui/App.svelte) na session/store vrstvu místo přímé závislosti na lokálně běžící hře.
7. Přepojit [src/game/scenes/Kingdom/KingdomScene.ts](src/game/scenes/Kingdom/KingdomScene.ts) tak, aby neposílala mutace do lokální logiky napřímo, ale emitovala intents a renderovala potvrzený stav.
8. Migrovat subsystémy po vrstvách: lobby/presence, resources/build/shop/army, world map travel, nakonec combat replay.

**Relevantní místa v současném kódu**
- [src/eventBus.ts](src/eventBus.ts): dobrý přechodový adapter mezi prezentací a novou session vrstvou.
- [src/game/scenes/Kingdom/KingdomScene.ts](src/game/scenes/Kingdom/KingdomScene.ts): dnešní command gate, kde UI akce rovnou mutují stav.
- [src/game/scenes/Kingdom/ecs/ECSBase.ts](src/game/scenes/Kingdom/ecs/ECSBase.ts): centrální mutable state, ale nevhodně spojený s UI broadcastingem.
- [src/game/run/GameRun.ts](src/game/run/GameRun.ts): tick, travel, world map a encounter flow; dobrý základ pro server runtime.
- [src/ui/gameState.ts](src/ui/gameState.ts): přirozený spotřebitel nové session/store vrstvy.
- [index.html](index.html): potvrzuje, že Phaser a Svelte už dnes startují paralelně, takže sdílená session vrstva nad nimi dává smysl.

**Verification**
1. Ověřit, že více lobby běží odděleně a eventy se nepropíší mezi roomami.
2. Ověřit reconnect do lobby i do rozehrané partie bez reloadu.
3. Ověřit, že gameplay akce už neprovádí přímé lokální mutace mimo session/server vrstvu.
4. Ověřit determinismus combatu a tick-dependent logiky při stejném seed a stejném vstupu.
5. Ověřit, že Phaser i Svelte reagují na stejný autoritativní update bez duplikace stavu.

Plán jsem uložil i do `/memories/session/plan.md` pro další handoff. Pokud chceš, další krok může být:
1. rozpracovat tenhle návrh do konkrétní cílové adresářové struktury a síťového protokolu,
2. nebo udělat detailní migrační plán po jednotlivých PR krocích.
