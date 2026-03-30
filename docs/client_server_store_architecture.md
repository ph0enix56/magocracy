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

- Move component-specific derivations from Svelte components to `src/ui/projections/*` modules.
- Reduce direct dependencies on `gameSessionState` in UI components.
- Keep only shared selectors in `src/ui/gameState.ts`.

### Phase D - Kingdom Scene Projection Isolation

- Narrow `KingdomScene` subscriptions to dedicated projection stores.
- Avoid full-state subscription-driven relayout on unrelated updates.

### Phase E - Server Application Service Decomposition

- Split lobby lifecycle, runtime orchestration, and response emission responsibilities in server app layer.
- Preserve wire contracts and authoritative runtime behavior.

### Phase F - Final Cleanup and Redundancy Removal

- Remove obsolete modules and aliases.
- Update docs to final architecture only.
- Ensure no compatibility bridge modules remain.

## Acceptance Tests

Each test has a deterministic pass condition. Tests are grouped by phase and should be run in CI and locally.

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

## A/B Execution Order

Use this exact order while implementing now:

1. A1 -> A2 -> A3 -> A4
2. B1 -> B2 -> B3 -> B4
3. Run AB-T1 and AB-T2
4. Run AB-S1
