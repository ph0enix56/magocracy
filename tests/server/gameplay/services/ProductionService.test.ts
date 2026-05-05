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
	world.upsertKingdomTile(createTile({ q: 0, r: 0, buildingId: 'stone_mine' }));

	service.advanceTick();

	assert.equal(world.resources.get('stone'), 5);
});

test('calculateMultiplier includes self and neighbor production effects', () => {
	const world = new WorldStore();
	const service = new ProductionService(world);
	world.upsertKingdomTile(createTile({ q: 0, r: 0, buildingId: 'lumber_camp' }));
	world.upsertKingdomTile(createTile({ q: 1, r: 1, buildingId: 'farm' }));
	world.upsertKingdomTile(createTile({ q: 2, r: 0, buildingId: 'house' }));

	const multiplier = service.calculateMultiplier(kingdomCoordKey(0, 0));
	assert.equal(multiplier, 1.2);
});

test('advanceTick applies current multiplier stacking semantics for lumber camp synergies', () => {
	const world = new WorldStore();
	const service = new ProductionService(world);
	world.resources.set('wood', 0);
	world.upsertKingdomTile(createTile({ q: 0, r: 0, buildingId: 'lumber_camp' }));
	world.upsertKingdomTile(createTile({ q: 1, r: 1, buildingId: 'farm' }));
	world.upsertKingdomTile(createTile({ q: 2, r: 0, buildingId: 'house' }));

	service.advanceTick();

	assert.equal(world.resources.get('wood'), 14);
});
