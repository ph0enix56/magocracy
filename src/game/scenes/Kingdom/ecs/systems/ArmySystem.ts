import type { ECSManager, Entity, System } from '../ECSBase';

function pow(base: number, exp: number): number {
	return Math.pow(base, exp);
}

export class ArmySystem implements System {
	private world: ECSManager;

	constructor(world: ECSManager) {
		this.world = world;
	}

	update(_delta: number, _time: number): void {}

	advanceTick(): void {
		let changed = false;
		for (const entity of this.world.getEntitiesWith(['armyUnit'])) {
			const u = entity.armyUnit!;
			if (u.training.status !== 'training') continue;

			u.training.progress += 1;
			changed = true;

			if (u.training.progress >= u.training.time) {
				u.training.progress = u.training.time;
				u.training.status = 'idle';
				u.trainingLevel += 1;

				// Apply training effects (ignore attack stats for now).
				u.health += u.training.def.health;
				u.drFlat += u.training.def.drFlat;
			}
		}

		if (changed) {
			this.world.broadcastArmyState();
		}
	}

	private getTrainCost(unit: NonNullable<Entity['armyUnit']>): Record<string, number> {
		const levelMult = pow(unit.training.costMult, unit.trainingLevel);
		const out: Record<string, number> = {};
		for (const [res, base] of Object.entries(unit.training.costBase)) {
			out[res] = Math.ceil(base * levelMult);
		}
		return out;
	}

	private deductCostWithThrow(cost: Record<string, number>): void {
		for (const [res, amount] of Object.entries(cost)) {
			const current = this.world.resources.get(res) || 0;
			if (current < amount) throw new Error(`Not enough ${res}`);
		}
		for (const [res, amount] of Object.entries(cost)) {
			const current = this.world.resources.get(res) || 0;
			this.world.resources.set(res, current - amount);
		}
	}

	startTrainingWithThrow(unitEntityId: string): void {
		const entity = this.world.getEntity(unitEntityId);
		if (!entity?.armyUnit) throw new Error('Invalid unit.');

		const u = entity.armyUnit;
		if (u.training.status === 'training') throw new Error('Unit is already training.');

		const cost = this.getTrainCost(u);
		this.deductCostWithThrow(cost);

		u.training.status = 'training';
		u.training.progress = 0;
		this.world.broadcastArmyState();
	}
}
