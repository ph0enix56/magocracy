import { getBuildingDef, getNextUpgradeDef, getUnitDef } from '../../config/buildings';
import { recomputeHousedArmyUnit } from './armyRuntime';
import type { KingdomTileState } from '../model';
import type { WorldStore } from '../WorldStore';
import type { ResourceMap } from '../../../../shared/domain/types';

export class BuildService {
	constructor(private readonly world: WorldStore) {}

	update(_delta: number, _time: number): void {}

	advanceTick(): void {
		for (const tile of this.world.getKingdomTilesWithBuildings()) {
			const building = tile.building;
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
				const unit = getUnitDef(army.unitDefId);
				if (!unit) throw new Error(`Unknown unitDefId '${army.unitDefId}' for building '${targetId}'`);

				const spawnedUnit = this.world.spawnArmyUnit(army.unitDefId);

				building.housedUnitId = spawnedUnit.armyUnitId;
				recomputeHousedArmyUnit(this.world, tile.tileId);
			}
		}
	}

	startBuild(tileId: string, buildingId: string): void {
		const tile = this.getTileWithThrow(tileId);
		if (tile.building) throw new Error('Tile already has a building');

		const def = getBuildingDef(buildingId);
		if (!def) throw new Error(`Invalid buildingId: ${buildingId}`);
		if (def.parentId) throw new Error(`Cannot build upgrade directly: ${buildingId}`);

		this.deductCostWithThrow(def.cost);
		this.consumeBlueprintWithThrow(buildingId);

		tile.building = {
			buildingId,
			status: 'constructing',
			progress: 0
		};
	}

	startUpgrade(tileId: string, targetBuildingId: string): void {
		const tile = this.getTileWithThrow(tileId);
		if (!tile.building) throw new Error('Tile has no building to upgrade');
		if (tile.building.status !== 'active') throw new Error('Building is not active');

		const nextDef = getNextUpgradeDef(tile.building.buildingId);
		if (!nextDef || nextDef.id !== targetBuildingId) throw new Error('No upgrades available');

		this.deductCostWithThrow(nextDef.cost);
		tile.building.status = 'upgrading';
		tile.building.progress = 0;
		tile.building.upgradeNextId = targetBuildingId;
	}

	destroyBuilding(tileId: string): void {
		const tile = this.getTileWithThrow(tileId);
		if (!tile.building) throw new Error('Tile has no building to destroy');
		const def = getBuildingDef(tile.building.buildingId);
		if (!def) throw new Error(`Invalid buildingId: ${tile.building.buildingId}`);
		if (def.isBlocker) {
			this.deductCostWithThrow(def.cost);
		}
		delete tile.building.housedUnitId;
		delete tile.building;
	}

	private getTileWithThrow(tileId: string): KingdomTileState {
		const tile = this.world.getKingdomTile(tileId);
		if (!tile) throw new Error('Unknown tile.');
		return tile;
	}

	private deductCostWithThrow(cost: ResourceMap): void {
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