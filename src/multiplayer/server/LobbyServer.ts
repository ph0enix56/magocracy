import { createServer, type Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server, type Socket } from 'socket.io';
import type {
	ClientCommand,
	ClientToServerEvents,
	GameSnapshot,
	LobbyPlayerSnapshot,
	LobbySnapshot,
	ServerEvent,
	ServerToClientEvents
} from '../../shared/multiplayer/protocol';

const MAX_PLAYERS_PER_LOBBY = 8;
const MIN_PLAYERS_TO_START = 2;

type PlayerRecord = {
	playerId: string;
	name: string;
	isReady: boolean;
	connected: boolean;
	socketId: string;
};

type LobbyRecord = {
	lobbyId: string;
	hostPlayerId: string;
	status: 'open' | 'in-game';
	maxPlayers: number;
	createdAt: number;
	players: Map<string, PlayerRecord>;
};

type MultiplayerSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

function createLobbyId(): string {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let out = '';
	for (let i = 0; i < 6; i += 1) {
		out += alphabet[Math.floor(Math.random() * alphabet.length)] ?? 'X';
	}
	return out;
}

export class LobbyServer {
	private readonly httpServer: HttpServer;
	private readonly io: Server<ClientToServerEvents, ServerToClientEvents>;
	private readonly lobbies = new Map<string, LobbyRecord>();
	private readonly playerLobbyIndex = new Map<string, string>();

	constructor() {
		this.httpServer = createServer();
		this.io = new Server<ClientToServerEvents, ServerToClientEvents>(this.httpServer, {
			cors: {
				origin: '*'
			}
		});
		this.io.on('connection', (socket: MultiplayerSocket) => this.handleConnection(socket));
	}

	listen(port: number): Promise<void> {
		return new Promise((resolve) => {
			this.httpServer.listen(port, () => resolve());
		});
	}

	private handleConnection(socket: MultiplayerSocket): void {
		const playerId = randomUUID();
		socket.data.playerId = playerId;
		this.emitToSocket(socket, { type: 'session/connected', playerId });

		socket.on('command', (command: ClientCommand) => {
			try {
				this.handleCommand(socket, command);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				this.emitToSocket(socket, { type: 'system/error', message });
			}
		});

		socket.on('disconnect', () => {
			this.handleDisconnect(playerId);
		});
	}

	private handleCommand(socket: MultiplayerSocket, command: ClientCommand): void {
		switch (command.type) {
			case 'lobby/create':
				this.handleCreateLobby(socket, command.playerName);
				return;
			case 'lobby/join':
				this.handleJoinLobby(socket, command.lobbyId, command.playerName);
				return;
			case 'lobby/leave':
				this.handleLeaveLobby(socket.data.playerId as string);
				return;
			case 'lobby/set-ready':
				this.handleSetReady(socket.data.playerId as string, command.ready);
				return;
			case 'lobby/start':
				this.handleStartLobby(socket.data.playerId as string);
				return;
			case 'game/action':
				this.reject(socket, 'game/action', 'Authoritative multiplayer gameplay bridge is not wired yet.');
				return;
		}
	}

	private handleCreateLobby(socket: MultiplayerSocket, playerName: string): void {
		const playerId = socket.data.playerId as string;
		this.handleLeaveLobby(playerId);

		let lobbyId = createLobbyId();
		while (this.lobbies.has(lobbyId)) {
			lobbyId = createLobbyId();
		}

		const lobby: LobbyRecord = {
			lobbyId,
			hostPlayerId: playerId,
			status: 'open',
			maxPlayers: MAX_PLAYERS_PER_LOBBY,
			createdAt: Date.now(),
			players: new Map()
		};
		this.lobbies.set(lobbyId, lobby);
		this.addOrUpdatePlayer(socket, lobby, playerName);
	}

	private handleJoinLobby(socket: MultiplayerSocket, lobbyId: string, playerName: string): void {
		const playerId = socket.data.playerId as string;
		const lobby = this.lobbies.get(lobbyId);
		if (!lobby) {
			this.reject(socket, 'lobby/join', 'Lobby not found.');
			return;
		}
		if (lobby.status !== 'open') {
			this.reject(socket, 'lobby/join', 'Lobby already started.');
			return;
		}
		if (lobby.players.size >= lobby.maxPlayers && !lobby.players.has(playerId)) {
			this.reject(socket, 'lobby/join', 'Lobby is full.');
			return;
		}

		this.handleLeaveLobby(playerId);
		this.addOrUpdatePlayer(socket, lobby, playerName);
	}

	private handleLeaveLobby(playerId: string): void {
		const lobbyId = this.playerLobbyIndex.get(playerId);
		if (!lobbyId) return;
		const lobby = this.lobbies.get(lobbyId);
		if (!lobby) {
			this.playerLobbyIndex.delete(playerId);
			return;
		}

		const record = lobby.players.get(playerId);
		if (record) {
			const socket = this.io.sockets.sockets.get(record.socketId);
			socket?.leave(lobbyId);
		}
		lobby.players.delete(playerId);
		this.playerLobbyIndex.delete(playerId);

		if (lobby.hostPlayerId === playerId) {
			const nextHost = lobby.players.values().next().value as PlayerRecord | undefined;
			if (nextHost) lobby.hostPlayerId = nextHost.playerId;
		}

		if (lobby.players.size === 0) {
			this.lobbies.delete(lobbyId);
			return;
		}

		this.broadcastLobbyState(lobby);
	}

