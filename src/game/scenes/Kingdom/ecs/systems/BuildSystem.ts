import type { ECSManager, Entity, System } from '../ECSBase';
import { getBuildingDef, getNextUpgradeDef } from '../../data/buildings';

export class BuildSystem implements System {
	private world: ECSManager;

	constructor(world: ECSManager) {
		this.world = world;
	}

	update(_delta: number, _time: number) {}

	advanceTick(): void {
		for (const entity of this.world.getEntities()) {
			if (!entity.building) continue;
			if (entity.building.status !== 'constructing' && entity.building.status !== 'upgrading') continue;

			const isUpgrading = entity.building.status === 'upgrading';
			const targetId = isUpgrading ? entity.building.upgradeNextId : entity.building.buildingId;
			if (!targetId) continue;

			const targetDef = getBuildingDef(targetId);
			if (!targetDef) continue;

			entity.building.progress += 1;
			if (entity.building.progress >= targetDef.buildTime) {
				entity.building.progress = targetDef.buildTime;
				if (isUpgrading) {
					entity.building.buildingId = targetId;
					entity.building.upgradeNextId = undefined;
				}
				entity.building.status = 'active';
				// TODO: trigger any on-complete effects here
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
