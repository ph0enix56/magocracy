import { recomputeAllHousedArmyUnits } from './armyRuntime';
import type { WorldStore } from '../WorldStore';

/**
 * Recomputes housed army unit stats for all active army buildings each game tick,
 * picking up any neighbor effects that changed since the last tick.
 */
export class ArmyService {
	constructor(private readonly world: WorldStore) {}

	advanceTick(): void {
		recomputeAllHousedArmyUnits(this.world);
	}
}
