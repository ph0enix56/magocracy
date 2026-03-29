import type { KingdomTileState } from '../model';
import type { WorldStore } from '../WorldStore';

const DOUBLED_DIRECTIONS = [
	{ dq: 1, dr: 1 },
	{ dq: 2, dr: 0 },
	{ dq: 1, dr: -1 },
	{ dq: -1, dr: -1 },
	{ dq: -2, dr: 0 },
	{ dq: -1, dr: 1 }
] as const;

export function getNeighborsFromTiles(tiles: KingdomTileState[], q: number, r: number): KingdomTileState[] {
	return DOUBLED_DIRECTIONS
		.map(({ dq, dr }) => tiles.find((tile) => tile.coord.q === q + dq && tile.coord.r === r + dr))
		.filter((tile): tile is KingdomTileState => !!tile);
}

export function getNeighborsFromWorld(world: WorldStore, q: number, r: number): KingdomTileState[] {
	return getNeighborsFromTiles(world.getKingdomTiles(), q, r);
}
