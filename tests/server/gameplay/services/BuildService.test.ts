import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kingdomCoordKey } from '../../../../src/shared/kingdom/kingdomGrid';
import type { KingdomTileState } from '../../../../src/server/gameplay/model';
import { WorldStore } from '../../../../src/server/gameplay/WorldStore';
import { BuildService } from '../../../../src/server/gameplay/services/BuildService';

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

function seedResources(world: WorldStore): void {
	world.resources.set('wood', 1000);
	world.resources.set('stone', 1000);
	world.resources.set('food', 1000);
	world.resources.set('mana', 1000);
}

test('startBuild consumes resources and blueprint and sets constructing state', () => {
	const world = new WorldStore();
	seedResources(world);
	const service = new BuildService(world);
	const tile = createTile({ q: 0, r: 0 });
	world.upsertKingdomTile(tile);
	world.blueprintInventory.set('mining_camp', 1);
	const woodBefore = world.resources.get('wood') ?? 0;

	service.startBuild(tile.tileId, 'mining_camp');

	assert.equal(tile.building?.buildingId, 'mining_camp');
	assert.equal(tile.building?.status, 'constructing');
	assert.equal(tile.building?.progress, 0);
	assert.equal(world.resources.get('wood'), woodBefore - 40);
	assert.equal(world.blueprintInventory.has('mining_camp'), false);
});

test('startBuild rejects building on expansion sites', () => {
	const world = new WorldStore();
	seedResources(world);
	const service = new BuildService(world);
	const tile = createTile({ q: 0, r: 0, isExpansionSite: true });
	world.upsertKingdomTile(tile);
	world.blueprintInventory.set('mining_camp', 1);

	assert.throws(() => service.startBuild(tile.tileId, 'mining_camp'), /Tile must be expanded first/);
});

test('advanceTick completes barracks construction and spawns housed unit', () => {
	const world = new WorldStore();
	seedResources(world);
	const service = new BuildService(world);
	const tile = createTile({ q: 0, r: 0 });
	world.upsertKingdomTile(tile);
	world.blueprintInventory.set('swordsman_camp', 1);

	service.startBuild(tile.tileId, 'swordsman_camp');
	service.advanceTick();
	assert.equal(tile.building?.status, 'constructing');
	assert.equal(tile.building?.progress, 1);

	service.advanceTick();
	service.advanceTick();
	service.advanceTick();
	assert.equal(tile.building?.status, 'active');
	assert.equal(tile.building?.buildingId, 'swordsman_camp');
	assert.equal(tile.building?.progress, 4);
	assert.ok(tile.building?.housedUnitId);
	assert.equal(world.getArmyUnits().length, 1);
	assert.equal(world.getArmyUnits()[0]?.unitDefId, 'swordsman');
});

test('startUpgrade and advanceTick complete upgrade target', () => {
	const world = new WorldStore();
	seedResources(world);
	const service = new BuildService(world);
	const tile = createTile({
		q: 0,
		r: 0,
		building: {
			buildingId: 'mining_camp',
			status: 'active',
			progress: 3
		}
	});
	world.upsertKingdomTile(tile);
	const woodBefore = world.resources.get('wood') ?? 0;
	const stoneBefore = world.resources.get('stone') ?? 0;

	service.startUpgrade(tile.tileId, 'mining_camp_2');
	assert.equal(tile.building?.status, 'upgrading');
	assert.equal(tile.building?.upgradeNextId, 'mining_camp_2');
	assert.equal(tile.building?.progress, 0);
	assert.equal(world.resources.get('wood'), woodBefore - 25);
	assert.equal(world.resources.get('stone'), stoneBefore - 90);

	for (let i = 0; i < 5; i += 1) service.advanceTick();
	assert.equal(tile.building?.status, 'active');
	assert.equal(tile.building?.buildingId, 'mining_camp_2');
	assert.equal(tile.building?.upgradeNextId, undefined);
	assert.equal(tile.building?.progress, 5);
});

test('destroyBuilding removes housed unit from army', () => {
	const world = new WorldStore();
	seedResources(world);
	const service = new BuildService(world);
	const tile = createTile({ q: 0, r: 0 });
	world.upsertKingdomTile(tile);
	world.blueprintInventory.set('swordsman_camp', 1);

	service.startBuild(tile.tileId, 'swordsman_camp');
	for (let i = 0; i < 4; i += 1) service.advanceTick();

	assert.equal(tile.building?.status, 'active');
	assert.ok(tile.building?.housedUnitId);
	assert.equal(world.getArmyUnits().length, 1);

	service.destroyBuilding(tile.tileId);

	assert.equal(tile.building, undefined);
	assert.equal(world.getArmyUnits().length, 0);
});
