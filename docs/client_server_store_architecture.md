# Client-Server-Store Architecture Overview

## Scope

This document defines the current end-to-end flow for multiplayer UI interactions, then proposes boundaries and goals for the next refactor stages.

## Current End-to-End Flow

1. UI component triggers an action through game session client API.
2. gameSessionStore validates basic client-side preconditions and sends a command via MultiplayerClient.
3. SocketGateway and LobbyApplicationService route the command to RoomGameRuntime.
4. Active server phase runtime validates and mutates authoritative state.
5. Server emits command response plus latest game snapshot.
6. MultiplayerClient updates local snapshot state and notifies subscribers.
7. gameSessionStore rebuilds its derived state and pushes to Svelte store.
8. UI components and game scene projections re-render from store updates.

## Current Module Responsibilities

### Authoritative Server Runtime

- Owns gameplay state transitions and action effects.
- Main orchestrator: src/multiplayer/server/RoomGameRuntime.ts.
- Phase-specific logic: src/multiplayer/server/gameplay/phases/*.ts.

### Server Application Layer

- Command-level coordinator: src/multiplayer/server/app/LobbyApplicationService.ts.
- Lobby lifecycle ownership: src/multiplayer/server/app/LobbyLifecycleService.ts.
- Runtime ownership and dispatch: src/multiplayer/server/app/LobbyRuntimeOrchestrator.ts.
- Event emission boundary: src/multiplayer/server/app/ServerEventPublisher.ts.
- Transport gateway: src/multiplayer/server/app/SocketGateway.ts.

### Shared Contracts

- Commands: src/shared/multiplayer/contracts/commands.ts.
- Events: src/shared/multiplayer/contracts/events.ts.
- Snapshots: src/shared/multiplayer/contracts/snapshots.ts.

### Client Transport and Session State

- Transport/session wrapper: src/multiplayer/client/MultiplayerClient.ts.
- Session facade + derived state + request tracking: src/multiplayer/client/gameSessionStore.ts.

### UI Projection Layer

- General projections: src/ui/gameState.ts.
- Timer-specific projection: src/ui/projections/phaseTimerState.ts.
- Component consumers: src/ui/*.svelte.

## Key Pain Points

1. gameSessionStore has too many responsibilities (transport state merge, permissions, local view state, request lifecycle).
2. Some UI projections were mixed in broad modules without explicit domain boundaries.
3. Snapshot-level updates cause broad reactivity churn for components that only need small slices.
4. Client-side and server-side validation rules are duplicated in places.
5. Request acknowledgement and snapshot application are correlated indirectly.

## Boundary Model Going Forward

## 1. Server Domain Boundary

- Server is the only authoritative owner of gameplay state.
- Client never mutates authoritative fields locally.
- Shared contracts remain the only wire schema source.

## 2. Client Session Boundary

- MultiplayerClient is transport-only and protocol lifecycle only.
- Session assembly layer translates wire events into normalized client session state.

## 3. Client View Context Boundary

- Scouting target, selected tile, overlay mode, and UI-local context belong in dedicated view-context stores.
- These never live in generic gameplay projection modules.

## 4. UI Projection Boundary

- Component-specific projections live in src/ui/projections.
- Shared view selectors used by many components remain in src/ui/gameState.ts.
- Components import only the projection they need.

## 5. UI Component Boundary

- Components are render and interaction only.
- Business derivation is handled by projection modules.

## Design Goals

1. Single source of truth per concern.
2. Minimal coupling between transport, domain, and presentation state.
3. Predictable one-way data flow from server snapshot to UI rendering.
4. Small, testable store modules with explicit ownership.
5. Better performance through narrower subscriptions and projections.
6. No god modules, one responsibility per module. Comment on class and public functions via JSDoc.
7. Proper usage of types following OOP principles. No ad-hoc type unions or "any" types. Function signatures should be explicit and descriptive. Exported, reusable types should be defined in dedicated type modules, in shared or ui folders as appropriate. Use clear domain modeling in types to reflect the underlying concepts.
8. Simple client-side validation for immediate UI feedback in case of malformed player input possible in standard client. Server remains the authority for validating game rules, no duplication of validation logic on client. Assume usage of unmodified UI client, any game integrity checks are performed on server side (eg. sending commands in wrong phase, on behalf of another player). Client validation is for basic input sanity and user experience, not for security or game integrity.
9. Full refactor with no temporary "bridge" or "glue" code into a clean, well-structured and documented architecture. No incremental layering or mixing old and new patterns. Check for and remove any existing code that already is or will be redundant or obsolete in the final architecture.

## Implementation Plan (Exact)

The plan is intentionally file-level and ordered, so each task has unambiguous ownership and completion criteria.

### Phase A - Contracts and Session Core Interfaces

#### A1. Introduce dedicated client session type modules

- Create `src/multiplayer/client/session/types.ts`.
- Move and normalize exported reusable types from `gameSessionStore.ts`:
	- `GameSessionState`
	- `SelectedTileView`
	- `CommandResult`
- Add explicit session build context type to remove mutable module globals.
- Add typed empty snapshot defaults in this module (single source for fallback values).
- Add JSDoc for all exported types and constants.

#### A2. Introduce pure state assembly module

- Create `src/multiplayer/client/session/sessionStateBuilder.ts`.
- Move state derivation and selector helpers from `gameSessionStore.ts` into pure functions:
	- self/viewed player resolution
	- selected tile projection
	- combat-open request trigger detection
- Export one pure API:
	- `buildGameSessionState({ base, catalog, context }) -> { state, context }`
- Ensure the module has no side effects and no direct store access.

#### A3. Introduce action request lifecycle contracts

- Create `src/multiplayer/client/session/actionRequestTracker.ts`.
- Define lifecycle model:
	- `sent`
	- `acknowledged`
	- `resolved`
- Implement correlation rules against snapshot application (version-based, not timing assumptions).
- Add JSDoc on class and public methods.

#### A4. Introduce client action sanity validation module

- Create `src/multiplayer/client/session/actionValidation.ts`.
- Move client validation to malformed-input checks only:
	- numeric bounds
	- required IDs
	- finite integers where expected
- Remove game-rule validation duplication from client validation path.

### Phase B - Client Core Cutover

#### B1. Refactor MultiplayerClient to expose snapshot application version

- Update `src/multiplayer/client/MultiplayerClient.ts`:
	- add `gameSnapshotVersion` to `MultiplayerClientState`
	- increment on each `game/snapshot` event application
	- reset appropriately on disconnect/non-game transitions
- Keep `MultiplayerClient` transport/protocol lifecycle only.

#### B2. Rewrite gameSessionStore as orchestration only

- Refactor `src/multiplayer/client/gameSessionStore.ts` to:
	- delegate state assembly to `sessionStateBuilder`
	- delegate request lifecycle to `actionRequestTracker`
	- delegate input sanity to `actionValidation`
	- own only store wiring and client facade methods
- Eliminate module-level mutable globals for selected tile/viewed player/request handling.
- Keep exports stable for current UI migration window:
	- `gameSessionState`
	- `gameSessionClient`
- Re-export canonical session types from `session/types.ts`.

#### B3. Remove duplicate validation logic from command dispatch path

- Remove phase-rule checks from client dispatch in `gameSessionStore.ts`.
- Keep UX-only checks that are local-context specific (for immediate user feedback) if they do not replicate server game-rule authority.

#### B4. Verify no behavior regression in transport command flow

- Ensure command success requires:
	- command accepted (or not rejected)
	- snapshot application progression after send
- Ensure pending requests are rejected on disconnect/inactive authoritative gameplay.

### Phase C - Projection and UI Consumer Migration

#### C1. Introduce dedicated UI projection modules by domain

- Create or extend `src/ui/projections/*` modules for component-specific view state:
	- `shopViewState.ts`
	- `armyViewState.ts`
	- `combatViewState.ts`
	- `advanceViewState.ts`
	- `fightViewState.ts`
	- `buildingSelectorViewState.ts`
	- `sidebarViewState.ts`
	- `resourceViewState.ts`
	- `renownLeaderboardState.ts`
	- `appViewState.ts`
- Each module should expose typed derived stores and reusable formatting helpers when needed.
- Add JSDoc for exported projection types and stores.

#### C2. Move component-local derivations into projection modules

- Update `src/ui/*.svelte` consumers to read pre-derived view data from projection stores.
- Remove per-component derivation of:
	- lobby player name lookup maps
	- scouting/read-only labels
	- overlay phase config selection
	- blueprint/army aggregate counts
	- leaderboard ranking shaping
- Keep Svelte components focused on rendering and interaction dispatch only.

#### C3. Reduce direct `gameSessionState` usage in UI components

- Replace direct imports of `gameSessionState` in UI components with projection store imports.
- Keep direct imports only where transport actions are triggered via `gameSessionClient`.
- Ensure each component subscribes only to minimal projection slices required for rendering.

#### C4. Constrain `src/ui/gameState.ts` to shared selectors only

- Keep `src/ui/gameState.ts` limited to broad shared selectors used by multiple projection modules.
- Move component-specific selectors out of this module.
- Remove obsolete exports and update imports accordingly.

#### C5. Verify UI behavior parity after projection cutover

- Confirm no UI interaction regressions for build/shop/army/combat/advance/fight views.
- Confirm scouting/read-only messaging still appears consistently across affected components.

### Phase D - Kingdom Scene Projection Isolation

#### D1. Introduce Kingdom scene projection store module

- Create `src/game/scenes/Kingdom/projection/kingdomSceneProjectionState.ts`.
- Expose narrow stores for scene consumers:
	- building catalog snapshot projection used for asset loading
	- kingdom tile snapshot projection used for render world sync
- Ensure projection emission is guarded by reference/identity checks to avoid redundant scene updates.

#### D2. Refactor `KingdomScene` to subscribe to narrow stores

- Replace `gameSessionState` subscription in `src/game/scenes/Kingdom/KingdomScene.ts`.
- Use independent subscriptions for:
	- catalog changes -> `loadCatalogAssets(...)`
	- tile snapshot changes -> `applyKingdomSnapshot(...)`
- Keep overlay and input behavior unchanged.

#### D3. Remove full-state relayout churn in scene update flow

- Trigger `hexGridSystem.relayout()` only for tile/camera/layout events, not every session update.
- Preserve relayout behavior on resize and real tile projection changes.

#### D4. Verify rendering and interaction parity in Kingdom scene

- Confirm tile selection, building sprite loading, and construction badge rendering still work.
- Confirm panning/zoom and overlay hide/show behavior remain unchanged.

### Phase E - Server Application Service Decomposition

#### E1. Introduce dedicated server event publisher module

- Create `src/multiplayer/server/app/ServerEventPublisher.ts`.
- Move response emission concerns out of `LobbyApplicationService`:
	- session connected event emission
	- catalog snapshot emission
	- lobby state broadcast
	- game snapshot broadcast
	- command accepted/rejected event emission
- Keep payload schemas identical to existing shared wire contracts.

#### E2. Introduce dedicated lobby lifecycle service module

- Create `src/multiplayer/server/app/LobbyLifecycleService.ts`.
- Move lobby and player lifecycle ownership out of `LobbyApplicationService`:
	- lobby create/join/leave/solo operations
	- player connected/disconnected and ready state updates
	- host reassignment and empty-lobby teardown
	- player->lobby lookup index and lobby record storage
- Keep lifecycle rules and validation messages behaviorally equivalent.

#### E3. Introduce dedicated runtime orchestration service module

- Create `src/multiplayer/server/app/LobbyRuntimeOrchestrator.ts`.
- Move runtime ownership out of `LobbyApplicationService`:
	- `RoomGameRuntime` creation and start
	- runtime lookup by lobby
	- action dispatch to authoritative runtime
	- runtime stop and cleanup when lobbies are removed
	- snapshot callback routing to publisher

#### E4. Refactor LobbyApplicationService into orchestration facade

- Keep `LobbyApplicationService` as command-level coordinator only.
- Delegate:
	- lifecycle operations to `LobbyLifecycleService`
	- runtime operations to `LobbyRuntimeOrchestrator`
	- outbound events to `ServerEventPublisher`
- Preserve public API used by `SocketGateway` (`handleConnected`, `handleDisconnected`, `handleCommand`).

#### E5. Preserve authoritative behavior and contract compatibility

- Ensure game action command flow remains unchanged from client perspective.
- Ensure lobby state and game snapshot emissions remain deterministic and equivalent in timing semantics.

### Phase F - Final Cleanup and Redundancy Removal

#### F1. Remove obsolete compatibility wrappers and aliases

- Remove `src/multiplayer/server/LobbyServer.ts` compatibility wrapper.
- Remove client store alias module `src/multiplayer/client/multiplayerStore.ts`.
- Update all imports to canonical modules.

#### F2. Simplify server bootstrap to direct composition

- Update `src/multiplayer/server/index.ts` to compose:
	- `SocketGateway`
	- `LobbyApplicationService`
- Remove wrapper-based server instantiation.

#### F3. Remove dead code paths and redundant helpers

- Delete helper methods no longer needed after E decomposition.
- Ensure no duplicate command accept/reject emitters remain in multiple modules.

#### F4. Documentation cleanup to final architecture shape

- Update architecture docs to reference final module ownership for client and server layers.
- Remove mention of temporary compatibility layers and migration-window-only aliases.

#### F5. Final verification pass

- Re-run typecheck and build.
- Verify no orphaned imports/references to removed modules remain.

## Acceptance Tests

Each test has a deterministic pass condition. Tests are grouped by phase and should be run locally.

### A/B Structural and Type Safety

1. AB-T1 Typecheck
- Command: `bunx tsc --noEmit`
- Pass: exit code 0, no TypeScript errors.

2. AB-T2 Production build
- Command: `bun run build`
- Pass: build completes successfully.

3. AB-T3 No obsolete mutable globals in session store
- File check: `src/multiplayer/client/gameSessionStore.ts`
- Pass: no module-level mutable globals for selected tile, viewed player, pending request map.

4. AB-T4 Session assembly purity
- File check: `src/multiplayer/client/session/sessionStateBuilder.ts`
- Pass: no direct imports of Svelte store APIs and no direct multiplayer transport calls.

### B Runtime Flow and Request Lifecycle

5. B-T1 Command rejected path
- Setup: connect, join/create lobby, send intentionally malformed payload through client facade.
- Pass: client resolves `CommandResult` with `ok: false`; no unhandled promise; pending request map does not leak entries.

6. B-T2 Accepted + snapshot progression correlation
- Setup: in active game, issue valid `shop/reroll` or `army/reorder` action.
- Pass: promise resolves `ok: true` only after snapshot version advances beyond send point.

7. B-T3 Disconnect while pending
- Setup: send a valid action, immediately disconnect before response processing completes.
- Pass: pending action resolves `ok: false` with disconnect/inactive reason; no stuck pending entries.

8. B-T4 Client rule duplication removed
- File check: `src/multiplayer/client/gameSessionStore.ts`
- Pass: no phase-rule gating branches for build/shop/army/combat command types in dispatch function.

### Post A/B Smoke

9. AB-S1 Manual gameplay smoke
- Setup: start server, open client, connect, create solo lobby, enter game.
- Verify:
	- tile selection works
	- build/shop/army actions still dispatch
	- combat replay open/step still dispatch
	- advance charter selection dispatches
- Pass: no runtime exception in browser console, and command feedback remains functional.

### C Structural and Projection Boundary

10. C-T1 UI projection modules compile
- Command: `bunx tsc --noEmit`
- Pass: exit code 0 with new projection modules and updated imports.

11. C-T2 UI components no longer depend on full session store directly (targeted set)
- File check: `src/ui/App.svelte`, `src/ui/Shop.svelte`, `src/ui/Army.svelte`, `src/ui/Combat.svelte`, `src/ui/AdvancePhasePanel.svelte`, `src/ui/FightPhasePanel.svelte`, `src/ui/BuildingSelector.svelte`, `src/ui/Sidebar.svelte`, `src/ui/ResourceCounter.svelte`, `src/ui/RenownLeaderboard.svelte`
- Pass: components import projection stores for view derivation instead of deriving directly from `gameSessionState`.

12. C-T3 Shared selector boundary in gameState module
- File check: `src/ui/gameState.ts`
- Pass: module contains only shared cross-cutting selectors, not component-specific derived view models.

13. C-T4 Production build after UI cutover
- Command: `bun run build`
- Pass: build succeeds with no Svelte compile regressions.

### D Runtime and Scene Subscription Isolation

14. D-T1 Kingdom scene no longer subscribes to full session state
- File check: `src/game/scenes/Kingdom/KingdomScene.ts`
- Pass: no `gameSessionState.subscribe(...)` usage remains.

15. D-T2 Dedicated scene projection module purity
- File check: `src/game/scenes/Kingdom/projection/kingdomSceneProjectionState.ts`
- Pass: module is projection-only, has no Phaser imports, and no scene side effects.

16. D-T3 Relayout trigger narrowing
- File check: `src/game/scenes/Kingdom/KingdomScene.ts`
- Pass: `hexGridSystem.relayout()` is not triggered by unrelated session updates; only resize and tile projection updates trigger relayout.

17. D-S1 Manual Kingdom scene smoke
- Setup: start server, open client, enter game, perform tile selection/build/upgrade/destroy and phase transitions.
- Verify:
	- tile selection updates sidebar consistently
	- new building textures still load when first encountered
	- camera pan/zoom and overlay hide/show still work
	- no visible jitter from unrelated state updates (e.g. timer ticks)
- Pass: no runtime errors and no scene desync observed.

### E Server Decomposition Structural and Runtime

18. E-T1 Server decomposition compiles
- Command: `bunx tsc --noEmit`
- Pass: no TypeScript errors after service split.

19. E-T2 Application service responsibility boundary
- File check: `src/multiplayer/server/app/LobbyApplicationService.ts`
- Pass: no direct lobby map storage, no runtime map storage, and no direct event payload construction helpers remain.

20. E-T3 Lifecycle ownership isolation
- File check: `src/multiplayer/server/app/LobbyLifecycleService.ts`
- Pass: module owns lobby/player records, player-lobby index, and lifecycle mutation rules.

21. E-T4 Runtime ownership isolation
- File check: `src/multiplayer/server/app/LobbyRuntimeOrchestrator.ts`
- Pass: module owns runtime map and runtime start/stop/action dispatch.

22. E-T5 Event emission ownership isolation
- File check: `src/multiplayer/server/app/ServerEventPublisher.ts`
- Pass: module owns accepted/rejected and snapshot/lobby/session event emission.

23. E-S1 Multiplayer server smoke
- Setup: start server, connect one client, create solo lobby, enter game, issue one valid game action.
- Pass: no runtime exception and command response + snapshot flow still works.

### F Cleanup and Redundancy Removal

24. F-T1 No compatibility wrapper server class remains
- File check: `src/multiplayer/server/LobbyServer.ts`
- Pass: file removed and no imports reference it.

25. F-T2 No multiplayer store alias remains
- File check: `src/multiplayer/client/multiplayerStore.ts`
- Pass: file removed and no imports reference it.

26. F-T3 Production build after cleanup
- Command: `bun run build`
- Pass: build succeeds and bundle generation completes.

27. F-T4 Documentation reflects final architecture only
- File check: `docs/client_server_store_architecture.md`
- Pass: phase text reflects final module boundaries without compatibility-bridge references.

## A/B Execution Order

Use this exact order while implementing now:

1. A1 -> A2 -> A3 -> A4
2. B1 -> B2 -> B3 -> B4
3. Run AB-T1 and AB-T2
4. Run AB-S1

## C/D Execution Order

Use this exact order while implementing now:

1. C1 -> C2 -> C3 -> C4 -> C5
2. D1 -> D2 -> D3 -> D4
3. Run C-T1 and C-T4
4. Run D-T1, D-T2, D-T3
5. Run D-S1

## E/F Execution Order

Use this exact order while implementing now:

1. E1 -> E2 -> E3 -> E4 -> E5
2. F1 -> F2 -> F3 -> F4 -> F5
3. Run E-T1 and E-T2..E-T5
4. Run F-T1, F-T2, F-T3, F-T4
5. Run E-S1
