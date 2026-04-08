import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kingdomCoordKey } from '../../../../src/shared/kingdom/kingdomGrid';
import type { KingdomTileState } from '../../../../src/multiplayer/server/gameplay/model';
import { WorldStore } from '../../../../src/multiplayer/server/gameplay/WorldStore';
import { BuildService } from '../../../../src/multiplayer/server/gameplay/services/BuildService';

function createTile(params: {
	q: number;
	r: number;
	isExpansionSite?: true;
	building?: KingdomTileState['building'];
}): KingdomTileState {
	const { q, r, isExpansionSite, building } = params;
	return {
		tileId: kingdomCoordKey(q, r),
		coord: { q, r },
		isExpansionSite,
		building
	};
}

test('startBuild consumes resources and blueprint and sets constructing state', () => {
	const world = new WorldStore();
	const service = new BuildService(world);
	const tile = createTile({ q: 0, r: 0 });
	world.upsertKingdomTile(tile);
	world.blueprintInventory.set('stone_mine', 1);
	const woodBefore = world.resources.get('wood') ?? 0;

	service.startBuild(tile.tileId, 'stone_mine');

	assert.equal(tile.building?.buildingId, 'stone_mine');
	assert.equal(tile.building?.status, 'constructing');
	assert.equal(tile.building?.progress, 0);
	assert.equal(world.resources.get('wood'), woodBefore - 35);
	assert.equal(world.blueprintInventory.has('stone_mine'), false);
});

test('startBuild rejects building on expansion sites', () => {
	const world = new WorldStore();
	const service = new BuildService(world);
	const tile = createTile({ q: 0, r: 0, isExpansionSite: true });
	world.upsertKingdomTile(tile);
	world.blueprintInventory.set('stone_mine', 1);

	assert.throws(() => service.startBuild(tile.tileId, 'stone_mine'), /Tile must be expanded first/);
});

test('advanceTick completes barracks construction and spawns housed unit', () => {
	const world = new WorldStore();
	const service = new BuildService(world);
	const tile = createTile({ q: 0, r: 0 });
	world.upsertKingdomTile(tile);
	world.blueprintInventory.set('sword_barracks', 1);

	service.startBuild(tile.tileId, 'sword_barracks');
	service.advanceTick();
	assert.equal(tile.building?.status, 'constructing');
	assert.equal(tile.building?.progress, 1);

	service.advanceTick();
	assert.equal(tile.building?.status, 'active');
	assert.equal(tile.building?.buildingId, 'sword_barracks');
	assert.equal(tile.building?.progress, 2);
	assert.ok(tile.building?.housedUnitId);
	assert.equal(world.getArmyUnits().length, 1);
	assert.equal(world.getArmyUnits()[0]?.unitDefId, 'swordsman');
});

test('startUpgrade and advanceTick complete upgrade target', () => {
	const world = new WorldStore();
	const service = new BuildService(world);
	const tile = createTile({
		q: 0,
		r: 0,
		building: {
			buildingId: 'stone_mine',
			status: 'active',
			progress: 5
		}
	});
	world.upsertKingdomTile(tile);
	const woodBefore = world.resources.get('wood') ?? 0;
	const stoneBefore = world.resources.get('stone') ?? 0;

	service.startUpgrade(tile.tileId, 'stone_mine_2');
	assert.equal(tile.building?.status, 'upgrading');
	assert.equal(tile.building?.upgradeNextId, 'stone_mine_2');
	assert.equal(tile.building?.progress, 0);
	assert.equal(world.resources.get('wood'), woodBefore - 60);
	assert.equal(world.resources.get('stone'), stoneBefore - 30);

	for (let i = 0; i < 8; i += 1) service.advanceTick();
	assert.equal(tile.building?.status, 'active');
	assert.equal(tile.building?.buildingId, 'stone_mine_2');
	assert.equal(tile.building?.upgradeNextId, undefined);
	assert.equal(tile.building?.progress, 8);
});
