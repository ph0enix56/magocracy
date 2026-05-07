# Magocracy

Magocracy is a real-time multiplayer web strategy game, developed as a diploma thesis project.
In the game, you build your magical city, manage resources, summon powerful armies and battle other players to become the most renowned leader.
Play instructions are provided inside the game client by clicking the "?" button in the top right corner.
Further details about the design and development process (in Czech) can be found in the diploma thesis "Magocracy – webová strategická hra pro více hráčů" published at FIT CTU in Prague.

## Running and Development

This project is a monorepository containing both an authoritative multiplayer server, which must be running at all times when the game is played, and a game client application, which can be served via a local development server, or bundled into static files for hosting on a regular web server.
Based on use case, there are three primary ways to run and interact with the project:

### 1. Best for local testing (Docker Compose)
Automated launch of the entire stack on the local network, using one command without needing to install local runtimes or dependencies.

1.  Ensure you have [Docker](https://www.docker.com/) with Docker Compose installed and available.
2.  Run: `docker compose up dev`
3.  The application will be available at `http://localhost:8080`.
    *   *Note: Code changes on your host machine will be reflected inside the running container via volume mounts.*

### 2. Best for full development suite (Bun Runtime)
This approach is best for active development due easy access to all scripts and tools directly on your development machine.

1.  Install the [Bun](https://bun.sh/) runtime on your development machine.
2.  Install the project dependencies: `bun install`
3.  The following scripts are available, executed via `bun run <script>`:
    *   `server:dev`: Start the multiplayer server on port 8081 with restarts on code changes.
    *   `server:prod --port <number>`: Start the multiplayer server in production mode on a specified port.
    *   `client:dev`: Start a local dev server serving the client on port 8080, configured to connect to the multiplayer server launched via `server:dev`. Supports Hot Module Replacement on code changes.
    *   `client:smoke`: Same as `dev`, but automatically open the game in the browser in solo sandbox mode for quick testing.
    *   `client:build`: Build and bundle the client files for deployment on a web server. Before running, the `SERVER_URL` environment variable must be set to the public-facing URL of the multiplayer server. The output files are placed in the `dist` directory and can be copied to any static hosting solution.
    *   `test`: Run all unit test suites.

### 3. Best for distributed deployment (Production)
Catered for deployment to a remote server (cloud) for running the game publicly.

*  **Server**:
    1. On the machine running the multiplayer server, run: `docker compose up server`.
    2. Container platforms can make use of the `Dockerfile.prod` directly, changing the exposed port as needed.
*  **Client**:
    1.   Obtain the public-facing URL of your running server (e.g., `http://your-ip:8081`).
    2.   On a development machine (see method 2), build the client for production: `SERVER_URL=http://your-ip:8081 bun run client:build`
    3.   Upload the contents of the `dist` folder to your web server or CDN.

## Project overview

Magocracy client is built using TypeScript, with the Phaser framework used as a renderer for the underlying graphics, and with UI components on top of it built using Svelte.
The game is designed to be played in a web browser, and it uses WebSockets for real-time communication between the client and server.

The server is built using TypeScript, with Socket.IO used for handling WebSocket connections and communication between the client and server.

More technical details can be found in the aforementioned thesis.

### Codebase structure

The simplified structure of the codebase is as follows:

- `public/`: Contains static assets for the game, to be publicly served as-is; like CSS, images, fonts.
- `src/`: Contains the source code for the game, including both client and server code.
	- `game/`: Entire client-side game application, combining rendering, UI, and client communication logic.
		- `client/`: Client-side code for managing communication with the server and providing the shared client session store.
		- `render/`: Phaser rendering engine code - Phaser acts as a renderer and user input handler, getting its data from the shared client state. Logic is kept to a minimum.
		- `ui/`: Svelte components for the user interface, including the main game UI overlaid on top of the Phaser canvas, as well as the lobby screen.
	- `server/`: Server-side code for processing communication with clients and managing the authoritative game state.
		- `app/`: Core server modules for client-server communication, lobby and game runtime management.
        - `config/`: Definitions of the game objects and their stat values - districts, units, charters, game settings, as well as their parsers. These can be changed/extended to modify the game rules and contents.
        - `gameplay/`: Modules responsible for the core game logic and storing the game state.
    - `shared/`: Shared types, utilities, and constants between client and server.
- `tests/`: Contains unit tests, with the structure mirroring that of the `src/` directory.
- `vite/`: Contains configuration for Vite, the build tool used for the project.
- `index.html`: The main HTML file for the game, which loads the entry point script module.
- `package.json`: Contains the project dependencies and scripts for building and running the game.
- `svelte.config.js`: Configuration for Svelte, including Vite preprocessing.
- `tsconfig.json`: TypeScript configuration for the project.

## Attribution

The icons for game elements (districts, units, navigation) used in this project are sourced from [Game-icons.net](https://game-icons.net), which were created by [Lorc](https://lorcblog.blogspot.com/), [Delapouite](https://delapouite.com/) and other contributors.
These icons are provided under the [CC BY 3.0](http://creativecommons.org/licenses/by/3.0/) license.

The favicon, resource and other UI icons are sourced from the [twemoji](https://github.com/twitter/twemoji) project, created by Twitter Inc, and other contributors, available at https://github.com/twitter/twemoji/blob/a6f943b958d94b2b82f886aa540b915d9a694a75/assets/svg/1f52e.svg. Twemoji is available under the [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) license.
