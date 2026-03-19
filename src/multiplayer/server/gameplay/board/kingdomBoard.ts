import { createInitialKingdomTiles, createRevealTilesAround, kingdomCoordKey } from '../../../../shared/kingdom/kingdomGrid';
import type { Entity } from '../model';
import type { WorldStore } from '../ServerEcsWorld';

export function initializeKingdomGrid(world: WorldStore, pickBlockerId: () => string): void {
	for (const tile of createInitialKingdomTiles(pickBlockerId)) {
		world.addEntity(buildTileEntity(tile.q, tile.r, tile.blockerId));
	}
}

export function revealNeighborTiles(world: WorldStore, q: number, r: number, pickBlockerId: () => string): void {
	const known = new Set(world.getEntitiesWith(['position']).map((entity) => kingdomCoordKey(entity.position!.q, entity.position!.r)));
	const revealed = createRevealTilesAround(
		q,
		r,
		(coord) => known.has(kingdomCoordKey(coord.q, coord.r)),
		pickBlockerId
	);

	for (const tile of revealed) {
		world.addEntity(buildTileEntity(tile.q, tile.r, tile.blockerId));
	}
}

function buildTileEntity(q: number, r: number, blockerId?: string): Entity {
	return {
		id: kingdomCoordKey(q, r),
		position: { q, r },
		building: blockerId
			? {
				buildingId: blockerId,
				status: 'active',
				progress: 0
			}
			: undefined
	};
}
