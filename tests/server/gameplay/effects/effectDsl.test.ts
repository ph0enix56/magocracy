import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BuildingDef } from '../../../../src/multiplayer/server/config/buildingTypes';
import type { KingdomTileState } from '../../../../src/multiplayer/server/gameplay/model';
import { accumulateEffectsForTargetStat, parseBuildingEffect } from '../../../../src/multiplayer/server/gameplay/effects/effectDsl';

function makeDef(params: { id: string; school: BuildingDef['school']; tier: number; productions?: Record<string, number>; effects?: string[] }): BuildingDef {
	return {
		id: params.id,
		school: params.school,
		tier: params.tier,
		name: params.id,
		description: params.id,
		assetPath: 'x',
		cost: {},
		buildTime: 1,
		productions: params.productions,
		effects: params.effects
	};
}

function makeTile(params: { tileId: string; q: number; r: number; buildingId?: string }): KingdomTileState {
	const { tileId, q, r, buildingId } = params;
	return {
		tileId,
		coord: { q, r },
		building: buildingId
			? {
					buildingId,
					status: 'active',
					progress: 0
				}
			: undefined
	};
}

test('parseBuildingEffect parses valid DSL and rejects invalid entries', () => {
	assert.deepEqual(parseBuildingEffect('self-foreach; empty; prod:all; mult; 0.05'), {
		target: 'self-foreach',
		cond: 'empty',
		stat: 'prod:all',
		apply: 'mult',
		value: 0.05
	});

	assert.equal(parseBuildingEffect('invalid; empty; prod:all; mult; 0.05'), null);
	assert.equal(parseBuildingEffect('self-if; empty; prod:all; nope; 1'), null);
	assert.equal(parseBuildingEffect('self-if; empty; unknown; add; 1'), null);
	assert.equal(parseBuildingEffect('self-if; empty; prod:all; add; nan'), null);
});

test('accumulateEffects combines self and neighbor effects for matching target stat', () => {
	const defs: Record<string, BuildingDef> = {
		target: makeDef({
			id: 'target',
			school: 'sylvan',
			tier: 1,
			productions: { food: 10 },
			effects: [
				'self-foreach; empty; prod:all; mult; 0.05',
				'self-if; school=sylvan & hasProd; prod:food; add; 2'
			]
		}),
		sylvan_neighbor: makeDef({ id: 'sylvan_neighbor', school: 'sylvan', tier: 1, productions: { wood: 3 } }),
		house_neighbor: makeDef({
			id: 'house_neighbor',
			school: 'neutral',
			tier: 1,
			productions: {},
			effects: ['neighbor; hasProd; prod:all; mult; 0.1']
		})
	};

	const targetTile = makeTile({ tileId: '0,0', q: 0, r: 0, buildingId: 'target' });
	const neighbors = [
		makeTile({ tileId: '1,1', q: 1, r: 1, buildingId: 'sylvan_neighbor' }),
		makeTile({ tileId: '2,0', q: 2, r: 0, buildingId: 'house_neighbor' }),
		makeTile({ tileId: '-1,-1', q: -1, r: -1 })
	];

	const resolveBuildingDef = (buildingId: string) => defs[buildingId];
	const getNeighbors = (q: number, r: number) => {
		if (q === 0 && r === 0) return neighbors;
		return [];
	};

	const foodEffects = accumulateEffectsForTargetStat({
		targetTile,
		targetBuildingDef: defs.target,
		targetStat: 'prod:food',
		resolveBuildingDef,
		getNeighbors
	});
	assert.deepEqual(foodEffects, { add: 2, mult: 0.15 });

	const woodEffects = accumulateEffectsForTargetStat({
		targetTile,
		targetBuildingDef: defs.target,
		targetStat: 'prod:wood',
		resolveBuildingDef,
		getNeighbors
	});
	assert.deepEqual(woodEffects, { add: 0, mult: 0.15 });
});
