import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CombatService } from '../../../../src/server/gameplay/services/CombatService';
import type { ArmyUnitState } from '../../../../src/server/gameplay/model';

test('CombatService correctly maps initiative and base stats', () => {
	const unit: ArmyUnitState = {
		armyUnitId: 'test-u1',
		unitDefId: 'swordsman',
		health: 110,
		drFlat: 4,
		drPercent: 6,
		actionPoints: 1,
		initiative: 2,
		bonusDamage: 0,
		damageMultiplier: 0
	};

	const result = CombatService.resolveCombat([unit], [unit], { maxRounds: 1 });
	
	// resolveCombat internally calls toCombatUnit which maps these fields.
	// We can't directly test toCombatUnit as it's private, but we can verify
	// the combat result units which are converted back.
	
	assert.equal(result.armyA[0]?.maxHealth, 110);
	assert.equal(result.armyA[0]?.unitDefId, 'swordsman');
});

test('CombatService applies damage bonuses during mapping', () => {
	const unitA: ArmyUnitState = {
		armyUnitId: 'test-u1',
		unitDefId: 'swordsman', // Base damage is 24
		health: 100,
		drFlat: 0,
		drPercent: 0,
		actionPoints: 1,
		initiative: 10,
		bonusDamage: 10, // 24 + 10 = 34
		damageMultiplier: 0.5 // 34 * 1.5 = 51
	};
	
	const unitB: ArmyUnitState = {
		armyUnitId: 'test-u2',
		unitDefId: 'swordsman',
		health: 100,
		drFlat: 0,
		drPercent: 0,
		actionPoints: 1,
		initiative: 1,
		bonusDamage: 0,
		damageMultiplier: 0
	};

	const result = CombatService.resolveCombat([unitA], [unitB], { maxRounds: 1 });
	
	// unitA acts first (init 10).
	// it should deal 51 damage to unitB.
	assert.equal(result.armyB[0]?.health, 100 - 51);
});

test('CombatService handles empty army inputs', () => {
	const result = CombatService.resolveCombat([], []);
	assert.equal(result.winner, 'draw');
	assert.equal(result.armyA.length, 0);
	assert.equal(result.armyB.length, 0);
});

test('CombatService is resilient to undefined optional fields', () => {
	const unit: ArmyUnitState = {
		armyUnitId: 'test-u1',
		unitDefId: 'swordsman',
		health: 100,
		drFlat: 0,
		drPercent: 0,
		actionPoints: 1,
		initiative: 1,
		// bonusDamage and damageMultiplier are omitted
	};

	const result = CombatService.resolveCombat([unit], [unit], { maxRounds: 1 });
	assert.ok(result);
});
