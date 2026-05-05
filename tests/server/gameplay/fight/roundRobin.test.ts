import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRoundRobinPhase, type Pairing } from '../../../../src/server/gameplay/fight/roundRobin';

type ScheduleStats = {
	fightsByPlayerId: Map<string, number>;
	byesByPlayerId: Map<string, number>;
	matchKeys: Set<string>;
};

function collectStats(playerIds: string[], rounds: Pairing[][]): ScheduleStats {
	const fightsByPlayerId = new Map<string, number>();
	const byesByPlayerId = new Map<string, number>();
	for (const playerId of playerIds) {
		fightsByPlayerId.set(playerId, 0);
		byesByPlayerId.set(playerId, 0);
	}

	const matchKeys = new Set<string>();
	for (const round of rounds) {
		for (const [playerAId, playerBId] of round) {
			if (!playerBId) {
				byesByPlayerId.set(playerAId, (byesByPlayerId.get(playerAId) ?? 0) + 1);
				continue;
			}

			fightsByPlayerId.set(playerAId, (fightsByPlayerId.get(playerAId) ?? 0) + 1);
			fightsByPlayerId.set(playerBId, (fightsByPlayerId.get(playerBId) ?? 0) + 1);
			matchKeys.add([playerAId, playerBId].sort().join('-'));
		}
	}

	return { fightsByPlayerId, byesByPlayerId, matchKeys };
}

function randomFrom(sequence: number[]): () => number {
	let index = 0;
	return () => {
		const value = sequence[index];
		index += 1;
		return value ?? 0;
	};
}

function serializeRound(round: Pairing[]): string {
	return round
		.map(([playerAId, playerBId]) => (playerBId ? [playerAId, playerBId].sort().join('-') : `${playerAId}-bye`))
		.sort()
		.join('|');
}

function serializeSchedule(rounds: Pairing[][]): string {
	return rounds.map((round) => serializeRound(round)).join('||');
}

test('2-player phase has one fight round and no byes', () => {
	const playerIds = ['p1', 'p2'];
	const rounds = buildRoundRobinPhase(playerIds, randomFrom([0.3]));
	const stats = collectStats(playerIds, rounds);

	assert.equal(rounds.length, 1);
	assert.deepEqual([...stats.matchKeys], ['p1-p2']);
	assert.equal(stats.fightsByPlayerId.get('p1'), 1);
	assert.equal(stats.fightsByPlayerId.get('p2'), 1);
	assert.equal(stats.byesByPlayerId.get('p1'), 0);
	assert.equal(stats.byesByPlayerId.get('p2'), 0);
});

test('3-player phase has three rounds with one bye per player', () => {
	const playerIds = ['p1', 'p2', 'p3'];
	const rounds = buildRoundRobinPhase(playerIds, randomFrom([0.8, 0.1]));
	const stats = collectStats(playerIds, rounds);

	assert.equal(rounds.length, 3);
	assert.equal(stats.matchKeys.size, 3);

	for (const playerId of playerIds) {
		assert.equal(stats.fightsByPlayerId.get(playerId), 2);
		assert.equal(stats.byesByPlayerId.get(playerId), 1);
	}
});

test('4-player phase has three rounds and complete pair coverage', () => {
	const playerIds = ['p1', 'p2', 'p3', 'p4'];
	const rounds = buildRoundRobinPhase(playerIds, randomFrom([0.2, 0.4, 0.6]));
	const stats = collectStats(playerIds, rounds);

	assert.equal(rounds.length, 3);
	assert.equal(stats.matchKeys.size, 6);

	for (const playerId of playerIds) {
		assert.equal(stats.fightsByPlayerId.get(playerId), 3);
		assert.equal(stats.byesByPlayerId.get(playerId), 0);
	}
});

test('phase order changes when shuffle input changes', () => {
	const playerIds = ['p1', 'p2', 'p3', 'p4'];
	const scheduleA = buildRoundRobinPhase(playerIds, randomFrom([0, 0, 0]));
	const scheduleB = buildRoundRobinPhase(playerIds, randomFrom([0.999, 0.999, 0.999]));

	assert.notEqual(serializeSchedule(scheduleA), serializeSchedule(scheduleB));
});
