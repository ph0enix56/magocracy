import { getBuildingDef } from '../../config/buildings';
import { accumulateEffectsForTargetStat } from '../effects/effectDsl';
import { getNeighborsFromWorld } from '../kingdom/neighborLookup';
import type { KingdomTileState } from '../model';
import type { WorldStore } from '../WorldStore';

/**
 * Computes and applies resource production for all active production buildings each game tick.
 * Production amounts are calculated using the effect DSL, which accumulates additive and
 * multiplicative modifiers from self and neighboring buildings.
 */
export class ProductionService {
	constructor(private readonly world: WorldStore) {}

	/** Applies production output from all active production buildings to the player's resources. */
	advanceTick(): void {
		const production = new Map<string, number>();

		for (const tile of this.world.getKingdomTilesWithBuildings()) {
			if (tile.building?.status !== 'active') continue;
			const def = getBuildingDef(tile.building.buildingId);
			if (!def?.productions) continue;
			for (const [resource, baseAmount] of Object.entries(def.productions)) {
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

	/**
	 * Calculates the effective production amount for a given resource from a specific tile,
	 * after applying additive and multiplicative neighbor effects from the DSL.
	 * Returns 0 if the tile has no active building with production for the resource.
	 */
	public calculateResourceAmount(tile: KingdomTileState, resource: string, baseAmount: number): number {
		if (!tile.building) return 0;
		const def = getBuildingDef(tile.building.buildingId);
		if (!def?.productions) return 0;

		const resourceEffects = accumulateEffectsForTargetStat({
			targetTile: tile,
			targetBuildingDef: def,
			targetStat: `prod:${resource}`,
			resolveBuildingDef: getBuildingDef,
			getNeighbors: (q, r) => getNeighborsFromWorld(this.world, q, r)
		});

		return Math.max(0, Math.floor((baseAmount + resourceEffects.add) * (1 + resourceEffects.mult)));
	}
}