import type { BuildingCatalogEntry, LobbyPlayerSnapshot, LobbySnapshot } from '../../../../shared/multiplayer/contracts/snapshots';
import { getAllBuildingDefs } from '../../config/buildings';
import type { LobbyRecord } from '../../app/lobbyTypes';

export function toLobbySnapshot(lobby: LobbyRecord): LobbySnapshot {
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
		kind: def.isBlocker ? 'blocker' : (def.army ? 'army' : 'production'),
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
