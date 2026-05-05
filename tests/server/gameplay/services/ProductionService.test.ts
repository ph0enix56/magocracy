import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kingdomCoordKey } from '../../../../src/shared/kingdom/kingdomGrid';
import type { KingdomTileState } from '../../../../src/server/gameplay/model';
import { WorldStore } from '../../../../src/server/gameplay/WorldStore';
import { ProductionService } from '../../../../src/server/gameplay/services/ProductionService';

function createTile(params: { q: number; r: number; buildingId: string }): KingdomTileState {
	const { q, r, buildingId } = params;
	return {
		tileId: kingdomCoordKey(q, r),
		coord: { q, r },
		building: {
			buildingId,
			status: 'active',
			progress: 0
		}
	};
}

test('advanceTick applies base production for active production buildings', () => {
	const world = new WorldStore();
	const service = new ProductionService(world);
	world.resources.set('stone', 0);
	world.upsertKingdomTile(createTile({ q: 0, r: 0, buildingId: 'mining_camp' }));

	service.advanceTick();

	assert.equal(world.resources.get('stone'), 5);
});

test('calculateResourceAmount combines self and neighbor production effects directly', () => {
	const world = new WorldStore();
	const service = new ProductionService(world);
	const targetTile = createTile({ q: 0, r: 0, buildingId: 'logging_camp' });
	world.upsertKingdomTile(targetTile);
	world.upsertKingdomTile(createTile({ q: 1, r: 1, buildingId: 'farm' }));
	world.upsertKingdomTile(createTile({ q: 2, r: 0, buildingId: 'mining_camp' }));

	// The logging_camp base is 5 wood
	// It has self-foreach neighbor +1 wood. With 2 neighbors, it gets +2. Total 7.
	const amount = service.calculateResourceAmount(targetTile, 'wood', 5);
	assert.equal(amount, 7);
});

test('advanceTick applies current multiplier stacking semantics for logging camp synergies', () => {
	const world = new WorldStore();
	const service = new ProductionService(world);
	world.resources.set('wood', 0);
	world.upsertKingdomTile(createTile({ q: 0, r: 0, buildingId: 'logging_camp' }));
	world.upsertKingdomTile(createTile({ q: 1, r: 1, buildingId: 'farm' }));
	world.upsertKingdomTile(createTile({ q: 2, r: 0, buildingId: 'mining_camp' }));

	service.advanceTick();

	assert.equal(world.resources.get('wood'), 7);
});
