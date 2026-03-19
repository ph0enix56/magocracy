import { createInitialKingdomTiles, createRevealTilesAround, kingdomCoordKey } from '../../../../shared/kingdom/kingdomGrid';
import type { Entity } from '../model';
import type { ServerEcsWorld } from '../ServerEcsWorld';

export function initializeKingdomGrid(ecs: ServerEcsWorld, pickBlockerId: () => string): void {
	for (const tile of createInitialKingdomTiles(pickBlockerId)) {
		ecs.addEntity(buildTileEntity(tile.q, tile.r, tile.blockerId));
	}
}

export function revealNeighborTiles(ecs: ServerEcsWorld, q: number, r: number, pickBlockerId: () => string): void {
	const known = new Set(ecs.getEntitiesWith(['position']).map((entity) => kingdomCoordKey(entity.position!.q, entity.position!.r)));
	const revealed = createRevealTilesAround(
		q,
		r,
		(coord) => known.has(kingdomCoordKey(coord.q, coord.r)),
		pickBlockerId
	);

	for (const tile of revealed) {
		ecs.addEntity(buildTileEntity(tile.q, tile.r, tile.blockerId));
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
