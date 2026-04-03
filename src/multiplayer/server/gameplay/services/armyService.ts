import { recomputeAllHousedArmyUnits } from './armyRuntime';
import type { WorldStore } from '../WorldStore';

export class ArmyService {
	constructor(private readonly world: WorldStore) {}

	update(_delta: number, _time: number): void {}

	advanceTick(): void {
		recomputeAllHousedArmyUnits(this.world);
	}
}
