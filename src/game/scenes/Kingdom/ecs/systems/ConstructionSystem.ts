import type { ECSManager } from '../ECSBase';
import type { System } from '../ECSBase';
import { getBuildingDef } from '../../data/buildings';

export class ConstructionSystem implements System {
    private world: ECSManager;

    constructor(world: ECSManager) {
        this.world = world;
    }

    update(delta: number, _time: number) {
        for (const entity of this.world.getEntities()) {
            if (entity.building && entity.building.status === 'constructing') {
                const def = getBuildingDef(entity.building.buildingId);
                if (!def) continue;

                entity.building.progress += delta;
                
                if (entity.building.progress >= def.buildTime * 1000) {
                    entity.building.progress = def.buildTime * 1000;
                    entity.building.status = 'active';
                    console.log(`Building ${def.name} at ${entity.position.q},${entity.position.r} completed!`);
                    // Potentially trigger an event here
                }
            }
        }
    }
}
