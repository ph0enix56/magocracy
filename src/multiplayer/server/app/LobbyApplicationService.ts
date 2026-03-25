import type { ClientCommand, GameActionCommand } from '../../../shared/multiplayer/contracts/commands';
import { RoomGameRuntime } from '../RoomGameRuntime.ts';
import { buildBuildingCatalog, toLobbySnapshot } from '../gameplay/snapshots/lobbySnapshot';
import { routeClientCommand } from './CommandRouter';
import type { ServerEventGateway, LobbyRecord, PlayerRecord } from './lobbyTypes';

const MAX_PLAYERS_PER_LOBBY = 8;
const MIN_PLAYERS_TO_START = 2;

/**
 * The main application service for the multiplayer server, responsible for managing lobbies, player connections and game runtimes.
 * It responds to client commands received via the {@link SocketGateway}, and uses the gateway to emit server events back to clients and lobbies as needed.
 * Based on the events, it communicates with the {@link RoomGameRuntime} instances that manage the actual game logic and state for active matches
 * happening within their lobbies.
 */
export class LobbyApplicationService {
	private readonly lobbies = new Map<string, LobbyRecord>();
	private readonly playerLobbyIndex = new Map<string, string>();
	private readonly gameRuntimes = new Map<string, RoomGameRuntime>();

	constructor(private readonly gateway: ServerEventGateway) {}

	/**
	 * Callback for when a new player connects to the server. Registers the player and sends them a snapshot
	 * of the current building catalog, defined on the server.
	 * @param playerId ID of the newly connected player.
	 * @param socketId ID of the player's socket, used to identify their connection.
	 */
	handleConnected(playerId: string, socketId: string): void {
		this.gateway.emitToClient(socketId, { type: 'session/connected', playerId });
		this.gateway.emitToClient(socketId, { type: 'catalog/snapshot', catalog: { buildings: buildBuildingCatalog() } });
	}
	
	/**
	 * Callback for when a player disconnects from the server. Informs other players in the same lobby and updates the lobby state accordingly.
	 * @param playerId ID of the player who disconnected.
	 */
	handleDisconnected(playerId: string): void {
		const lobby = this.getLobbyForPlayer(playerId);
		if (!lobby) return;
		const player = lobby.players.get(playerId);
		if (!player) return;
		player.connected = false;
		player.isReady = false;
		this.broadcastLobbyState(lobby);
	}

	/**
	 * Callback for incoming client commands. For each command type, a handler method is registered with corresponding
	 * player/socket IDs bound, so that the router can invoke them with the correct context. See {@link CommandRouter} for details on command routing.
	 * @param playerId ID of the player who sent the command.
	 * @param socketId ID of the player's socket, used to identify their connection for sending responses.
	 * @param command The client command that was sent, containing the type and relevant payload.
	 */
	handleCommand(playerId: string, socketId: string, command: ClientCommand): void {
		routeClientCommand(command, {
			onCreate: (playerName) => this.handleCreateLobby(playerId, socketId, playerName),
			onJoin: (lobbyId, playerName) => this.handleJoinLobby(playerId, socketId, lobbyId, playerName),
			onLeave: () => this.handleLeaveLobby(playerId, socketId),
			onSetReady: (ready) => this.handleSetReady(playerId, ready),
			onStartLobby: () => this.handleStartLobby(playerId),
			onSolo: (playerName) => this.handleSoloLobby(playerId, socketId, playerName),
			onGameAction: (gameActionCommand) => this.handleGameAction(playerId, socketId, gameActionCommand)
		});
	}

	// COMMAND HANDLERS //

	private handleCreateLobby(playerId: string, socketId: string, playerName: string): void {
		this.handleLeaveLobby(playerId, socketId);
		const lobby = this.createOpenLobbyRecord(playerId, MAX_PLAYERS_PER_LOBBY);
		this.addOrUpdatePlayer(playerId, socketId, lobby, playerName);
	}

	private handleJoinLobby(playerId: string, socketId: string, lobbyId: string, playerName: string): void {
		const lobby = this.lobbies.get(lobbyId);
		if (!lobby) {
			this.reject(socketId, 'lobby/join', 'Lobby not found.');
			return;
		}
		if (lobby.status !== 'open') {
			this.reject(socketId, 'lobby/join', 'Lobby already started.');
			return;
		}
		if (lobby.players.size >= lobby.maxPlayers && !lobby.players.has(playerId)) {
			this.reject(socketId, 'lobby/join', 'Lobby is full.');
			return;
		}

		this.handleLeaveLobby(playerId, socketId);
		this.addOrUpdatePlayer(playerId, socketId, lobby, playerName);
	}

