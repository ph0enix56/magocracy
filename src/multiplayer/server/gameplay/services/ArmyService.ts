import type { ArmyUnitState } from '../model';
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

		for (const unit of this.world.getArmyUnits()) {
			if (unit.training.status !== 'training') continue;
			const trainingTime = this.getTrainingTimeForUnit(unit.armyUnitId);
			if (trainingTime <= 0) {
				unit.training.status = 'idle';
				unit.training.progress = 0;
				continue;
			}

			unit.training.progress += 1;
			if (unit.training.progress < trainingTime) continue;

			unit.training.progress = trainingTime;
			unit.training.status = 'idle';
			unit.bonusAttackDamage += this.getTrainingAttackBonus(unit.armyUnitId);
			unit.trainingLevel += 1;

			const housing = getHousingBuildingForUnit(this.world, unit.armyUnitId);
			if (housing) recomputeHousedArmyUnit(this.world, housing.tileId);
		}
	}

	startTrainingWithThrow(unitEntityId: string): void {
		const unit = this.world.getArmyUnit(unitEntityId);
		if (!unit) throw new Error('Invalid unit.');
		if (unit.training.status === 'training') throw new Error('Unit is already training.');

		const cost = this.getTrainCost(unitEntityId, unit);
		this.deductCostWithThrow(cost);
		unit.training.status = 'training';
		unit.training.progress = 0;
	}

	private getTrainCost(unitEntityId: string, unit: ArmyUnitState): ResourceMap {
		const costEffects = this.getTrainCostEffects(unitEntityId);
		const { trainCostBase, trainCostMult } = this.getTrainingParamsForUnitWithThrow(unitEntityId);
		return computeNextTrainCost(unit, trainCostBase, trainCostMult, costEffects);
	}

	private getTrainingTimeForUnit(unitEntityId: string): number {
		const housing = getHousingBuildingForUnit(this.world, unitEntityId);
		if (!housing?.building) return 0;
		const def = getBuildingDef(housing.building.buildingId);
		if (!def?.army) return 0;
		return Math.max(0, Math.floor(def.army.trainTime));
	}

	private getTrainingAttackBonus(unitEntityId: string): number {
		const housing = getHousingBuildingForUnit(this.world, unitEntityId);
		if (!housing?.building) return 0;
		const def = getBuildingDef(housing.building.buildingId);
		if (!def?.army) return 0;
		return Math.max(0, Math.floor(def.army.trainDef.attackDamage));
	}

	private getTrainingParamsForUnitWithThrow(unitEntityId: string): { trainCostBase: ResourceMap; trainCostMult: number } {
		const housing = getHousingBuildingForUnit(this.world, unitEntityId);
		if (!housing?.building) throw new Error('Unit has no active housing.');
		const def = getBuildingDef(housing.building.buildingId);
		if (!def?.army) throw new Error('Unit housing has no training definition.');
		return {
			trainCostBase: def.army.trainCostBase,
			trainCostMult: def.army.trainCostMult
		};
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