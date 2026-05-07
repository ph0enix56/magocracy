import {
	resolveCombat,
	type CombatOptions,
	type CombatResult,
	type CombatUnit
} from '../fight/combatEngine';
import { getUnitDef } from '../../config/buildings';
import type { ArmyUnitState } from '../model';

/**
 * Maps an {@link ArmyUnitState} (with runtime stat overrides and damage bonuses) to a
 * {@link CombatUnit} suitable for use in the combat engine. Applies `bonusDamage` and
 * `damageMultiplier` to each action's base damage.
 */
export function toCombatUnit(unit: ArmyUnitState): CombatUnit {
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
		initiative: unit.initiative,
		actions: unitDef?.actions.map((action) => ({
			...action,
			damage: Math.max(0, Math.floor((action.damage + (unit.bonusDamage ?? 0)) * (1 + (unit.damageMultiplier ?? 0))))
		})) ?? []
	};
}

/** Wraps the combat engine to resolve a full combat between two armies and return the outcome. */
export class CombatService {
	static resolveCombat(armyA: ArmyUnitState[], armyB: ArmyUnitState[], options?: CombatOptions): CombatResult {
		return resolveCombat(armyA.map(toCombatUnit), armyB.map(toCombatUnit), options);
	}
}