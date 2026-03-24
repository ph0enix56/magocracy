import type { CombatSnapshot } from '../../../../shared/domain/combatTypes';
import { CombatSession, type CombatUnit } from './combatEngine';
import { getUnitDef } from '../../config/buildings';
import type { ArmyUnitState } from '../model';

function toCombatUnit(unit: ArmyUnitState): CombatUnit {
	const unitDef = getUnitDef(unit.unitDefId);
	return {
		unitDefId: unit.unitDefId,
		name: unitDef?.name ?? unit.unitDefId,
		assetPath: unitDef?.assetPath ?? '',
		maxHealth: unit.health,
		health: unit.health,
		drFlat: unit.drFlat,
		drPercent: unit.drPercent,
		actionPoints: unit.actionPoints,
		actions: unitDef?.actions.map((action) => ({ ...action })) ?? [],
		trainingLevel: unit.trainingLevel,
		bonusAttackDamage: unit.bonusAttackDamage
	};
}

function clampInt(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.floor(value);
}

export class CombatReplaySession {
	private session: CombatSession | null = null;

	start(armyA: ArmyUnitState[], armyB: ArmyUnitState[]): void {
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
