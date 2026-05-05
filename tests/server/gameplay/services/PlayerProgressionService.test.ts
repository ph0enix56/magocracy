import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CharterOption } from '../../../../src/shared/domain/charter';
import { WorldStore } from '../../../../src/server/gameplay/WorldStore';
import { PlayerProgressionService } from '../../../../src/server/gameplay/services/PlayerProgressionService';

function createProgression(playerIds: string[]) {
	const worlds = new Map<string, WorldStore>();
	for (const playerId of playerIds) {
		worlds.set(playerId, new WorldStore());
	}
	const service = new PlayerProgressionService((playerId) => worlds.get(playerId));
	return { service, worlds };
}

test('buildStandings sorts by renown descending and uses input order for ties', () => {
	const { service, worlds } = createProgression(['p1', 'p2', 'p3']);
	worlds.get('p1')!.resources.set('renown', 5);
	worlds.get('p2')!.resources.set('renown', 7);
	worlds.get('p3')!.resources.set('renown', 5);

	const standings = service.buildStandings(['p1', 'p2', 'p3']);
	assert.deepEqual(
		standings.map((entry) => ({ playerId: entry.playerId, renown: entry.renown, rank: entry.rank })),
		[
			{ playerId: 'p2', renown: 7, rank: 1 },
			{ playerId: 'p1', renown: 5, rank: 2 },
			{ playerId: 'p3', renown: 5, rank: 3 }
		]
	);
});

test('evaluateEndgame returns finished once target renown reached', () => {
	const { service, worlds } = createProgression(['p1', 'p2']);
	worlds.get('p1')!.resources.set('renown', 2);
	worlds.get('p2')!.resources.set('renown', 20);

	const evaluation = service.evaluateEndgame(['p1', 'p2']);
	assert.equal(evaluation.finished, true);
	if (!evaluation.finished) return;
	assert.equal(evaluation.winnerPlayerId, 'p2');
	assert.equal(evaluation.standings[0]?.playerId, 'p2');
});

test('applyCharterRewards floors positive grants and ignores negative grants', () => {
	const { service, worlds } = createProgression(['p1']);
	const world = worlds.get('p1')!;
	world.resources.set('mana', 0);
	world.blueprintInventory.set('farm', 0);

	const charter: CharterOption = {
		charterId: 'c-1',
		title: 'Reward Test',
		level: 1,
		resources: [
			{ resource: 'mana', amount: 2.8 },
			{ resource: 'mana', amount: -100 }
		],
		blueprints: [
			{ buildingId: 'farm', count: 3.9, tier: 1, type: 'production' },
			{ buildingId: 'farm', count: -50, tier: 1, type: 'production' }
		]
	};

	service.applyCharterRewards('p1', charter);
	assert.equal(world.resources.get('mana'), 2);
	assert.equal(world.blueprintInventory.get('farm'), 3);
});
