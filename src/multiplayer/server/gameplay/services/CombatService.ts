import {
	resolveCombat,
	type CombatOptions,
	type CombatResult,
	type CombatUnit
} from '../fight/combatEngine';
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

export class CombatService {
	static resolveCombat(armyA: ArmyUnitState[], armyB: ArmyUnitState[], options?: CombatOptions): CombatResult {
		return resolveCombat(armyA.map(toCombatUnit), armyB.map(toCombatUnit), options);
	}
}