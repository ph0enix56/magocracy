# Multiplayer handoff

## Aktuální stav

První implementační řez multiplayeru je hotový.

Byla odstraněna aktivní závislost na world map flow. Hra už v klientovi nepoužívá world map scénu, její UI store ani world map eventy. Runtime je zjednodušený na kingdom + tick + combat.

Soubojový systém byl zachován a vytažen do sdílené doménové vrstvy, aby šel později používat i na serveru pro auto-battler flow mezi hráči. Phaser CombatSystem je teď jen adapter nad shared combat jádrem.

Současně existuje první multiplayer scaffold:
- klientská session/network vrstva
- sdílený wire protokol pro lobby a gameplay commandy
- serverový Socket.IO lobby scaffold
- základní UI panel pro multiplayer spojení a lobby lifecycle

## Důležité rozhodnutí

World map se dál nepřenáší do multiplayer architektury. Veškeré budoucí multiplayer flow má stavět na lobby + hráčská města + později auto-battler combat.

Combat má zůstat zachovaný jako samostatná doménová logika. Nemá být znovu přivázán k Phaser scénám jako zdroj pravdy.

Server má být autoritativní. Klient nemá být zdroj pravdy pro gameplay state.

## Relevantní soubory

### Shared doména
- `src/shared/combat/combatCore.ts`
- `src/shared/multiplayer/protocol.ts`

### Klientský multiplayer scaffold
- `src/multiplayer/client/MultiplayerClient.ts`
- `src/multiplayer/client/multiplayerStore.ts`
- `src/ui/App.svelte`

### Serverový scaffold
- `src/multiplayer/server/LobbyServer.ts`
- `src/multiplayer/server/index.ts`

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
- základní multiplayer panel v UI
- build znovu prochází
- server startuje

## Co ještě hotové není

Gameplay ještě není napojený na autoritativní server.

Typ `game/action` existuje v protokolu, ale server ho zatím záměrně odmítá. To je očekávaný stav po prvním řezu.

Klientský gameplay pořád funguje lokálně přes event bus a Phaser runtime. Multiplayer scaffold zatím řeší jen spojení, lobby a hranici architektury.

## Doporučený další krok

Další implementační slice má být první autoritativní gameplay vrstva bez combatu proti jiným hráčům.

Doporučené pořadí:
1. zavést server-side `PlayerGameState` / `RoomGameState` snapshot model
2. napojit na server `resources`, `blueprints`, `army order`, `training`, `shop offers`
3. převést klientské akce `shop-buy`, `shop-reroll`, `army-train`, `army-reorder` na `game/action`
4. přidat server -> klient `game/snapshot` nebo `game/delta` projekci
5. teprve potom převádět `build-requested` / `upgrade-requested` / `destroy-requested`

Tohle pořadí je vhodné, protože army/shop flow má menší vazbu na grid rendering než build systém.

## Technické poznámky

- `GameRun` je teď minimální wrapper nad `ECSManager` a `CombatSystem`.
- `CombatSystem` používá shared combat core a mapuje na něj `ArmyUnitComponent`.
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

## Poznámka k migraci

Současný event bus může ještě chvíli zůstat jako přechodová vrstva pro UI, ale postupně by měl být zúžen na lokální prezentační komunikaci. Autoritativní data mají přicházet z multiplayer session vrstvy, ne z lokálních mutací ve scénách.
