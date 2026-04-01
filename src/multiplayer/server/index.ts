import { LobbyApplicationService } from './app/LobbyApplicationService';
import { SocketGateway } from './app/SocketGateway';

const DEFAULT_PORT = 8081;

const port = Number.parseInt(process.env['PORT'] ?? `${DEFAULT_PORT}`);
const gateway = new SocketGateway();
const application = new LobbyApplicationService(gateway);
gateway.setApplication(application);
gateway.listen(port).then(() => {
	console.log(`Magocracy multiplayer server listening on :${port}`);
});
