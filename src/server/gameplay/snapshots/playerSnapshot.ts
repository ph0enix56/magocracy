import type { KingdomSnapshot } from '../../../shared/multiplayer/snapshots';
import type { ArmyUnit } from '../../../shared/domain/gameViews';
import type { ResourceMap } from '../../../shared/domain/types';
import { getBuildingDef, getUnitDef } from '../../config/buildings';
import type { ArmyUnitState, KingdomTileState } from '../model';
import { ProductionService } from '../services/ProductionService';

export function serializeResources(resources: Map<string, number>): ResourceMap {
	const out: ResourceMap = {};
	for (const [key, value] of resources.entries()) {
		out[key] = value;
	}
	return out;
}

export function serializeInventory(inventory: Map<string, number>): ResourceMap {
	const out: ResourceMap = {};
	for (const [key, value] of inventory.entries()) {
		if (value > 0) out[key] = value;
	}
	return out;
}

export function serializeKingdom(tiles: KingdomTileState[], productionService: ProductionService): KingdomSnapshot {
	return {
		tiles: tiles.map((tile) => ({
				q: tile.coord.q,
				r: tile.coord.r,
				isExpansionSite: tile.isExpansionSite,
				building: tile.building
					? (() => {
						const def = getBuildingDef(tile.building.buildingId);
						return {
							buildingId: tile.building.buildingId,
							school: def?.school,
							status: tile.building.status,
							progress: tile.building.progress,
							upgradeNextId: tile.building.upgradeNextId,
							...(tile.building.housedUnitId ? { housedUnitId: tile.building.housedUnitId } : {}),
							productionMultiplier: tile.building.status === 'active' ? productionService.calculateMultiplier(tile.tileId) : undefined
						};
					})()
					: undefined
			}))
	};
}

export function serializeArmy(units: ArmyUnitState[]): ArmyUnit[] {
	return units.map((unit) => {
		const unitDef = getUnitDef(unit.unitDefId);
		return {
			entityId: unit.armyUnitId,
			unitDefId: unit.unitDefId,
			name: unitDef?.name ?? unit.unitDefId,
			role: unitDef?.role ?? 'Fighter',
			assetPath: unitDef?.assetPath ?? '',
			initiative: unit.initiative,
			health: unit.health,
			drFlat: unit.drFlat,
			drPercent: unit.drPercent,
			actionPoints: unit.actionPoints,
			actions: unitDef?.actions.map((action) => ({ ...action })) ?? []
		};
	});
}
