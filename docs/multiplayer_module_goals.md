# Multiplayer codebase modules - refactoring goals

For now, focus only on the multiplayer/ and shared/ modules of the codebase, only update other modules if necessary to support the changes in multiplayer/shared code. Do not reintroduce any changes that would go against the TYPE_SYSTEM_TARGET goals, such as creating new alias-only exports or importing from the protocol barrel in runtime code. Do not keep legacy code for compatibility purposes, perform full refactors with the goal of creating a final clean codebase with one clear design and ownership boundaries, with no compatibility layers or temporary migration code.

## shared/combat/combatCore.ts
- Combat logic originally extracted from Phaser scenes, no Phaser dependencies.
- Now in use only by server services.
- Goal: rethink whether it should be moved under server code and unified with remaining combat logic happening on the server.

## multiplayer/server/lobby/lobbyProjection.ts
- What is the purpose of defining own LobbyLike and LobbyPlayerLike, when being called, domain entities are already passed with no transformation?
- Making snapshots and building catalog entries should ideally be unified with other server-side projection logic, not be defined in a separate file.
- Goal: unify with other server-side projection logic, remove unnecessary types.

## multiplayer/server/RoomGameRuntime.ts
- It is still the largest module by far, and contains a lot of logic not directly related to the runtime itself, but rather to combat replay sessions and phase management.
- In terms of managing the runtime lifecycle, Advance and Fight were added gradually as the need arose, and the code is not very cohesive. Since there are not many processes shared between the phases, consider implementing a proper state machine approach with separate modules for handling the logic of each phase, and the main runtime class only delegating to them and managing the lifecycle/transitions between them.
- Goal: should read similarly to LobbyApplicationService on the other side of command handling, clearly only delegating commands to other game services and managing the runtime lifecycle.

## multiplayer/server/gameplay structure
- Adapt the folder and module structure to align with the refactors to RoomGameRuntime, making it clear where the logic for each phase lives, which modules relate to which concerns. Consider unifying with the "shared" combat core and kingdom grid logic, if they are not meaningfully used elsewhere.
- Also check the remaining exported types from these gameplay modules, as per the type system refactors, no externally used types should be defined in these modules, and if they are needed by other modules, they should be moved to the approriate layers (shared domain or contracts).
- Goal: create a clear modular structure easily navigable and extendable for future phases and features, with clear ownership boundaries and no confusion about where to put new code related to a certain feature or phase.
