import { getBuildingDef } from '../../config/buildings';
import { accumulateEffectsForTargetStat } from '../effects/effectDsl';
import { getNeighborsFromWorld } from '../kingdom/neighborLookup';
import type { KingdomTileState } from '../model';
import type { WorldStore } from '../ServerEcsWorld';

export class ProductionService {
	constructor(private readonly world: WorldStore) {}

	update(_delta: number, _time: number): void {}

	advanceTick(): void {
		const production = new Map<string, number>();

		for (const tile of this.world.getKingdomTilesWithBuildings()) {
			if (tile.building?.status !== 'active') continue;
			const def = getBuildingDef(tile.building.buildingId);
			if (!def?.production) continue;
			for (const [resource, baseAmount] of Object.entries(def.production.productions)) {
				const amount = this.calculateResourceAmount(tile, resource, baseAmount);
				if (amount <= 0) continue;
				production.set(resource, (production.get(resource) || 0) + amount);
			}
		}

		for (const [resource, value] of production) {
			const current = this.world.resources.get(resource) || 0;
			this.world.resources.set(resource, current + value);
		}
	}

	calculateMultiplier(tileId: string): number {
		const tile = this.world.getKingdomTile(tileId);
		if (!tile?.building) return 0;
		const def = getBuildingDef(tile.building.buildingId);
		if (!def?.production) return 0;

		const effects = accumulateEffectsForTargetStat({
			targetTile: tile,
			targetBuildingDef: def,
			targetStat: 'prod:all',
			resolveBuildingDef: getBuildingDef,
			getNeighbors: (q, r) => getNeighborsFromWorld(this.world, q, r)
		});

		return Math.max(0, 1 + effects.mult);
	}

	private calculateResourceAmount(tile: KingdomTileState, resource: string, baseAmount: number): number {
		if (!tile.building) return 0;
		const def = getBuildingDef(tile.building.buildingId);
		if (!def?.production) return 0;

		const allEffects = accumulateEffectsForTargetStat({
			targetTile: tile,
			targetBuildingDef: def,
			targetStat: 'prod:all',
			resolveBuildingDef: getBuildingDef,
			getNeighbors: (q, r) => getNeighborsFromWorld(this.world, q, r)
		});

		const resourceEffects = accumulateEffectsForTargetStat({
			targetTile: tile,
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