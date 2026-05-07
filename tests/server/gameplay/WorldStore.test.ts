import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorldStore } from '../../../src/server/gameplay/WorldStore';

test('WorldStore army unit ordering logic', () => {
	const world = new WorldStore();
	
	// Spawn units
	const u1 = world.spawnArmyUnit('swordsman');
	const u2 = world.spawnArmyUnit('archer');
	const u3 = world.spawnArmyUnit('ghost');
	
	assert.deepEqual(world.armyUnitOrder, [u1.armyUnitId, u2.armyUnitId, u3.armyUnitId]);
	assert.deepEqual(world.getOrderedArmyUnits().map(u => u.armyUnitId), [u1.armyUnitId, u2.armyUnitId, u3.armyUnitId]);

	// Reorder up
	world.reorderArmyUnitWithThrow(u2.armyUnitId, 'up');
	assert.deepEqual(world.armyUnitOrder, [u2.armyUnitId, u1.armyUnitId, u3.armyUnitId]);

	// Reorder down
	world.reorderArmyUnitWithThrow(u2.armyUnitId, 'down');
	assert.deepEqual(world.armyUnitOrder, [u1.armyUnitId, u2.armyUnitId, u3.armyUnitId]);

	// Boundary reorder up
	world.reorderArmyUnitWithThrow(u1.armyUnitId, 'up');
	assert.deepEqual(world.armyUnitOrder, [u1.armyUnitId, u2.armyUnitId, u3.armyUnitId]);

	// Replace unit
	const u4 = world.replaceArmyUnitWithThrow(u2.armyUnitId, 'peasant');
	assert.deepEqual(world.armyUnitOrder, [u1.armyUnitId, u4.armyUnitId, u3.armyUnitId]);
	assert.equal(world.getArmyUnit(u2.armyUnitId), undefined);
	assert.ok(world.getArmyUnit(u4.armyUnitId));

	// Remove unit
	world.removeArmyUnit(u4.armyUnitId);
	assert.deepEqual(world.armyUnitOrder, [u1.armyUnitId, u3.armyUnitId]);
});
