import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveCombat, CombatSession, type CombatUnit } from '../../../../src/server/gameplay/fight/combatEngine';


const basicUnit = (id: string, initiative: number): CombatUnit => ({
	unitDefId: id,
	name: id,
	assetPath: '',
	maxHealth: 100,
	health: 100,
	drFlat: 0,
	drPercent: 0,
	actionPoints: 1,
	initiative,
	actions: [
		{
			name: 'Attack',
			damage: 10,
			range: 2,
			targeting: 'first' as const,
			actionPointCost: 1
		}
	]
});

test('initiative determines turn order', () => {
	const armyA = [basicUnit('a1', 10)];
	const armyB = [basicUnit('b1', 20)];

	// b1 has higher initiative, so it should act first.
	// b1 deals 10 damage to a1.
	// a1 then deals 10 damage to b1.
	const result = resolveCombat(armyA, armyB, { maxRounds: 1 });

	assert.equal(result.armyA[0]?.health, 90);
	assert.equal(result.armyB[0]?.health, 90);
});

test('position breaks ties in initiative', () => {
	const armyA = [basicUnit('a1', 10), basicUnit('a2', 10)];
	const armyB = [basicUnit('b1', 10)];

	// All have initiative 10.
	// a1 and b1 are both at position 0.
	// a2 is at position 1.
	// Between a1 and b1, b1 (ID 'b1') < a1 (ID 'a1')? No, 'a1' < 'b1'.
	// So order: a1 (pos 0), b1 (pos 0), a2 (pos 1).
	
	// a1 attacks b1 (b1 HP: 90)
	// b1 attacks a1 (a1 HP: 90)
	// a2 attacks b1 (b1 HP: 80)
	
	const result = resolveCombat(armyA, armyB, { maxRounds: 1 });
	assert.equal(result.armyA[0]?.health, 90);
	assert.equal(result.armyB[0]?.health, 80);
});

test('unit ID breaks ties in initiative and position', () => {
	const armyA = [basicUnit('z1', 10)];
	const armyB = [basicUnit('a1', 10)];

	// Both pos 0, initiative 10.
	// 'a1' < 'z1', so armyB acts first.
	// b (a1) attacks a (z1) -> z1 HP 90
	// a (z1) attacks b (a1) -> a1 HP 90

	const result = resolveCombat(armyA, armyB, { maxRounds: 1 });
	assert.equal(result.armyA[0]?.health, 90);
	assert.equal(result.armyB[0]?.health, 90);
});

test('dead units do not take turns', () => {
	const armyA = [
		{
			...basicUnit('glass-cannon', 100),
			maxHealth: 1,
			health: 1,
			actions: [{ name: 'Nuke', damage: 100, range: 1, targeting: 'first' as const, actionPointCost: 1 }]
		}
	];
	const armyB = [
		{
			...basicUnit('faster-killer', 200),
			actions: [{ name: 'Poke', damage: 1, range: 1, targeting: 'first' as const, actionPointCost: 1 }]
		}
	];

	// faster-killer acts first (init 200), deals 1 damage to glass-cannon.
	// glass-cannon dies and should NOT take its turn.
	const result = resolveCombat(armyA, armyB);

	assert.equal(result.winner, 'armyB');
	assert.equal(result.armyB[0]?.health, 100); // Should be full health because glass-cannon never acted
});

test('high initiative units can sweep before enemies act', () => {
	const armyA = [
		basicUnit('fast1', 100),
		basicUnit('fast2', 90)
	];
	const armyB = [
		basicUnit('slow1', 10)
	];

	// fast1 acts -> slow1 HP 90
	// fast2 acts -> slow1 HP 80
	// slow1 acts -> fast1 HP 90
	const result = resolveCombat(armyA, armyB, { maxRounds: 1 });
	assert.equal(result.armyB[0]?.health, 80);
});

test('CombatSession step and getSnapshot reflecting incremental state', () => {
	const armyA = [basicUnit('a1', 100)];
	const armyB = [basicUnit('b1', 50)];
	const session = new CombatSession(armyA, armyB);

	let snapshot = session.getSnapshot();
	assert.equal(snapshot.status, 'running');
	assert.equal(snapshot.log.length, 0);

	// Step 1: a1 attacks b1
	const step1 = session.step();
	assert.ok(step1);
	snapshot = session.getSnapshot();
	assert.equal(snapshot.log.length, 1);
	assert.equal(snapshot.armyB[0]?.health, 90);

	// Step 2: b1 attacks a1
	const step2 = session.step();
	assert.ok(step2);
	snapshot = session.getSnapshot();
	assert.equal(snapshot.log.length, 2);
	assert.equal(snapshot.armyA[0]?.health, 90);

	// No more units this round, should advance round
	const step3 = session.step();
	assert.ok(step3);
	snapshot = session.getSnapshot();
	assert.equal(snapshot.round, 2);
});
