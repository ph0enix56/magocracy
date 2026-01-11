import type { ECSManager } from '../ECSBase';
import type { System } from '../ECSBase';
import { getBuildingDef } from '../../data/buildings';

export class UpgradeSystem implements System {
	private world: ECSManager;

	constructor(world: ECSManager) {
		this.world = world;
	}

	update(delta: number, _time: number) {
		for (const entity of this.world.getEntities()) {
			if (!entity.building) continue;
			if (entity.building.status !== 'active') continue;
			if (!entity.building.upgrade) continue;

			const targetId = entity.building.upgrade.targetBuildingId;
			const targetDef = getBuildingDef(targetId);
			if (!targetDef) {
				// Invalid upgrade target; cancel.
				delete entity.building.upgrade;
				continue;
			}

			entity.building.upgrade.progress += delta;
			if (entity.building.upgrade.progress >= targetDef.buildTime * 1000) {
				entity.building.buildingId = targetId;
				delete entity.building.upgrade;
			}
		}
	}
}
