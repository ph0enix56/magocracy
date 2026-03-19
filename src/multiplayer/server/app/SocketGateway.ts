import { createServer, type Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server, type Socket } from 'socket.io';
import type { ClientCommand, ClientToServerEvents, ServerEvent, ServerToClientEvents } from '../../../shared/multiplayer/protocol';
import type { LobbyApplicationService } from './LobbyApplicationService';
import type { GatewayPort } from './lobbyTypes';

type MultiplayerSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export class SocketGateway implements GatewayPort {
	private readonly httpServer: HttpServer;
	private readonly io: Server<ClientToServerEvents, ServerToClientEvents>;
	private application: LobbyApplicationService | null = null;

	constructor() {
		this.httpServer = createServer();
		this.io = new Server<ClientToServerEvents, ServerToClientEvents>(this.httpServer, {
			cors: {
				origin: '*'
			}
		});
		this.io.on('connection', (socket: MultiplayerSocket) => this.handleConnection(socket));
	}

	setApplication(application: LobbyApplicationService): void {
		this.application = application;
	}

	listen(port: number): Promise<void> {
		return new Promise((resolve) => {
			this.httpServer.listen(port, () => resolve());
		});
	}

	emitToSocket(socketId: string, event: ServerEvent): void {
		const socket = this.io.sockets.sockets.get(socketId) as MultiplayerSocket | undefined;
		socket?.emit('event', event);
	}

	broadcastToLobby(lobbyId: string, event: ServerEvent): void {
		this.io.to(lobbyId).emit('event', event);
	}

	joinSocketToLobby(socketId: string, lobbyId: string): void {
		const socket = this.io.sockets.sockets.get(socketId) as MultiplayerSocket | undefined;
		socket?.join(lobbyId);
	}

	leaveSocketFromLobby(socketId: string, lobbyId: string): void {
		const socket = this.io.sockets.sockets.get(socketId) as MultiplayerSocket | undefined;
		socket?.leave(lobbyId);
	}

	private handleConnection(socket: MultiplayerSocket): void {
		if (!this.application) {
			socket.emit('event', { type: 'system/error', message: 'Lobby application service is not configured.' });
			socket.disconnect(true);
			return;
		}

		const playerId = randomUUID();
		socket.data.playerId = playerId;
		this.application.handleConnected({ playerId, socketId: socket.id });

		socket.on('command', (command: ClientCommand) => {
			try {
				this.application?.handleCommand({ playerId, socketId: socket.id, command });
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				socket.emit('event', { type: 'system/error', message });
			}
		});

		socket.on('disconnect', () => {
			this.application?.handleDisconnected({ playerId });
		});
	}
}
