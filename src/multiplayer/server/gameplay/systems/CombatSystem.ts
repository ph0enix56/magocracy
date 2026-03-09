import { getUnitDef } from '../../config/buildings';
import {
	CombatSession,
	resolveCombat,
	type CombatOptions,
	type CombatResult,
	type CombatSnapshot,
	type CombatUnit
} from '../../../../shared/combat/combatCore';
import type { ArmyUnitComponent } from '../model';

function clampInt(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.floor(value);
}

function toCombatUnit(unit: ArmyUnitComponent): CombatUnit {
	const def = getUnitDef(unit.unitId);
	if (!def) throw new Error(`Missing unit def for unitId '${unit.unitId}'`);

	return {
		unitId: unit.unitId,
		name: unit.name,
		assetPath: unit.assetPath,
		maxHealth: unit.health,
		health: unit.health,
		drFlat: unit.drFlat,
		drPercent: unit.drPercent,
		actionsPerTurn: unit.actionsPerTurn,
		actions: def.actions,
		trainingLevel: unit.trainingLevel,
		trainingAttackDamagePerLevel: unit.training?.def?.attackDamage ?? 0
	};
}

export class CombatSystem {
	private session: CombatSession | null = null;

	constructor() {}

	update(_delta: number, _time: number): void {}
	advanceTick(): void {}

	startCombat(armyA: ArmyUnitComponent[], armyB: ArmyUnitComponent[]): void {
		this.session = new CombatSession(armyA.map(toCombatUnit), armyB.map(toCombatUnit));
	}

	getSnapshot(): CombatSnapshot {
		if (!this.session) {
			return { status: 'idle', round: 0, activeSide: 'armyA', armyA: [], armyB: [], log: [] };
		}
		return this.session.getSnapshot();
	}

	stepCombat(steps = 1): void {
		if (!this.session) throw new Error('No active combat.');
		const count = Math.max(1, clampInt(steps));
		for (let index = 0; index < count; index += 1) {
			const entry = this.session.step();
			if (!entry) break;
		}
	}

	resetCombat(): void {
		this.session = null;
	}

	static resolveCombat(armyA: ArmyUnitComponent[], armyB: ArmyUnitComponent[], options?: CombatOptions): CombatResult {
		return resolveCombat(armyA.map(toCombatUnit), armyB.map(toCombatUnit), options);
	}
}