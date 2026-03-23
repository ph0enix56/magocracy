import type { LobbyStatus, ServerEvent } from '../../../shared/multiplayer/protocol';

export type PlayerRecord = {
	playerId: string;
	name: string;
	isReady: boolean;
	connected: boolean;
	socketId: string;
};

export type LobbyRecord = {
	lobbyId: string;
	hostPlayerId: string;
	status: LobbyStatus;
	maxPlayers: number;
	createdAt: number;
	players: Map<string, PlayerRecord>;
};

/**
 * An interface for sending server events to client connections, as well as managing client-lobby memberships.
 * Implemented by {@link SocketGateway}.
 */
export interface ServerEventGateway {
	/**
	 * Sends a server event to a specific client.
	 * @param connectionId Target client connection ID.
	 * @param event Server event to send.
	 */
	emitToClient(connectionId: string, event: ServerEvent): void;

	/**
	 * Broadcasts a server event to all clients in a lobby.
	 * @param lobbyId Target lobby ID.
	 * @param event Server event to broadcast.
	 */
	broadcastToLobby(lobbyId: string, event: ServerEvent): void;

	/**
	 * Joins a client to a lobby, making them receive future broadcasts to that lobby.
	 * @param connectionId Client connection ID.
	 * @param lobbyId Target lobby ID.
	 */
	joinToLobby(connectionId: string, lobbyId: string): void;

	/**
	 * Removes a client from a lobby, preventing them from receiving future broadcasts to that lobby.
	 * @param connectionId Client connection ID.
	 * @param lobbyId Target lobby ID.
	 */
	leaveFromLobby(connectionId: string, lobbyId: string): void;
};
