import type { ArmyUnitComponent, Entity } from '../model';
import type { ServerEcsWorld } from '../ServerEcsWorld';

function pow(base: number, exp: number): number {
	return Math.pow(base, exp);
}

export class ArmySystem {
	constructor(private readonly world: ServerEcsWorld) {}

	update(_delta: number, _time: number): void {}

	advanceTick(): void {
		for (const entity of this.world.getEntitiesWith(['armyUnit'])) {
			const unit = entity.armyUnit!;
			if (unit.training.status !== 'training') continue;

			unit.training.progress += 1;
			if (unit.training.progress < unit.training.time) continue;

			unit.training.progress = unit.training.time;
			unit.training.status = 'idle';
			unit.trainingLevel += 1;
			unit.health += unit.training.def.health;
			unit.drFlat += unit.training.def.drFlat;
		}
	}

	startTrainingWithThrow(unitEntityId: string): void {
		const entity = this.world.getEntity(unitEntityId);
		if (!entity?.armyUnit) throw new Error('Invalid unit.');
		const unit = entity.armyUnit;
		if (unit.training.status === 'training') throw new Error('Unit is already training.');

		const cost = this.getTrainCost(unit);
		this.deductCostWithThrow(cost);
		unit.training.status = 'training';
		unit.training.progress = 0;
	}

	private getTrainCost(unit: NonNullable<Entity['armyUnit']>): Record<string, number> {
		const levelMult = pow(unit.training.costMult, unit.trainingLevel);
		const out: Record<string, number> = {};
		for (const [resource, base] of Object.entries(unit.training.costBase)) {
			out[resource] = Math.ceil(base * levelMult);
		}
		return out;
	}

	private deductCostWithThrow(cost: Record<string, number>): void {
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