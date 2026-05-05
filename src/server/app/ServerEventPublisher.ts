import type { ClientCommand, GameActionCommand } from '../../shared/multiplayer/commands';
import type { GameSnapshot } from '../../shared/multiplayer/snapshots';
import { buildBuildingCatalog, toLobbySnapshot } from '../gameplay/snapshots/lobbySnapshot';
import type { LobbyRecord, ServerEventGateway } from './lobbyTypes';

/**
 * Emits server-side events through the gateway while keeping payload schemas
 * centralized and consistent with shared multiplayer contracts.
 */
export class ServerEventPublisher {
	constructor(private readonly gateway: ServerEventGateway) {}

	/** Announces a successful transport session handshake to one client. */
	emitSessionConnected(socketId: string, playerId: string): void {
		this.gateway.emitToClient(socketId, { type: 'session/connected', playerId });
	}

	/** Sends authoritative building catalog snapshot to one client. */
	emitCatalogSnapshot(socketId: string): void {
		this.gateway.emitToClient(socketId, { type: 'catalog/snapshot', catalog: { buildings: buildBuildingCatalog() } });
	}

	/** Broadcasts lobby membership and readiness state to all lobby participants. */
	broadcastLobbyState(lobby: LobbyRecord): void {
		this.gateway.broadcastToLobby(lobby.lobbyId, { type: 'lobby/state', lobby: toLobbySnapshot(lobby) });
	}

	/** Sends lobby state snapshot directly to one client. */
	emitLobbyState(socketId: string, lobby: LobbyRecord | null): void {
		this.gateway.emitToClient(socketId, { type: 'lobby/state', lobby: lobby ? toLobbySnapshot(lobby) : null });
	}

	/** Broadcasts authoritative gameplay snapshot to all lobby participants. */
	broadcastGameSnapshot(lobbyId: string, game: GameSnapshot): void {
		this.gateway.broadcastToLobby(lobbyId, { type: 'game/snapshot', game });
	}

	/** Emits command rejection to one client using shared wire schema. */
	reject(
		socketId: string,
		commandType: ClientCommand['type'] | GameActionCommand['type'],
		reason: string,
		actionType?: GameActionCommand['type'],
		requestId?: string
	): void {
		this.gateway.emitToClient(socketId, { type: 'command/rejected', commandType, actionType, requestId, reason });
	}

	/** Emits command acceptance to one client using shared wire schema. */
	accept(
		socketId: string,
		commandType: ClientCommand['type'] | GameActionCommand['type'],
		actionType?: GameActionCommand['type'],
		requestId?: string
	): void {
		this.gateway.emitToClient(socketId, { type: 'command/accepted', commandType, actionType, requestId });
	}
}
