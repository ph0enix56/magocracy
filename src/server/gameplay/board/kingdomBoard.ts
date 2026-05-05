import { createExpansionTilesAround, createInitialKingdomTiles, kingdomCoordKey } from '../../../shared/kingdom/kingdomGrid';
import type { KingdomTileState } from '../model';
import type { WorldStore } from '../WorldStore';

export function initializeKingdomGrid(world: WorldStore): void {
	for (const tile of createInitialKingdomTiles()) {
		world.upsertKingdomTile(buildTileState(tile.q, tile.r, tile.isExpansionSite));
	}
}

export function expandKingdomTile(world: WorldStore, q: number, r: number): void {
	const known = new Set(world.getKingdomTiles().map((tile) => kingdomCoordKey(tile.coord.q, tile.coord.r)));
	const revealed = createExpansionTilesAround(
		q,
		r,
		(coord) => known.has(kingdomCoordKey(coord.q, coord.r)),
	);
	const tileId = kingdomCoordKey(q, r);
	const tile = world.getKingdomTile(tileId);
	if (!tile) throw new Error('Unknown tile.');
	tile.isExpansionSite = undefined;

	for (const tile of revealed) {
		world.upsertKingdomTile(buildTileState(tile.q, tile.r, tile.isExpansionSite));
	}
}

function buildTileState(q: number, r: number, isExpansionSite?: true): KingdomTileState {
	return {
		tileId: kingdomCoordKey(q, r),
		coord: { q, r },
		isExpansionSite,
		building: undefined
	};
}