	private handleLeaveLobby(playerId: string, socketId: string): void {
		const lobbyId = this.playerLobbyIndex.get(playerId);
		if (!lobbyId) return;
		const lobby = this.lobbies.get(lobbyId);
		if (!lobby) {
			this.playerLobbyIndex.delete(playerId);
			return;
		}

		if (lobby.status === 'in-game') {
			this.reject(socketId, 'lobby/leave', 'Leaving an active match is not supported yet.');
			return;
		}

		const record = lobby.players.get(playerId);
		if (record) {
			this.gateway.leaveFromLobby(record.socketId, lobbyId);
		}
		lobby.players.delete(playerId);
		this.playerLobbyIndex.delete(playerId);

		if (lobby.hostPlayerId === playerId) {
			const nextHost = lobby.players.values().next().value as PlayerRecord | undefined;
			if (nextHost) lobby.hostPlayerId = nextHost.playerId;
		}

		if (lobby.players.size === 0) {
			this.gameRuntimes.get(lobbyId)?.stop();
			this.gameRuntimes.delete(lobbyId);
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

	private handleSoloLobby(playerId: string, socketId: string, playerName: string): void {
		this.handleLeaveLobby(playerId, socketId);
		const lobby = this.createOpenLobbyRecord(playerId, 1);

		lobby.players.set(playerId, {
			playerId,
			name: playerName.trim() || `Mage-${playerId.slice(0, 4)}`,
			isReady: true,
			connected: true,
			socketId
		});
		this.playerLobbyIndex.set(playerId, lobby.lobbyId);
		this.gateway.joinToLobby(socketId, lobby.lobbyId);

		this.startRuntimeForLobby(lobby, [playerId]);
	}

	private handleStartLobby(playerId: string): void {
		const lobby = this.getLobbyForPlayer(playerId);
		if (!lobby) return;
		if (lobby.hostPlayerId !== playerId) {
			const socketId = this.getSocketIdForPlayer(lobby, playerId);
			if (socketId) this.reject(socketId, 'lobby/start', 'Only the host can start the lobby.');
			return;
		}
		if (lobby.players.size < MIN_PLAYERS_TO_START) {
			const socketId = this.getSocketIdForPlayer(lobby, playerId);
			if (socketId) this.reject(socketId, 'lobby/start', 'At least two players are required to start.');
			return;
		}
		const everyoneReady = [...lobby.players.values()].every((player) => player.connected && player.isReady);
		if (!everyoneReady) {
			const socketId = this.getSocketIdForPlayer(lobby, playerId);
			if (socketId) this.reject(socketId, 'lobby/start', 'All players must be connected and ready.');
			return;
		}

		this.startRuntimeForLobby(lobby, [...lobby.players.keys()]);
	}

	private handleGameAction(
		playerId: string,
		socketId: string,
		command: Extract<ClientCommand, { type: 'game/action' }>
	): void {
		const { action, requestId } = command;
		const lobby = this.getLobbyForPlayer(playerId);
		if (!lobby) {
			this.reject(socketId, 'game/action', 'You are not in a lobby.', action.type, requestId);
			return;
		}
		if (lobby.status !== 'in-game') {
			this.reject(socketId, 'game/action', 'The match has not started yet.', action.type, requestId);
			return;
		}
		const runtime = this.gameRuntimes.get(lobby.lobbyId);
		if (!runtime) {
			this.reject(socketId, 'game/action', 'Missing authoritative game runtime.', action.type, requestId);
			return;
		}

		const result = runtime.handleAction(playerId, action);
		if (!result.ok) {
			this.reject(socketId, 'game/action', result.reason, action.type, requestId);
			return;
		}

		this.accept(socketId, 'game/action', action.type, requestId);
	}

	// HELPER METHODS //

	private addOrUpdatePlayer(playerId: string, socketId: string, lobby: LobbyRecord, playerName: string): void {
		lobby.players.set(playerId, {
			playerId,
			name: playerName.trim() || `Mage-${playerId.slice(0, 4)}`,
			isReady: false,
			connected: true,
			socketId
		});
		this.playerLobbyIndex.set(playerId, lobby.lobbyId);
		this.gateway.joinToLobby(socketId, lobby.lobbyId);
		this.broadcastLobbyState(lobby);
	}

	private createLobbyId(): string {
		const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
		let out = '';
		for (let i = 0; i < 6; i += 1) {
			out += alphabet[Math.floor(Math.random() * alphabet.length)] ?? 'X';
		}
		return out;
	}

	private createOpenLobbyRecord(hostPlayerId: string, maxPlayers: number): LobbyRecord {
		let lobbyId = this.createLobbyId();
		while (this.lobbies.has(lobbyId)) {
			lobbyId = this.createLobbyId();
		}

		const lobby: LobbyRecord = {
			lobbyId,
			hostPlayerId,
			status: 'open',
			maxPlayers,
			createdAt: Date.now(),
			players: new Map()
		};
		this.lobbies.set(lobbyId, lobby);
		return lobby;
	}

	private startRuntimeForLobby(lobby: LobbyRecord, playerIds: string[]): void {
		lobby.status = 'in-game';
		const runtime = new RoomGameRuntime(playerIds, (snapshot) => {
			this.gateway.broadcastToLobby(lobby.lobbyId, { type: 'game/snapshot', game: snapshot });
		});
		runtime.start();
		this.gameRuntimes.set(lobby.lobbyId, runtime);
		this.broadcastLobbyState(lobby);
		this.gateway.broadcastToLobby(lobby.lobbyId, { type: 'game/snapshot', game: runtime.emitSnapshot() });
	}

	private getLobbyForPlayer(playerId: string): LobbyRecord | undefined {
		const lobbyId = this.playerLobbyIndex.get(playerId);
		if (!lobbyId) return undefined;
		return this.lobbies.get(lobbyId);
	}

	private getSocketIdForPlayer(lobby: LobbyRecord, playerId: string): string | undefined {
		const player = lobby.players.get(playerId);
		if (!player) return undefined;
		return player.socketId;
	}

	private broadcastLobbyState(lobby: LobbyRecord): void {
		this.gateway.broadcastToLobby(lobby.lobbyId, { type: 'lobby/state', lobby: toLobbySnapshot(lobby) });
	}

	private reject(
		socketId: string,
		commandType: ClientCommand['type'] | GameActionCommand['type'],
		reason: string,
		actionType?: GameActionCommand['type'],
		requestId?: string
	): void {
		this.gateway.emitToClient(socketId, { type: 'command/rejected', commandType, actionType, requestId, reason });
	}

	private accept(
		socketId: string,
		commandType: ClientCommand['type'] | GameActionCommand['type'],
		actionType?: GameActionCommand['type'],
		requestId?: string
	): void {
		this.gateway.emitToClient(socketId, { type: 'command/accepted', commandType, actionType, requestId });
	}
}
