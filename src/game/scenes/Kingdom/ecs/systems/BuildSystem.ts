import type { ECSManager, Entity, System } from '../ECSBase';
import { getBuildingDef, getNextUpgradeDef } from '../../data/buildings';

export class BuildSystem implements System {
	private world: ECSManager;

	constructor(world: ECSManager) {
		this.world = world;
	}

	update(_delta: number, _time: number) {}

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
			if (building.progress >= targetDef.buildTime) {
				building.progress = targetDef.buildTime;
				if (isUpgrading) {
					building.buildingId = targetId;
					building.upgradeNextId = undefined;
				}
				building.status = 'active';

				// Optional building-defined completion hook.
				targetDef.onComplete?.({
					world: this.world,
					entity,
					buildingId: targetId,
					previousStatus
				});

				// Army buildings spawn their unit on completion (construct only).
				if (previousStatus === 'constructing' && targetDef.type === 'army') {
					this.world.spawnArmyUnit({
						unitId: targetDef.unit.id,
						name: targetDef.unit.name,
						textureId: targetDef.unit.textureId,
						assetPath: targetDef.unit.assetPath,
						speed: targetDef.unit.speed,
						health: targetDef.unit.health,
						drFlat: targetDef.unit.drFlat,
						drPercent: targetDef.unit.drPercent,
						actionsPerTurn: targetDef.unit.actionsPerTurn,
						trainingLevel: 0,
						training: {
							status: 'idle',
							progress: 0,
							costBase: targetDef.trainCostBase,
							costMult: targetDef.trainCostMult,
							time: targetDef.trainTime,
							def: {
								health: targetDef.trainDef.health,
								drFlat: targetDef.trainDef.drFlat,
								attackDamage: targetDef.trainDef.attackDamage
							}
						}
					});
					this.world.broadcastArmyState();
				}
			}
		}
	}

	private deductCostWithThrow(cost: Record<string, number>): void {
		for (const [res, amount] of Object.entries(cost)) {
			const current = this.world.resources.get(res) || 0;
			if (current < amount) {
				throw new Error(`Not enough ${res}`);
			}
		}

		for (const [res, amount] of Object.entries(cost)) {
			const current = this.world.resources.get(res) || 0;
			this.world.resources.set(res, current - amount);
		}
	}

	private consumeBlueprintWithThrow(buildingId: string): void {
		const current = this.world.blueprintInventory.get(buildingId) || 0;
		if (current <= 0) {
			throw new Error('Missing blueprint.');
		}
		const next = current - 1;
		if (next <= 0) this.world.blueprintInventory.delete(buildingId);
		else this.world.blueprintInventory.set(buildingId, next);
	}

	startBuild(entity: Entity, buildingId: string) {
		if (entity.building) {
			throw new Error('Entity already has a building');
		}

		const def = getBuildingDef(buildingId);
		if (!def) {
			throw new Error(`Invalid buildingId: ${buildingId}`);
		}
		if (def.parentId) {
			throw new Error(`Cannot build upgrade directly: ${buildingId}`);
		}

		this.deductCostWithThrow(def.cost);
		this.consumeBlueprintWithThrow(buildingId);

		entity.building = {
			buildingId: buildingId,
			status: 'constructing',
			progress: 0
		};
	}

	startUpgrade(entity: Entity, targetBuildingId: string) {
		if (!entity.building) {
			throw new Error('Entity has no building to upgrade');
		}
		if (entity.building.status !== 'active' ) {
			throw new Error('Building is not active');
		}

		const currentId = entity.building.buildingId;
		const nextDef = getNextUpgradeDef(currentId);
		if (!nextDef || nextDef.id !== targetBuildingId) {
			throw new Error(`No upgrades available`);
		}

		this.deductCostWithThrow(nextDef.cost);

		entity.building.status = 'upgrading';
		entity.building.progress = 0;
		entity.building.upgradeNextId = targetBuildingId;
	}

	destroyBuilding(entity: Entity) {
		if (!entity.building) {
			throw new Error('Entity has no building to destroy');
		}
		
		const def = getBuildingDef(entity.building.buildingId);
		if (!def) {
			throw new Error(`Invalid buildingId: ${entity.building.buildingId}`);
		}

		if (def.type === 'blocking') {
			// blockers: player must pay their cost
			this.deductCostWithThrow(def.cost);
			delete entity.building;
		} else {
			delete entity.building;
		}
	}
}
