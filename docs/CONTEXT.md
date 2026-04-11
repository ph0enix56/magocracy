# Project context

Overview of the project and its technologies, as well as guidelines for implementing new features and fixing bugs in the project.

## Technical overview

The multiplayer game Magocracy is built using TypeScript, with the Phaser framework used as a renderer for the underlying graphics, and with UI components on top of it built using Svelte.
The game is designed to be played in a web browser, and it uses WebSockets for real-time communication between the client and server.
The server is built using pure TypeScript and can be run using Node or similar JavaScript runtime.
Socket.IO is used for handling WebSocket connections and communication between the client and server.

### Code structure

The codebase is organized into several directories, each serving a specific purpose:

- `docs/`: Contains documentation for the project, including this context document and any other relevant documentation for developers.
- `public/`: Contains static assets for the game, publicly served by the server - CSS, images, fonts
- `src/`: Contains the source code for the game, including both client and server code.
	- `game/`: Phaser related code - Phaser acts as a renderer and user input handler, getting its data from the shared client state. Logic is kept to a minimum.
		- `main.ts`: Phaser game configuration and initialization.
		- `configuration.ts`: All game configuration values and constants, split into objects based on concerns (economy, render, game phases, etc.).
		- `scenes/Kingdom/`: The only game scene, containing the kingdom grid.
			- `projection/`: modules related to projecting the game state onto the screen, including rendering the grid and handling user input. 
			- `KingdomScene.ts`: The main scene file, responsible for setting up the scene, managing its lifecycle and handling user input.
	- `multiplayer/`: Code related to multiplayer functionality, including the server and client communication logic.
		- `client/`: Client-side code for managing communaication with the server, routing client commands and handling incoming messages via WebSockets to the server; updates the session store based on the server's messages, allowing the game UI to react to changes in the game state.
			- `session/`: Helper code related to managing the session store and validating user commands before sending them to the server.
		- `server/`: Server-side code for processing communication with clients and managing the authoritative game state. The server includes all services responsible for the game logic and central state management.
			- `app/`: Modules responsible for handling the client-server communaication and lobby lifecycle management, spinning up game runtimes when a game starts and routing messages between them and clients.
			- `config/`: Definitions of the game objects and their stat values - buildings, units, charters, as well as parsers for loading them from JSON files and related type definitions.
			- `gameplay/`: Modules responsible for the core game logic and storing the game state. The main logic modules are the phase runtimes for each of the 3 game phases. These are built using the State pattern - each phase runtime has methods for processing its relevant commands, ticking the game loop and starting/ending the phase. Specific game logic is implemented in the services, used by the phase runtimes.
			- `index.ts`: Entry point for the server.
			- `RoomGameRuntime.ts`: Main module for managing the game runtime for a specific game room, driving the phase runtimes and their transitions and emitting the game state to clients.
	- `shared/`: Shared code between the client and server.
		- `domain/`: Type definitions for the game domain.
		- `kingdom/`: Utility functions for working with the kingdom hex grid.
		- `multiplayer/`: Type definitions for the command and message shapes used in client-server communication, as well as DTOs for the game state snapshots sent to clients.
		- `ui`/: Objects and utility functions shared between the Phaser renderer and Svelte UI, mostly tile and background themes.
	- `ui/`: Svelte components for the user interface, including the main game UI overlaid on top of the Phaser canvas, as well as the lobby screen.
		- `projections/`: Derivations of the full session store, subscribed by Svelte components so that each component can update only when relevant changes occur in the session store.
		- `main-ui.ts`: Mount point for the Svelte app.
	- `main.ts`: Entry point for the Phaser game.
- `tests/`: Contains unit tests, with the structure mirroring that of the `src/` directory.
- `vite/`: Contains configuration for Vite, the build tool used for the project.
- `index.html`: The main HTML file for the game, which loads the entry point script modules for Phaser and Svelte.
- `package.json`: Contains the project dependencies and scripts for building and running the game.
- `svelte.config.js`: Configuration for Svelte, including Vite preprocessing.
- `tsconfig.json`: TypeScript configuration for the project.

### Current end-to-end flow

1. UI component triggers an action through game session client API.
2. gameSessionStore validates basic client-side preconditions and sends a command via MultiplayerClient.
3. SocketGateway and LobbyApplicationService route the command to RoomGameRuntime.
4. Active server phase runtime validates and mutates authoritative state.
5. Server emits command response plus latest game snapshot.
6. MultiplayerClient updates local snapshot state and notifies subscribers.
7. gameSessionStore rebuilds its derived state and pushes to Svelte store.
8. UI components and game scene projections re-render from store updates.

### Tooling

The entire project is built using TypeScript.
Bun is used as the main module bundler and task runner, delegating to Vite for building the client and running its HMR dev server.

## Guidelines

When designing and implementing new features, follow these principles to maintain a clean and consistent architecture.

### Core design principles

1. Single source of truth per concern.
2. No god modules, one responsibility per module. Comment on classes and public functions via JSDoc.
3. Proper usage of types following OOP principles. Use clear domain modeling in types to reflect the underlying concepts, keep one canonical type per concept. No ad-hoc type unions, "any" types, or aliases that only rename existing types. Exported, reusable types should be defined in dedicated type files, residing in the shared folder.
4. Function signatures (names and their parameters) should be explicit and descriptive. Avoid overloading functions with multiple responsibilities. Avoid functions that take convoluted parameter types or too many parameters. In that case, consider breaking the function down into smaller, or using a pre-defined parameter object type, see point 3.
5. Follow predictable, separated, data flow from server snapshot to UI rendering, and from client command to server processing.
6. Keep minimal coupling between transport, domain, and presentation state. Store modules are small, testable, with clear ownership.
7. Input validation is always performed on the edges of the relevant system boundary, never in nested modules. Client-side validation is simple for immediate UI feedback, and only takes into account input possible using an unmodified UI client. Server-side validation is the authority for all game rules and input integrity/security (player permissions, command validity in current state, etc.). Avoid duplication of validation logic on client and server.
9. When implementing new features, evaluate the fit into the existing architecture and patterns. Consider whether the architecture needs to be refactored to accommodate it, rather than adding special cases or exceptions to the existing architecture, making it unnecessarily complex and layered. If a refactor is beneficial, report it and follow point 10.
10. When performing architecture refactors, do not incrementally layer or mix old and new patterns. No temporary "bridge" or "glue" code. Instead, perform a full refactor of the relevant modules and their dependencies to fit into a clean, well-structured architecture. Check for and remove any existing code that already is or will be redundant or obsolete in the final architecture.
11. When making behavioral or interface changes, always check current unit tests and update them accordingly. If there are no or insufficient tests for the relevant modules, ensure proper test coverage for them, including in features that were not directly changed.

### Acceptance criteria

After any feature implementation or bug fix, ensure that the following criteria are met:

1. Code follows the core design principles outlined above.
2. `bunx tsc --noEmit` runs without any type errors.
3. If Svelte components were changed, svelte-check runs without any errors.
4. `bun run build` builds the client without errors and warnings.
5. `bun run server:test` runs all server tests and they pass.
6. `bun run server:start` starts the server without errors and warnings.
7. If making code structure changes, update this context document to reflect the changes.
