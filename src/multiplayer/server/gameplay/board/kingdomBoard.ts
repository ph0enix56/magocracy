import { createInitialKingdomTiles, createRevealTilesAround, kingdomCoordKey } from '../../../../shared/kingdom/kingdomGrid';
import type { KingdomTileState } from '../model';
import type { WorldStore } from '../WorldStore';

export function initializeKingdomGrid(world: WorldStore, pickBlockerId: () => string): void {
	for (const tile of createInitialKingdomTiles(pickBlockerId)) {
		world.upsertKingdomTile(buildTileState(tile.q, tile.r, tile.blockerId));
	}
}

export function revealNeighborTiles(world: WorldStore, q: number, r: number, pickBlockerId: () => string): void {
	const known = new Set(world.getKingdomTiles().map((tile) => kingdomCoordKey(tile.coord.q, tile.coord.r)));
	const revealed = createRevealTilesAround(
		q,
		r,
		(coord) => known.has(kingdomCoordKey(coord.q, coord.r)),
		pickBlockerId
	);

	for (const tile of revealed) {
		world.upsertKingdomTile(buildTileState(tile.q, tile.r, tile.blockerId));
	}
}

function buildTileState(q: number, r: number, blockerId?: string): KingdomTileState {
	return {
		tileId: kingdomCoordKey(q, r),
		coord: { q, r },
		building: blockerId
			? {
				buildingId: blockerId,
				status: 'active',
				progress: 0
			}
			: undefined
	};
}
