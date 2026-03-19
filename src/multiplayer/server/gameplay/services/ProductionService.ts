import { getBuildingDef } from '../../config/buildings';
import { accumulateEffectsForTargetStat } from '../effects/effectDsl';
import { getNeighborsFromWorld } from '../kingdom/neighborLookup';
import type { Entity } from '../model';
import type { WorldStore } from '../ServerEcsWorld';

export class ProductionService {
	constructor(private readonly world: WorldStore) {}

	update(_delta: number, _time: number): void {}

	advanceTick(): void {
		const production = new Map<string, number>();

		for (const entity of this.world.getEntitiesWith(['building', 'position'])) {
			if (entity.building?.status !== 'active') continue;
			const def = getBuildingDef(entity.building.buildingId);
			if (!def?.production) continue;
			for (const [resource, baseAmount] of Object.entries(def.production.productions)) {
				const amount = this.calculateResourceAmount(entity, resource, baseAmount);
				if (amount <= 0) continue;
				production.set(resource, (production.get(resource) || 0) + amount);
			}
		}

		for (const [resource, value] of production) {
			const current = this.world.resources.get(resource) || 0;
			this.world.resources.set(resource, current + value);
		}
	}

	calculateMultiplier(entity: Entity): number {
		if (!entity.building || !entity.position) return 0;
		const def = getBuildingDef(entity.building.buildingId);
		if (!def?.production) return 0;

		const effects = accumulateEffectsForTargetStat({
			targetEntity: entity,
			targetBuildingDef: def,
			targetStat: 'prod:all',
			resolveBuildingDef: getBuildingDef,
			getNeighbors: (q, r) => getNeighborsFromWorld(this.world, q, r)
		});

		return Math.max(0, 1 + effects.mult);
	}

	private calculateResourceAmount(entity: Entity, resource: string, baseAmount: number): number {
		if (!entity.building) return 0;
		const def = getBuildingDef(entity.building.buildingId);
		if (!def?.production) return 0;

		const allEffects = accumulateEffectsForTargetStat({
			targetEntity: entity,
			targetBuildingDef: def,
			targetStat: 'prod:all',
			resolveBuildingDef: getBuildingDef,
			getNeighbors: (q, r) => getNeighborsFromWorld(this.world, q, r)
		});

		const resourceEffects = accumulateEffectsForTargetStat({
			targetEntity: entity,
			targetBuildingDef: def,
			targetStat: `prod:${resource}`,
			resolveBuildingDef: getBuildingDef,
			getNeighbors: (q, r) => getNeighborsFromWorld(this.world, q, r)
		});

		const add = allEffects.add + resourceEffects.add;
		const mult = allEffects.mult + resourceEffects.mult;
		return Math.max(0, (baseAmount + add) * (1 + mult));
	}
}