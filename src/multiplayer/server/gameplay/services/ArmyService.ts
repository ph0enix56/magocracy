import type { Entity } from '../model';
import { getBuildingDef } from '../../config/buildings';
import { getNeighborsFromWorld } from '../kingdom/neighborLookup';
import { computeNextTrainCost, getTrainCostEffectsForUnit } from '../army/trainCost';
import { getHousingBuildingForUnit, recomputeAllHousedArmyUnits, recomputeHousedArmyUnit } from './armyRuntime';
import type { WorldStore } from '../ServerEcsWorld';
import type { ResourceMap } from '../../../../shared/domain/types';

export class ArmyService {
	constructor(private readonly world: WorldStore) {}

	update(_delta: number, _time: number): void {}

	advanceTick(): void {
		recomputeAllHousedArmyUnits(this.world);

		for (const entity of this.world.getEntitiesWith(['armyUnit'])) {
			const unit = entity.armyUnit!;
			if (unit.training.status !== 'training') continue;

			unit.training.progress += 1;
			if (unit.training.progress < unit.training.time) continue;

			unit.training.progress = unit.training.time;
			unit.training.status = 'idle';
			unit.trainingLevel += 1;

			const housing = getHousingBuildingForUnit(this.world, entity.id);
			if (housing) recomputeHousedArmyUnit(this.world, housing.id);
		}
	}

	startTrainingWithThrow(unitEntityId: string): void {
		const entity = this.world.getEntity(unitEntityId);
		if (!entity?.armyUnit) throw new Error('Invalid unit.');
		const unit = entity.armyUnit;
		if (unit.training.status === 'training') throw new Error('Unit is already training.');

		const cost = this.getTrainCost(unitEntityId, unit);
		this.deductCostWithThrow(cost);
		unit.training.status = 'training';
		unit.training.progress = 0;
	}

	private getTrainCost(unitEntityId: string, unit: NonNullable<Entity['armyUnit']>): ResourceMap {
		const costEffects = this.getTrainCostEffects(unitEntityId);
		return computeNextTrainCost(unit, costEffects);
	}

	private getTrainCostEffects(unitEntityId: string): { add: number; mult: number } {
		return getTrainCostEffectsForUnit({
			unitEntityId,
			findHousingByUnitId: (entityId) => getHousingBuildingForUnit(this.world, entityId),
			resolveBuildingDef: getBuildingDef,
			getNeighbors: (q, r) => getNeighborsFromWorld(this.world, q, r)
		});
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
}