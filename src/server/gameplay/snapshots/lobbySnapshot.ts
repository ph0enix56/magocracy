import type { BuildingCatalogEntry, LobbyPlayerSnapshot, LobbySnapshot } from '../../../shared/multiplayer/snapshots';
import { getAllBuildingDefs, getUnitDef } from '../../config/buildings';
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
		kind: def.housedUnitDefId ? 'army' : 'production',
		school: def.school,
		tier: def.tier,
		parentId: def.parentId,
		name: def.name,
		description: def.description,
		assetPath: def.assetPath,
		cost: def.cost,
		buildTime: def.buildTime,
		productions: def.productions,
		housedUnit: def.housedUnitDefId
			? (() => {
				const unitDef = getUnitDef(def.housedUnitDefId);
				if (!unitDef) return undefined;
				return {
					id: unitDef.id,
					name: unitDef.name,
					role: unitDef.role,
					assetPath: unitDef.assetPath,
					health: unitDef.health,
					drFlat: unitDef.drFlat,
					drPercent: unitDef.drPercent,
					initiative: unitDef.initiative,
					actionPoints: unitDef.actionPoints,
					actions: unitDef.actions.map((action) => ({ ...action }))
				};
			})()
			: undefined
	}));
}
