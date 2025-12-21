import type { ECSManager, Entity } from '../ECSBase';
import type { System } from '../ECSBase';
import { eventBus } from '../../../../../eventBus';
import { getBuildingDef } from '../../data/buildings';

export class ProductionSystem implements System {
    private world: ECSManager;
    private timer: number = 0;
    private readonly TICK_RATE = 1000; // Resources update every 1 second

    constructor(world: ECSManager) {
        this.world = world;
    }

    update(delta: number, _time: number) {
        this.timer += delta;
        if (this.timer < this.TICK_RATE) return;
        
        // Process one tick
        while (this.timer >= this.TICK_RATE) {
            this.timer -= this.TICK_RATE;
            this.produceResources();
        }
    }

    public calculateMultiplier(entity: Entity): number {
        if (!entity.building) return 0;
        const def = getBuildingDef(entity.building.buildingId);
        if (!def || def.type !== 'production') return 0;

        let multiplier = 1.0;
        const neighbors = this.getNeighbors(entity.position.q, entity.position.r);
        
        // 1. Self Modifier (based on neighbors)
        if (def.calculateSelfModifier) {
            multiplier += def.calculateSelfModifier(entity, neighbors);
        }

        // 2. Incoming Modifiers from Neighbors (buffs)
        for (const neighbor of neighbors) {
            if (neighbor.building && neighbor.building.status === 'active') {
                const neighborDef = getBuildingDef(neighbor.building.buildingId);
                if (neighborDef && neighborDef.getNeighborModifier) {
                    multiplier += neighborDef.getNeighborModifier(neighbor, entity);
                }
            }
        }
        return multiplier;
    }

    private produceResources() {
        const production = new Map<string, number>();

        for (const entity of this.world.getEntities()) {
            if (entity.building && entity.building.status === 'active') {
                const def = getBuildingDef(entity.building.buildingId);
                if (!def || def.type !== 'production') continue;

                const multiplier = this.calculateMultiplier(entity);

                // Apply production
                for (const [res, baseAmount] of Object.entries(def.productions)) {
                    const amount = baseAmount * multiplier;
                    if (amount > 0) {
                        const current = production.get(res) || 0;
                        production.set(res, current + amount);
                    }
                }
            }
        }

        // Apply to global state and notify UI
        for (const [key, value] of production) {
            const current = this.world.resources.get(key) || 0;
            const newValue = current + value;
            this.world.resources.set(key, newValue);
            eventBus.publishGameToUi({
                type: 'resource-updated',
                key: key,
                value: newValue
            });
        }
    }

    private getNeighbors(q: number, r: number) {
        // Simple neighbor check - this is O(N) which is bad for large maps, 
        // but fine for small ones. A GridSystem with a 2D array lookup would be better.
        // For now, let's just scan entities.
        const neighbors = [];
        
        // Neighbors in doubled coords:
        // (q+1, r+1), (q+2, r), (q+1, r-1), (q-1, r-1), (q-2, r), (q-1, r+1)
        
        const doubledDirections = [
            { dq: 1, dr: 1 }, { dq: 2, dr: 0 }, { dq: 1, dr: -1 },
            { dq: -1, dr: -1 }, { dq: -2, dr: 0 }, { dq: -1, dr: 1 }
        ];

        for (const dir of doubledDirections) {
            const nQ = q + dir.dq;
            const nR = r + dir.dr;
            const neighbor = this.world.getEntities().find(e => e.position.q === nQ && e.position.r === nR);
            if (neighbor) neighbors.push(neighbor);
        }
        return neighbors;
    }
}
