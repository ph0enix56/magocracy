import type { BuildingCatalogEntry, LobbyPlayerSnapshot, LobbySnapshot, LobbyStatus } from '../../../shared/multiplayer/protocol';
import { getAllBuildingDefs } from '../config/buildings';

type LobbyPlayerLike = {
	playerId: string;
	name: string;
	isReady: boolean;
	connected: boolean;
};

type LobbyLike = {
	lobbyId: string;
	status: LobbyStatus;
	hostPlayerId: string;
	maxPlayers: number;
	createdAt: number;
	players: Map<string, LobbyPlayerLike>;
};

export function toLobbySnapshot(lobby: LobbyLike): LobbySnapshot {
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

export function buildBuildingCatalog(): BuildingCatalogEntry[] {
	return getAllBuildingDefs().map((def) => ({
		id: def.id,
		school: def.school,
		tier: def.tier,
		parentId: def.parentId,
		isBlocker: def.isBlocker,
		name: def.name,
		description: def.description,
		textureId: def.textureId,
		assetPath: def.assetPath,
		cost: def.cost,
		buildTime: def.buildTime
	}));
}