	private handleSetReady(playerId: string, ready: boolean): void {
		const lobby = this.getLobbyForPlayer(playerId);
		if (!lobby) return;
		const player = lobby.players.get(playerId);
		if (!player) return;
		player.isReady = ready;
		this.broadcastLobbyState(lobby);
	}

	private handleStartLobby(playerId: string): void {
		const lobby = this.getLobbyForPlayer(playerId);
		if (!lobby) return;
		if (lobby.hostPlayerId !== playerId) {
			const socket = this.getSocketForPlayer(lobby, playerId);
			if (socket) this.reject(socket, 'lobby/start', 'Only the host can start the lobby.');
			return;
		}
		if (lobby.players.size < MIN_PLAYERS_TO_START) {
			const socket = this.getSocketForPlayer(lobby, playerId);
			if (socket) this.reject(socket, 'lobby/start', 'At least two players are required to start.');
			return;
		}
		const everyoneReady = [...lobby.players.values()].every((player) => player.connected && player.isReady);
		if (!everyoneReady) {
			const socket = this.getSocketForPlayer(lobby, playerId);
			if (socket) this.reject(socket, 'lobby/start', 'All players must be connected and ready.');
			return;
		}

		lobby.status = 'in-game';
		this.broadcastLobbyState(lobby);
		this.broadcastToLobby(lobby.lobbyId, {
			type: 'game/snapshot',
			game: this.buildInitialGameSnapshot(lobby)
		});
	}

	private handleDisconnect(playerId: string): void {
		const lobby = this.getLobbyForPlayer(playerId);
		if (!lobby) return;
		const player = lobby.players.get(playerId);
		if (!player) return;
		player.connected = false;
		player.isReady = false;
		this.broadcastLobbyState(lobby);
	}

	private addOrUpdatePlayer(socket: MultiplayerSocket, lobby: LobbyRecord, playerName: string): void {
		const playerId = socket.data.playerId as string;
		lobby.players.set(playerId, {
			playerId,
			name: playerName.trim() || `Mage-${playerId.slice(0, 4)}`,
			isReady: false,
			connected: true,
			socketId: socket.id
		});
		this.playerLobbyIndex.set(playerId, lobby.lobbyId);
		socket.join(lobby.lobbyId);
		this.broadcastLobbyState(lobby);
	}

	private getLobbyForPlayer(playerId: string): LobbyRecord | undefined {
		const lobbyId = this.playerLobbyIndex.get(playerId);
		if (!lobbyId) return undefined;
		return this.lobbies.get(lobbyId);
	}

	private getSocketForPlayer(lobby: LobbyRecord, playerId: string): MultiplayerSocket | undefined {
		const player = lobby.players.get(playerId);
		if (!player) return undefined;
		return this.io.sockets.sockets.get(player.socketId) as MultiplayerSocket | undefined;
	}

	private broadcastLobbyState(lobby: LobbyRecord): void {
		this.broadcastToLobby(lobby.lobbyId, { type: 'lobby/state', lobby: this.toLobbySnapshot(lobby) });
	}

	private toLobbySnapshot(lobby: LobbyRecord): LobbySnapshot {
		const players: LobbyPlayerSnapshot[] = [...lobby.players.values()].map((player) => ({
			playerId: player.playerId,
			name: player.name,
			isHost: lobby.hostPlayerId === player.playerId,
			isReady: player.isReady,
			connected: player.connected
		}));
		return {
			lobbyId: lobby.lobbyId,
			status: lobby.status,
			hostPlayerId: lobby.hostPlayerId,
			maxPlayers: lobby.maxPlayers,
			players,
			createdAt: lobby.createdAt
		};
	}

	private buildInitialGameSnapshot(lobby: LobbyRecord): GameSnapshot {
		return {
			tick: 0,
			phase: 'setup',
			players: [...lobby.players.values()].map((player) => ({
				playerId: player.playerId,
				resources: {},
				blueprints: {},
				army: [],
				combat: {
					status: 'idle',
					round: 0,
					activeSide: 'armyA',
					armyA: [],
					armyB: [],
					log: []
				}
			}))
		};
	}

	private reject(socket: MultiplayerSocket, commandType: ClientCommand['type'], reason: string): void {
		this.emitToSocket(socket, { type: 'command/rejected', commandType, reason });
	}

	private emitToSocket(socket: MultiplayerSocket, event: ServerEvent): void {
		socket.emit('event', event);
	}

	private broadcastToLobby(lobbyId: string, event: ServerEvent): void {
		this.io.to(lobbyId).emit('event', event);
	}
}
