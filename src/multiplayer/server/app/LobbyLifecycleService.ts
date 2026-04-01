import type { LobbyRecord, PlayerRecord, ServerEventGateway } from './lobbyTypes';

const LOBBY_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type LifecycleMutationResult =
	| { ok: true; lobby: LobbyRecord; retiredLobbyIds: string[] }
	| { ok: false; reason: string };

export type LeaveLobbyResult =
	| { ok: true; lobby: LobbyRecord | null; retiredLobbyIds: string[] }
	| { ok: false; reason: string };

/**
 * Owns lobby and player lifecycle state: creation, membership, readiness,
 * host assignment, and player-lobby indexing.
 */
export class LobbyLifecycleService {
	private readonly lobbies = new Map<string, LobbyRecord>();
	private readonly playerLobbyIndex = new Map<string, string>();

	constructor(private readonly gateway: ServerEventGateway) {}

	/** Marks a connected player's current lobby record as disconnected. */
	disconnectPlayer(playerId: string): LobbyRecord | undefined {
		const lobby = this.getLobbyForPlayer(playerId);
		if (!lobby) return undefined;
		const player = lobby.players.get(playerId);
		if (!player) return undefined;
		player.connected = false;
		player.isReady = false;
		return lobby;
	}

	/** Creates a new open lobby and places the player in it as host. */
	createLobby(playerId: string, socketId: string, playerName: string, maxPlayers: number): LifecycleMutationResult {
		const detached = this.detachFromCurrentOpenLobby(playerId, socketId);
		if (!detached.ok) return detached;

		const lobby = this.createOpenLobbyRecord(playerId, maxPlayers);
		this.upsertLobbyPlayer(lobby, playerId, socketId, playerName, false);
		return { ok: true, lobby, retiredLobbyIds: detached.retiredLobbyIds };
	}

	/** Joins an existing open lobby after leaving the player's current open lobby, if any. */
	joinLobby(playerId: string, socketId: string, lobbyId: string, playerName: string): LifecycleMutationResult {
		const lobby = this.lobbies.get(lobbyId);
		if (!lobby) {
			return { ok: false, reason: 'Lobby not found.' };
		}
		if (lobby.status !== 'open') {
			return { ok: false, reason: 'Lobby already started.' };
		}
		if (lobby.players.size >= lobby.maxPlayers && !lobby.players.has(playerId)) {
			return { ok: false, reason: 'Lobby is full.' };
		}

		const detached = this.detachFromCurrentOpenLobby(playerId, socketId);
		if (!detached.ok) return detached;

		this.upsertLobbyPlayer(lobby, playerId, socketId, playerName, false);
		return { ok: true, lobby, retiredLobbyIds: detached.retiredLobbyIds };
	}

	/** Creates a solo lobby and starts with the player ready. */
	createSoloLobby(playerId: string, socketId: string, playerName: string): LifecycleMutationResult {
		const detached = this.detachFromCurrentOpenLobby(playerId, socketId);
		if (!detached.ok) return detached;

		const lobby = this.createOpenLobbyRecord(playerId, 1);
		this.upsertLobbyPlayer(lobby, playerId, socketId, playerName, true);
		return { ok: true, lobby, retiredLobbyIds: detached.retiredLobbyIds };
	}

	/** Leaves the player's current open lobby. In-game lobbies reject leave attempts. */
	leaveLobby(playerId: string, socketId: string): LeaveLobbyResult {
		return this.detachFromCurrentOpenLobby(playerId, socketId);
	}

	/** Updates ready state for a player in their current lobby. */
	setReady(playerId: string, ready: boolean): LobbyRecord | undefined {
		const lobby = this.getLobbyForPlayer(playerId);
		if (!lobby) return undefined;
		const player = lobby.players.get(playerId);
		if (!player) return undefined;
		player.isReady = ready;
		return lobby;
	}

	getLobbyById(lobbyId: string): LobbyRecord | undefined {
		return this.lobbies.get(lobbyId);
	}

	getLobbyForPlayer(playerId: string): LobbyRecord | undefined {
		const lobbyId = this.playerLobbyIndex.get(playerId);
		if (!lobbyId) return undefined;
		return this.lobbies.get(lobbyId);
	}

	getSocketIdForPlayer(lobby: LobbyRecord, playerId: string): string | undefined {
		const player = lobby.players.get(playerId);
		if (!player) return undefined;
		return player.socketId;
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

	private createLobbyId(): string {
		let out = '';
		for (let i = 0; i < 6; i += 1) {
			out += LOBBY_ID_ALPHABET[Math.floor(Math.random() * LOBBY_ID_ALPHABET.length)] ?? 'X';
		}
		return out;
	}

	private upsertLobbyPlayer(
		lobby: LobbyRecord,
		playerId: string,
		socketId: string,
		playerName: string,
		isReady: boolean
	): void {
		const nextPlayer: PlayerRecord = {
			playerId,
			name: this.normalizePlayerName(playerId, playerName),
			isReady,
			connected: true,
			socketId
		};
		lobby.players.set(playerId, nextPlayer);
		this.playerLobbyIndex.set(playerId, lobby.lobbyId);
		this.gateway.joinToLobby(socketId, lobby.lobbyId);
	}

	private normalizePlayerName(playerId: string, playerName: string): string {
		const trimmed = playerName.trim();
		if (trimmed.length > 0) return trimmed;
		return `Mage-${playerId.slice(0, 4)}`;
	}

	private detachFromCurrentOpenLobby(playerId: string, socketId: string): LeaveLobbyResult {
		const lobbyId = this.playerLobbyIndex.get(playerId);
		if (!lobbyId) {
			return { ok: true, lobby: null, retiredLobbyIds: [] };
		}

		const lobby = this.lobbies.get(lobbyId);
		if (!lobby) {
			this.playerLobbyIndex.delete(playerId);
			return { ok: true, lobby: null, retiredLobbyIds: [] };
		}

		if (lobby.status === 'in-game') {
			return { ok: false, reason: 'Leaving an active match is not supported yet.' };
		}

		const existingRecord = lobby.players.get(playerId);
		const existingSocketId = existingRecord?.socketId ?? socketId;
		this.gateway.leaveFromLobby(existingSocketId, lobbyId);
		lobby.players.delete(playerId);
		this.playerLobbyIndex.delete(playerId);

		if (lobby.hostPlayerId === playerId) {
			const nextHost = lobby.players.values().next().value as PlayerRecord | undefined;
			if (nextHost) {
				lobby.hostPlayerId = nextHost.playerId;
			}
		}

		if (lobby.players.size === 0) {
			this.lobbies.delete(lobbyId);
			return { ok: true, lobby: null, retiredLobbyIds: [lobbyId] };
		}

		return { ok: true, lobby, retiredLobbyIds: [] };
	}
}
