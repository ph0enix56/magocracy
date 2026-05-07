import assert from 'node:assert/strict';
import { test } from 'node:test';
import { kingdomCoordKey } from '../../../../src/shared/kingdom/kingdomGrid';
import { WorldStore } from '../../../../src/server/gameplay/WorldStore';
import { recomputeHousedArmyUnit } from '../../../../src/server/gameplay/services/armyRuntime';
import { getUnitDef } from '../../../../src/server/config/buildings';

test('recomputeHousedArmyUnit applies neighbor stat effects', () => {
	const world = new WorldStore();
	
	// Tile (0,0) with Swordsman Camp
	const armyTileId = kingdomCoordKey(0, 0);
	const armyTile = {
		tileId: armyTileId,
		coord: { q: 0, r: 0 },
		building: {
			buildingId: 'swordsman_camp',
			status: 'active' as const,
			progress: 4,
			housedUnitId: ''
		}
	};
	world.upsertKingdomTile(armyTile);
	const unit = world.spawnArmyUnit('swordsman');
	armyTile.building.housedUnitId = unit.armyUnitId;

	// Tile (2,0) with Mining Camp (Geomancy school)
	const neighborTileId = kingdomCoordKey(2, 0);
	world.upsertKingdomTile({
		tileId: neighborTileId,
		coord: { q: 2, r: 0 },
		building: {
			buildingId: 'mining_camp',
			status: 'active' as const,
			progress: 3
		}
	});

	const baseDrFlat = getUnitDef('swordsman')!.drFlat; // 4
	
	recomputeHousedArmyUnit(world, armyTileId);
	
	// Swordsman Camp has "self-foreach; school=geomancy | school=artifact; unit:drflat; add; 1"
	// One neighbor is geomancy, so drFlat should be base + 1
	assert.equal(unit.drFlat, baseDrFlat + 1);
});
