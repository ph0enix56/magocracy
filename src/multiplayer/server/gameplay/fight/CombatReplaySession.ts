import { CombatSession, type CombatSnapshot, type CombatUnit } from '../../../../shared/combat/combatCore';
import type { ArmyUnitComponent } from '../model';

function toCombatUnit(unit: ArmyUnitComponent): CombatUnit {
	return {
		unitId: unit.unitId,
		name: unit.name,
		assetPath: unit.assetPath,
		maxHealth: unit.health,
		health: unit.health,
		drFlat: unit.drFlat,
		drPercent: unit.drPercent,
		actionsPerTurn: unit.actionsPerTurn,
		actions: unit.actions,
		trainingLevel: unit.trainingLevel,
		trainingAttackDamagePerLevel: unit.training?.def?.attackDamage ?? 0
	};
}

function clampInt(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.floor(value);
}

export class CombatReplaySession {
	private session: CombatSession | null = null;

	start(armyA: ArmyUnitComponent[], armyB: ArmyUnitComponent[]): void {
		this.session = new CombatSession(armyA.map(toCombatUnit), armyB.map(toCombatUnit));
	}

	step(steps = 1): void {
		if (!this.session) throw new Error('No active combat replay.');
		const count = Math.max(1, clampInt(steps));
		for (let index = 0; index < count; index += 1) {
			const entry = this.session.step();
			if (!entry) break;
		}
	}

	getSnapshot(): CombatSnapshot {
		if (!this.session) {
			return { status: 'idle', round: 0, activeSide: 'armyA', armyA: [], armyB: [], log: [] };
		}
		return this.session.getSnapshot();
	}
}
