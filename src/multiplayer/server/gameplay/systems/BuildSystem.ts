import { getBuildingDef, getNextUpgradeDef, getUnitDef } from '../../config/buildings';
import { recomputeHousedArmyUnit } from './armyRuntime';
import type { Entity } from '../model';
import type { ServerEcsWorld } from '../ServerEcsWorld';

export class BuildSystem {
	constructor(private readonly world: ServerEcsWorld) {}

	update(_delta: number, _time: number): void {}

	advanceTick(): void {
		for (const entity of this.world.getEntitiesWith(['building'])) {
			const building = entity.building;
			if (!building) continue;
			if (building.status !== 'constructing' && building.status !== 'upgrading') continue;

			const previousStatus = building.status;
			const isUpgrading = building.status === 'upgrading';
			const targetId = isUpgrading ? building.upgradeNextId : building.buildingId;
			if (!targetId) continue;

			const targetDef = getBuildingDef(targetId);
			if (!targetDef) continue;

			building.progress += 1;
			if (building.progress < targetDef.buildTime) continue;

			building.progress = targetDef.buildTime;
			if (isUpgrading) {
				building.buildingId = targetId;
				building.upgradeNextId = undefined;
			}
			building.status = 'active';

			if (targetDef.onCompleteGrants) {
				for (const [resource, amount] of Object.entries(targetDef.onCompleteGrants)) {
					const current = this.world.resources.get(resource) || 0;
					this.world.resources.set(resource, current + Math.max(0, Math.floor(amount)));
				}
			}

			if (previousStatus === 'constructing' && targetDef.army) {
				const army = targetDef.army;
				const unit = getUnitDef(army.unitId);
				if (!unit) throw new Error(`Unknown unitId '${army.unitId}' for building '${targetId}'`);

				const spawnedUnitEntity = this.world.spawnArmyUnit({
					unitId: unit.id,
					name: unit.name,
					textureId: unit.textureId,
					assetPath: unit.assetPath,
					speed: unit.speed,
					health: unit.health,
					drFlat: unit.drFlat,
					drPercent: unit.drPercent,
					actionsPerTurn: unit.actionsPerTurn,
					actions: unit.actions.map((action) => ({ ...action })),
					trainingLevel: 0,
					training: {
						status: 'idle',
						progress: 0,
						costBase: army.trainCostBase,
						costMult: army.trainCostMult,
						time: army.trainTime,
						def: {
							health: army.trainDef.health,
							drFlat: army.trainDef.drFlat,
							attackDamage: army.trainDef.attackDamage
						}
					}
				});

				building.housedUnitEntityId = spawnedUnitEntity.id;
				recomputeHousedArmyUnit(this.world, entity.id);
			}
		}
	}

	startBuild(entity: Entity, buildingId: string): void {
		if (entity.building) throw new Error('Entity already has a building');

		const def = getBuildingDef(buildingId);
		if (!def) throw new Error(`Invalid buildingId: ${buildingId}`);
		if (def.parentId) throw new Error(`Cannot build upgrade directly: ${buildingId}`);

		this.deductCostWithThrow(def.cost);
		this.consumeBlueprintWithThrow(buildingId);

		entity.building = {
			buildingId,
			status: 'constructing',
			progress: 0
		};
	}

	startUpgrade(entity: Entity, targetBuildingId: string): void {
		if (!entity.building) throw new Error('Entity has no building to upgrade');
		if (entity.building.status !== 'active') throw new Error('Building is not active');

		const nextDef = getNextUpgradeDef(entity.building.buildingId);
		if (!nextDef || nextDef.id !== targetBuildingId) throw new Error('No upgrades available');

		this.deductCostWithThrow(nextDef.cost);
		entity.building.status = 'upgrading';
		entity.building.progress = 0;
		entity.building.upgradeNextId = targetBuildingId;
	}

	destroyBuilding(entity: Entity): void {
		if (!entity.building) throw new Error('Entity has no building to destroy');
		const def = getBuildingDef(entity.building.buildingId);
		if (!def) throw new Error(`Invalid buildingId: ${entity.building.buildingId}`);
		if (def.isBlocker) {
			this.deductCostWithThrow(def.cost);
		}
		delete entity.building.housedUnitEntityId;
		delete entity.building;
	}

	private deductCostWithThrow(cost: Record<string, number>): void {
		for (const [resource, amount] of Object.entries(cost)) {
			const current = this.world.resources.get(resource) || 0;
			if (current < amount) throw new Error(`Not enough ${resource}`);
		}
		for (const [resource, amount] of Object.entries(cost)) {
			const current = this.world.resources.get(resource) || 0;
			this.world.resources.set(resource, current - amount);
		}
	}

	private consumeBlueprintWithThrow(buildingId: string): void {
		const current = this.world.blueprintInventory.get(buildingId) || 0;
		if (current <= 0) throw new Error('Missing blueprint.');
		const next = current - 1;
		if (next <= 0) this.world.blueprintInventory.delete(buildingId);
		else this.world.blueprintInventory.set(buildingId, next);
	}

}