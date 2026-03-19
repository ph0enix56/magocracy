import type { ArmyUnitSnapshot, KingdomSnapshot, ResourceSnapshot } from '../../../../shared/multiplayer/protocol';
import { getBuildingDef } from '../../config/buildings';
import { computeNextTrainCost, getTrainCostEffectsForUnit } from '../army/trainCost';
import { getNeighborsFromPositionedEntities } from '../kingdom/neighborLookup';
import type { ArmyUnitComponent, Entity } from '../model';
import { ProductionSystem } from '../systems/ProductionSystem';

export function serializeResources(resources: Map<string, number>): ResourceSnapshot {
	const out: ResourceSnapshot = {};
	for (const [key, value] of resources.entries()) {
		out[key] = value;
	}
	return out;
}

export function serializeInventory(inventory: Map<string, number>): Record<string, number> {
	const out: Record<string, number> = {};
	for (const [key, value] of inventory.entries()) {
		if (value > 0) out[key] = value;
	}
	return out;
}

export function serializeKingdom(entities: Entity[], productionSystem: ProductionSystem): KingdomSnapshot {
	return {
		tiles: entities
			.filter((entity): entity is Entity & { position: NonNullable<Entity['position']> } => !!entity.position)
			.map((entity) => ({
				q: entity.position.q,
				r: entity.position.r,
				building: entity.building
					? {
						buildingId: entity.building.buildingId,
						status: entity.building.status,
						progress: entity.building.progress,
						upgradeNextId: entity.building.upgradeNextId,
						productionMultiplier: entity.building.status === 'active' ? productionSystem.calculateMultiplier(entity) : undefined
					}
					: undefined
			}))
	};
}

export function serializeArmy(units: Array<{ entityId: string; unit: ArmyUnitComponent }>, positionedEntities: Entity[]): ArmyUnitSnapshot[] {
	return units.map(({ entityId, unit }) => ({
		entityId,
		unitId: unit.unitId,
		name: unit.name,
		assetPath: unit.assetPath,
		speed: unit.speed,
		health: unit.health,
		drFlat: unit.drFlat,
		drPercent: unit.drPercent,
		actionsPerTurn: unit.actionsPerTurn,
		trainingLevel: unit.trainingLevel,
		trainingStatus: unit.training.status,
		trainingProgress: unit.training.time > 0 ? (unit.training.progress / unit.training.time) * 100 : 0,
		nextTrainCost: computeSnapshotNextTrainCost(entityId, unit, positionedEntities),
		trainTime: unit.training.time
	}));
}

function computeSnapshotNextTrainCost(unitEntityId: string, unit: ArmyUnitComponent, positionedEntities: Entity[]): Record<string, number> {
	const effects = getTrainCostEffectsForUnit({
		unitEntityId,
		findHousingByUnitId: (entityId) => positionedEntities.find((entity) => entity.building?.housedUnitEntityId === entityId),
		resolveBuildingDef: getBuildingDef,
		getNeighbors: (q, r) => getNeighborsFromPositionedEntities(positionedEntities, q, r)
	});
	return computeNextTrainCost(unit, effects);
}
