import type { KingdomSnapshot } from '../../../../shared/multiplayer/contracts/snapshots';
import type { ArmyUnit } from '../../../../shared/domain/gameViews';
import type { ResourceMap } from '../../../../shared/domain/types';
import { getBuildingDef, getUnitDef } from '../../config/buildings';
import { computeNextTrainCost, getTrainCostEffectsForUnit } from '../army/trainCost';
import { getNeighborsFromTiles } from '../kingdom/neighborLookup';
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
							productionMultiplier: tile.building.status === 'active' ? productionService.calculateMultiplier(tile.tileId) : undefined
						};
					})()
					: undefined
			}))
	};
}

export function serializeArmy(units: ArmyUnitState[], tiles: KingdomTileState[]): ArmyUnit[] {
	return units.map((unit) => {
		const unitDef = getUnitDef(unit.unitDefId);
		const housingTile = tiles.find((tile) => tile.building?.housedUnitId === unit.armyUnitId);
		const housingDef = housingTile?.building ? getBuildingDef(housingTile.building.buildingId) : undefined;
		const trainTime = housingDef?.army ? Math.max(0, Math.floor(housingDef.army.trainTime)) : 0;
		return {
			entityId: unit.armyUnitId,
			unitDefId: unit.unitDefId,
			name: unitDef?.name ?? unit.unitDefId,
		assetPath: unitDef?.assetPath ?? '',
		initiative: unit.initiative,
		health: unit.health,
		drFlat: unit.drFlat,
		drPercent: unit.drPercent,
		actionPoints: unit.actionPoints,
		trainingLevel: unit.trainingLevel,
		trainingStatus: unit.training.status,
			trainingProgress: trainTime > 0 ? (unit.training.progress / trainTime) * 100 : 0,
		nextTrainCost: computeSnapshotNextTrainCost(unit.armyUnitId, unit, tiles),
			trainTime
		};
	});
}

function computeSnapshotNextTrainCost(unitEntityId: string, unit: ArmyUnitState, tiles: KingdomTileState[]): ResourceMap {
	const housingTile = tiles.find((tile) => tile.building?.housedUnitId === unitEntityId);
	const housingDef = housingTile?.building ? getBuildingDef(housingTile.building.buildingId) : undefined;
	if (!housingDef?.army) return {};

	const effects = getTrainCostEffectsForUnit({
		unitEntityId,
		findHousingByUnitId: (entityId) => tiles.find((tile) => tile.building?.housedUnitId === entityId),
		resolveBuildingDef: getBuildingDef,
		getNeighbors: (q, r) => getNeighborsFromTiles(tiles, q, r)
	});
	return computeNextTrainCost(unit, housingDef.army.trainCostBase, housingDef.army.trainCostMult, effects);
}
