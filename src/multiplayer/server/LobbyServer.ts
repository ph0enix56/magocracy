import { LobbyApplicationService } from './app/LobbyApplicationService';
import { SocketGateway } from './app/SocketGateway';

/**
 * Compatibility wrapper kept for stable imports while transport and application
 * concerns live in dedicated classes.
 */
export class LobbyServer {
	private readonly gateway: SocketGateway;
	private readonly application: LobbyApplicationService;

	constructor() {
		this.gateway = new SocketGateway();
		this.application = new LobbyApplicationService(this.gateway);
		this.gateway.setApplication(this.application);
	}

	listen(port: number): Promise<void> {
		return this.gateway.listen(port);
	}
}
