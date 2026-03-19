import {
	resolveCombat,
	type CombatOptions,
	type CombatResult,
	type CombatUnit
} from '../../../../shared/combat/combatCore';
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

export class CombatService {
	static resolveCombat(armyA: ArmyUnitComponent[], armyB: ArmyUnitComponent[], options?: CombatOptions): CombatResult {
		return resolveCombat(armyA.map(toCombatUnit), armyB.map(toCombatUnit), options);
	}
}