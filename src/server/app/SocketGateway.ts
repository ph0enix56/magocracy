import { createServer, type Server as HttpServer } from 'http';
import { randomUUID } from 'crypto';
import { Server, type Socket } from 'socket.io';
import type { ClientCommand } from '../../shared/multiplayer/commands';
import type { ClientToServerEvents, ServerEvent, ServerToClientEvents } from '../../shared/multiplayer/events';
import type { LobbyApplicationService } from './LobbyApplicationService';
import type { ServerEventGateway } from './lobbyTypes';

type MultiplayerSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * A Socket.IO-based gateway implementation that handles client connections, as well as
 * sending client commands to the server app and emitting server events back to lobbies or individual clients.
 * It acts as the transport layer for the multiplayer server, while logic and game state are managed by the {@link LobbyApplicationService}.
 */
export class SocketGateway implements ServerEventGateway {
	private readonly httpServer: HttpServer;
	private readonly io: Server<ClientToServerEvents, ServerToClientEvents>;
	private application: LobbyApplicationService | null = null;

	// Creates a raw HTTP server and a Socket.IO server on top, and sets up a handler for new client connections.
	constructor() {
		this.httpServer = createServer();
		this.io = new Server<ClientToServerEvents, ServerToClientEvents>(this.httpServer, {
			cors: { origin: '*' }
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

	emitToClient(socketId: string, event: ServerEvent): void {
		const socket: MultiplayerSocket | undefined = this.io.sockets.sockets.get(socketId);
		socket?.emit('event', event);
	}

	broadcastToLobby(lobbyId: string, event: ServerEvent): void {
		this.io.to(lobbyId).emit('event', event);
	}

	joinToLobby(socketId: string, lobbyId: string): void {
		const socket: MultiplayerSocket | undefined = this.io.sockets.sockets.get(socketId);
		socket?.join(lobbyId);
	}

	leaveFromLobby(socketId: string, lobbyId: string): void {
		const socket: MultiplayerSocket | undefined = this.io.sockets.sockets.get(socketId);
		socket?.leave(lobbyId);
	}

	// Register a new player with the app service, and set up handler for incoming client commands and disconnections.
	private handleConnection(socket: MultiplayerSocket): void {
		if (!this.application) {
			socket.emit('event', { type: 'system/error', message: 'Startup failure: Lobby application service is not configured.' });
			socket.disconnect(true);
			return;
		}

		const playerId = randomUUID();
		socket.data.playerId = playerId;
		this.application.handleConnected(playerId, socket.id);

		socket.on('command', (command: ClientCommand) => {
			try {
				this.application?.handleCommand(playerId, socket.id, command);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				socket.emit('event', { type: 'system/error', message });
			}
		});

		socket.on('disconnect', () => {
			this.application?.handleDisconnected(playerId);
		});
	}
}
