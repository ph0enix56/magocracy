# Multiplayer handoff

## Aktuální stav

První implementační řez multiplayeru je hotový a navazující první autoritativní gameplay slice je také zapojený.

Byla odstraněna aktivní závislost na world map flow. Hra už v klientovi nepoužívá world map scénu, její UI store ani world map eventy. Runtime je zjednodušený na kingdom + tick + combat.

Soubojový systém byl zachován a vytažen do sdílené doménové vrstvy, aby šel později používat i na serveru pro auto-battler flow mezi hráči. Phaser CombatSystem je teď jen adapter nad shared combat jádrem.

Současně existuje první multiplayer scaffold:
- klientská session/network vrstva
- sdílený wire protokol pro lobby a gameplay commandy
- serverový Socket.IO lobby scaffold
- základní UI panel pro multiplayer spojení a lobby lifecycle

Navíc už existuje první server-backed game runtime na úrovni lobby room:
- server drží autoritativní per-player game state pro kingdom grid, resources, blueprint inventory, shop, army a combat snapshot
- server posílá `game/snapshot` do klienta
- klient má bridge službu, která server snapshot překládá do současného UI přes event bus
- klientské akce `build`, `upgrade`, `destroy`, `shop-buy`, `shop-reroll`, `army-train`, `army-reorder` a `combat-step` se při aktivním multiplayer matchi neposílají do lokální Phaser logiky, ale na server

## Důležité rozhodnutí

World map se dál nepřenáší do multiplayer architektury. Veškeré budoucí multiplayer flow má stavět na lobby + hráčská města + později auto-battler combat.

Combat má zůstat zachovaný jako samostatná doménová logika. Nemá být znovu přivázán k Phaser scénám jako zdroj pravdy.

Server má být autoritativní. Klient nemá být zdroj pravdy pro gameplay state.

## Relevantní soubory

### Shared doména
- `src/shared/combat/combatCore.ts`
- `src/shared/kingdom/kingdomGrid.ts`
- `src/shared/multiplayer/protocol.ts`

### Klientský multiplayer scaffold
- `src/multiplayer/client/MultiplayerClient.ts`
- `src/multiplayer/client/MultiplayerProjectionBridge.ts`
- `src/multiplayer/client/clientSingleton.ts`
- `src/multiplayer/client/multiplayerStore.ts`
- `src/ui/MultiplayerPanel.svelte`
- `src/ui/App.svelte`

### Serverový scaffold
- `src/multiplayer/server/LobbyServer.ts`
- `src/multiplayer/server/index.ts`
- `src/multiplayer/server/RoomGameRuntime.ts`

### Zjednodušený runtime po odebrání world mapy
- `src/game/run/GameRun.ts`
- `src/game/main.ts`
- `src/game/scenes/Kingdom/KingdomScene.ts`
- `src/eventBus.ts`

### Combat adapter
- `src/game/scenes/Kingdom/ecs/systems/CombatSystem.ts`

## Co už je hotové

- odstraněné aktivní použití world map runtime z klienta
- odstraněné world map eventy z event bus kontraktu
- odstraněná world map scéna z Phaser bootstrapu
- shared combat core mimo Phaser
- Socket.IO lobby server scaffold
- klientský multiplayer connector/store
- klientský TS bridge ze server snapshotu do dnešního UI
- základní multiplayer panel v UI
- autoritativní room game runtime pro první gameplay slice
- server-side napojení `game/action` pro grid/build/shop/army/combat step
- server-side kingdom snapshot serializace
- klientský sync server kingdom snapshotu do lokální Phaser ECS/render vrstvy
- lokální RunLoop tick se při autoritativním multiplayer matchi vypíná
- projekční logika už není ve Svelte komponentě, ale v explicitní TS lifecycle službě
- build znovu prochází
- server startuje

## Co ještě hotové není

Gameplay je na autoritativní server napojený výrazně dál, ale ještě ne úplně celý.

`game/action` už server obsluhuje i pro kingdom grid/build akce.

Lokálně zůstávají hlavně render-driven části Phaser runtime a prezentační selection/UI flow.

Další velká nevyřešená hranice je combat orchestrace jako součást budoucího multiplayer game flow, ne samotný lokální combat stepping.

## Doporučený další krok

Další implementační slice má být stabilizace projekční vrstvy a příprava na budoucí PvP / auto-battler flow.

Doporučené pořadí:
1. omezit zbývající duplicitu mezi bridge vrstvou a lokálním eventBus/UI broadcast flow
2. přesunout další snapshot projekci a pending-action potvrzení do testovatelnějších čistých helperů nad `MultiplayerProjectionBridge`
3. připravit server-side combat initiation API nad dvěma armádami hráčů nebo PvE encountery
4. navrhnout room-level phase orchestration pro build/combat fáze podle GDD
5. až potom řešit matchmaking/párování a detailní PvP auto-battler flow

## Technické poznámky

- `GameRun` je teď minimální wrapper nad `ECSManager` a `CombatSystem`.
- `CombatSystem` používá shared combat core a mapuje na něj `ArmyUnitComponent`.
- `buildings.ts` už nepoužívá `import.meta.glob`; building registry je teď staticky importovaná a funguje i na serveru.
- `RoomGameRuntime` teď inicializuje kingdom grid, obsluhuje build/upgrade/destroy a serializuje kingdom tile snapshot.
- `KingdomScene` přijímá server `game/snapshot` a synchronizuje jím lokální ECS/render stav pro dlaždice a budovy.
- `MultiplayerProjectionBridge` je teď čistá TS služba s `attach()` / `detach()` lifecycle místo Svelte komponenty.
- `Socket.IO` bylo přidáno jako runtime dependency.
- `terser` bylo doplněno do devDependencies, protože produkční Vite build ho vyžaduje.

## Ověřené příkazy

- `bun run build`
- `bun run server:start`
- `bun run server:dev`

## Rizika při dalším kroku

- Nevracet world map kontrakty do event busu ani do GameRun.
- Nepřidávat síťovou logiku přímo do Phaser scén jako primární zdroj stavu.
- Při převodu build systému oddělit doménové mutace od UI broadcastů stejně jako u combatu.
- Klientský bridge teď překládá autoritativní snapshoty zpět do event busu; při další migraci je potřeba hlídat, aby se stejná data zároveň negenerovala i z lokální Phaser logiky.
- Lokální ECS je teď render/projection cache serverového stavu; další změny by měly tuhle roli zachovat a nevracet mu autoritativní odpovědnost.

## Poznámka k migraci

Současný event bus může ještě chvíli zůstat jako přechodová vrstva pro UI, ale postupně by měl být zúžen na lokální prezentační komunikaci. Autoritativní data mají přicházet z multiplayer session vrstvy, ne z lokálních mutací ve scénách.
