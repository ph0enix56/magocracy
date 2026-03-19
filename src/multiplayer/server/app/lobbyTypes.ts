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

export type GatewayPort = {
	emitToSocket(socketId: string, event: ServerEvent): void;
	broadcastToLobby(lobbyId: string, event: ServerEvent): void;
	joinSocketToLobby(socketId: string, lobbyId: string): void;
	leaveSocketFromLobby(socketId: string, lobbyId: string): void;
};
