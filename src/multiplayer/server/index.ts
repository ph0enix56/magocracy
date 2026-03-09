import { LobbyServer } from './LobbyServer';

const DEFAULT_PORT = 3001;
const requestedPort = Number.parseInt(process.env['PORT'] ?? `${DEFAULT_PORT}`, 10);
const port = Number.isFinite(requestedPort) ? requestedPort : DEFAULT_PORT;

const server = new LobbyServer();

server.listen(port).then(() => {
	console.log(`Magocracy multiplayer server listening on :${port}`);
});
