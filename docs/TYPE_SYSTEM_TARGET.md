# Type System Target Design

## Goals

1. Keep one canonical type per concept.
2. Remove compatibility aliases that only rename existing types.
3. Keep server runtime state separate from shared transport contracts.
4. Make imports predictable by layer, with no ambiguity about ownership.
5. Minimize migration risk by preserving behavior and wire schema unless explicitly changed.

## Core Principles

1. One concept, one name, one owner file.
2. Domain models describe game concepts, not transport concerns.
3. Contracts describe wire payloads only.
4. Runtime state models are server-internal and never exported as shared API.
5. Avoid "View" and "Snapshot" duplicates for the same shape.

## Final Layering

- Layer A: Server Runtime
  - Location: src/multiplayer/server/gameplay
  - Purpose: mutable simulation state and service internals.
  - Must not be imported by client or shared contracts.

- Layer B: Shared Domain Models
  - Location: src/shared/domain
  - Purpose: canonical, transport-safe game concepts.
  - No Socket.IO envelopes here.

- Layer C: Shared Contracts (Wire DTOs)
  - Location: src/shared/multiplayer/contracts
  - Purpose: command/event envelopes and top-level payload contracts.
  - May compose Layer B types, but should not rename them.

- Layer D: App Consumers
  - Locations: src/multiplayer/client, src/ui, src/game/scenes, src/multiplayer/server/app
  - Purpose: use Layer C contracts directly.

## Minimal Canonical Model Set

### A) Runtime-only (server)

Owner: src/multiplayer/server/gameplay/model.ts

Required runtime models:
1. KingdomTileState
2. BuildingState
3. ArmyUnitState
4. ArmyUnitTrainingState

Notes:
- Runtime keeps mutable instance fields only.
- Runtime identity remains armyUnitId.
- Definition identity remains unitDefId.

### B) Shared domain models

Owners:
- src/shared/domain/resources.ts
- src/shared/domain/types.ts
- src/shared/domain/charter.ts
- src/shared/domain/gameViews.ts (to be renamed in implementation phase)
- src/shared/domain/combatTypes.ts (to be renamed in implementation phase)

Required domain concepts:
1. ResourceKey, KnownResourceMap
2. BuildingStatus, TrainingStatus, AttackAction
3. CharterOption and charter grants
4. Army unit public projection shape
5. Fight army summary shape
6. Combat snapshot unit/log/status shapes

Design direction:
- Replace naming like ArmyUnitView and CombatSnapshotView with canonical concept names.
- Keep the shape, remove duplicate naming.

### C) Wire contracts (DTOs)

Owners:
- src/shared/multiplayer/contracts/commands.ts
- src/shared/multiplayer/contracts/events.ts
- src/shared/multiplayer/contracts/snapshots.ts

Required contract groups:
1. Commands
   - ClientCommand
   - GameActionCommand
2. Events
   - ServerEvent
   - ClientToServerEvents
   - ServerToClientEvents
3. Snapshot payloads
   - Lobby payloads
   - Building catalog payloads
   - Kingdom payloads
   - Army payloads
   - Combat payloads
   - Fight payloads
   - Advance payloads
   - PlayerGameView and GameSnapshot

Rule:
- contracts/snapshots.ts should define payload structures directly or reference canonical domain names directly.
- No alias-only exports such as TypeA = TypeB unless bridging is temporary and documented.

## Naming Rules

1. Runtime types end with State.
2. Domain concept types use plain nouns, no View suffix.
3. Contract payload types use Snapshot suffix only for transport payloads.
4. Do not create both FooView and FooSnapshot for the same shape.
5. Do not create both CharterOption and CharterSnapshot if they are identical; choose one owner and reference it directly.

## Import Rules

1. Runtime layer imports only:
   - server config types
   - shared domain types when needed
   - no client modules
2. Shared domain imports:
   - only other shared domain modules
3. Contracts layer imports:
   - shared domain modules
   - sibling contracts modules
4. Client/UI/server-app imports:
   - contracts modules directly
   - avoid shared/multiplayer/protocol barrel in final state

## Protocol Barrel Policy

Current status: removed (Phase 4 complete)

Target:
1. During migration: keep as temporary compatibility barrel.
2. After migration: remove it.

## Minimal Cleanup Scope (Implementation Next)

1. Remove alias-only type bridges in contracts/snapshots.ts.
2. Remove alias-only UI wrappers in ui/gameState.ts.
3. Migrate imports from protocol barrel to explicit contracts paths.
4. Standardize on one canonical name per shape.
5. Keep wire payload structure stable unless a behavior change is intended.

## Proposed Canonical Ownership Map

- src/shared/domain/resources.ts
  - ResourceKey
  - KnownResourceMap

- src/shared/domain/types.ts
  - AttackAction
  - BuildingStatus
  - TrainingStatus
  - BuildingKind

- src/shared/domain/charter.ts
  - CharterOption
  - CharterResourceGrant
  - CharterBlueprintGrant

- src/shared/domain/gameViews.ts (rename target later)
  - ArmyUnit (currently ArmyUnitView)
  - FightArmyUnitSummary (currently FightArmyUnitSummaryView)

- src/shared/domain/combatTypes.ts (rename target later)
  - CombatUnit
  - CombatLogEntry
  - CombatSnapshot

- src/shared/multiplayer/contracts/snapshots.ts
  - only transport grouping and payload assembly
  - avoid local aliases that duplicate domain names

- src/shared/multiplayer/contracts/commands.ts
  - ClientCommand
  - GameActionCommand

- src/shared/multiplayer/contracts/events.ts
  - ServerEvent
  - ClientToServerEvents
  - ServerToClientEvents

## Migration Plan (Small, Safe Steps)

Phase 1: Contract naming cleanup
1. Replace alias-only exports in contracts/snapshots.ts with direct canonical names.
2. Update imports in affected consumers.
3. Keep protocol barrel still exporting from contracts.

Phase 2: Consumer import cleanup
1. Update server app, client, UI, scene imports to contracts/* paths.
2. Remove local alias wrappers in UI state modules.
3. Validate with tsc and editor diagnostics.

Phase 3: Domain naming cleanup
1. Rename domain types currently using View suffix to canonical nouns.
2. Rename combatTypes View-suffixed types similarly.
3. Update contracts and consumers.

Phase 4: Barrel retirement
1. Remove remaining imports from shared/multiplayer/protocol.
2. Remove protocol.ts file.

## Acceptance Criteria

1. No alias-only type exports left for core payload models.
2. No duplicate names for identical shapes across domain and contracts.
3. No imports from shared/multiplayer/protocol in runtime/client/UI code.
4. Typecheck passes and editor module resolution errors are gone.
5. Runtime State models remain server-internal and are not leaked into contracts.
