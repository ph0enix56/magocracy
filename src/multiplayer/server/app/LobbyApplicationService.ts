import type { ClientCommand } from '../../../shared/multiplayer/commands';
import { LobbyLifecycleService } from './LobbyLifecycleService';
import { LobbyRuntimeOrchestrator } from './LobbyRuntimeOrchestrator';
import { routeClientCommand } from './CommandRouter';
import { ServerEventPublisher } from './ServerEventPublisher';
import type { LobbyRecord, ServerEventGateway } from './lobbyTypes';

const MAX_PLAYERS_PER_LOBBY = 8;
const MIN_PLAYERS_TO_START = 2;

/**
 * The main application service for the multiplayer server, responsible for managing lobbies, player connections and game runtimes.
 * It responds to client commands received via the {@link SocketGateway}, and uses the gateway to emit server events back to clients and lobbies as needed.
 * Based on the events, it communicates with the {@link RoomGameRuntime} instances that manage the actual game logic and state for active matches
 * happening within their lobbies.
 */
export class LobbyApplicationService {
	private readonly lifecycle: LobbyLifecycleService;
	private readonly runtimeOrchestrator: LobbyRuntimeOrchestrator;
	private readonly eventPublisher: ServerEventPublisher;

	constructor(gateway: ServerEventGateway) {
		this.eventPublisher = new ServerEventPublisher(gateway);
		this.runtimeOrchestrator = new LobbyRuntimeOrchestrator((lobbyId, snapshot) => {
			this.eventPublisher.broadcastGameSnapshot(lobbyId, snapshot);
		});
		this.lifecycle = new LobbyLifecycleService(gateway);
	}

	/**
	 * Callback for when a new player connects to the server. Registers the player and sends them a snapshot
	 * of the current building catalog, defined on the server.
	 * @param playerId ID of the newly connected player.
	 * @param socketId ID of the player's socket, used to identify their connection.
	 */
	handleConnected(playerId: string, socketId: string): void {
		this.eventPublisher.emitSessionConnected(socketId, playerId);
		this.eventPublisher.emitCatalogSnapshot(socketId);
	}
	
	/**
	 * Callback for when a player disconnects from the server. Informs other players in the same lobby and updates the lobby state accordingly.
	 * @param playerId ID of the player who disconnected.
	 */
	handleDisconnected(playerId: string): void {
		const lobby = this.lifecycle.disconnectPlayer(playerId);
		if (!lobby) return;
		this.eventPublisher.broadcastLobbyState(lobby);
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
		const created = this.lifecycle.createLobby(playerId, socketId, playerName, MAX_PLAYERS_PER_LOBBY);
		if (!created.ok) {
			this.eventPublisher.reject(socketId, 'lobby/create', created.reason);
			return;
		}
		for (const retiredLobbyId of created.retiredLobbyIds) {
			this.runtimeOrchestrator.stopLobbyRuntime(retiredLobbyId);
		}
		this.eventPublisher.broadcastLobbyState(created.lobby);
	}

	private handleJoinLobby(playerId: string, socketId: string, lobbyId: string, playerName: string): void {
		const joined = this.lifecycle.joinLobby(playerId, socketId, lobbyId, playerName);
		if (!joined.ok) {
			this.eventPublisher.reject(socketId, 'lobby/join', joined.reason);
			return;
		}
		for (const retiredLobbyId of joined.retiredLobbyIds) {
			this.runtimeOrchestrator.stopLobbyRuntime(retiredLobbyId);
		}
		this.eventPublisher.broadcastLobbyState(joined.lobby);
	}

	private handleLeaveLobby(playerId: string, socketId: string): void {
		const left = this.lifecycle.leaveLobby(playerId, socketId);
		if (!left.ok) {
			this.eventPublisher.reject(socketId, 'lobby/leave', left.reason);
			return;
		}
		for (const retiredLobbyId of left.retiredLobbyIds) {
			this.runtimeOrchestrator.stopLobbyRuntime(retiredLobbyId);
		}
		if (left.lobby) {
			this.eventPublisher.broadcastLobbyState(left.lobby);
		}
	}

	private handleSetReady(playerId: string, ready: boolean): void {
		const lobby = this.lifecycle.setReady(playerId, ready);
		if (!lobby) return;
		this.eventPublisher.broadcastLobbyState(lobby);
	}

	private handleSoloLobby(playerId: string, socketId: string, playerName: string): void {
		const solo = this.lifecycle.createSoloLobby(playerId, socketId, playerName);
		if (!solo.ok) {
			this.eventPublisher.reject(socketId, 'lobby/solo', solo.reason);
			return;
		}
		for (const retiredLobbyId of solo.retiredLobbyIds) {
			this.runtimeOrchestrator.stopLobbyRuntime(retiredLobbyId);
		}
		this.startRuntimeForLobby(solo.lobby, [playerId]);
	}

	private handleStartLobby(playerId: string): void {
		const lobby = this.lifecycle.getLobbyForPlayer(playerId);
		if (!lobby) return;
		if (lobby.hostPlayerId !== playerId) {
			const socketId = this.lifecycle.getSocketIdForPlayer(lobby, playerId);
			if (socketId) this.eventPublisher.reject(socketId, 'lobby/start', 'Only the host can start the lobby.');
			return;
		}
		if (lobby.players.size < MIN_PLAYERS_TO_START) {
			const socketId = this.lifecycle.getSocketIdForPlayer(lobby, playerId);
			if (socketId) this.eventPublisher.reject(socketId, 'lobby/start', 'At least two players are required to start.');
			return;
		}
		const everyoneReady = [...lobby.players.values()].every((player) => player.connected && player.isReady);
		if (!everyoneReady) {
			const socketId = this.lifecycle.getSocketIdForPlayer(lobby, playerId);
			if (socketId) this.eventPublisher.reject(socketId, 'lobby/start', 'All players must be connected and ready.');
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
		const lobby = this.lifecycle.getLobbyForPlayer(playerId);
		if (!lobby) {
			this.eventPublisher.reject(socketId, 'game/action', 'You are not in a lobby.', action.type, requestId);
			return;
		}
		if (lobby.status !== 'in-game') {
			this.eventPublisher.reject(socketId, 'game/action', 'The match has not started yet.', action.type, requestId);
			return;
		}
		const result = this.runtimeOrchestrator.dispatchAction(lobby.lobbyId, playerId, action);
		if (!result.ok) {
			this.eventPublisher.reject(socketId, 'game/action', result.reason, action.type, requestId);
			return;
		}

		this.eventPublisher.accept(socketId, 'game/action', action.type, requestId);
	}

	// HELPER METHODS //

	private startRuntimeForLobby(lobby: LobbyRecord, playerIds: string[]): void {
		lobby.status = 'in-game';
		this.runtimeOrchestrator.startLobbyRuntime(lobby.lobbyId, playerIds);
		this.eventPublisher.broadcastLobbyState(lobby);
		const snapshot = this.runtimeOrchestrator.emitCurrentSnapshot(lobby.lobbyId);
		if (snapshot) {
			this.eventPublisher.broadcastGameSnapshot(lobby.lobbyId, snapshot);
		}
	}
}
