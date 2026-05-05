import { readable } from 'svelte/store';
import type { BuildingCatalogSnapshot, KingdomTileSnapshot } from '../../../shared/multiplayer/snapshots';
import { gameSessionState } from '../../client/gameSessionStore';

const EMPTY_BUILDING_CATALOG: BuildingCatalogSnapshot = { buildings: [] };
const EMPTY_KINGDOM_TILES: KingdomTileSnapshot[] = [];

/** Projection stream for building catalog assets required by Kingdom scene. */
export const kingdomCatalogProjectionState = readable<BuildingCatalogSnapshot>(EMPTY_BUILDING_CATALOG, (set) => {
	let previousCatalogRef: BuildingCatalogSnapshot['buildings'] | null = null;
	return gameSessionState.subscribe((state) => {
		if (state.catalog === previousCatalogRef) return;
		previousCatalogRef = state.catalog;
		set({ buildings: state.catalog });
	});
});

/** Projection stream for authoritative tile snapshots rendered by Kingdom scene. */
export const kingdomTileProjectionState = readable<KingdomTileSnapshot[]>(EMPTY_KINGDOM_TILES, (set) => {
	let previousTilesRef: KingdomTileSnapshot[] | null = null;
	return gameSessionState.subscribe((state) => {
		const nextTiles = state.kingdom.tiles;
		if (nextTiles === previousTilesRef) return;
		previousTilesRef = nextTiles;
		set(nextTiles);
	});
});

/** Projection stream that controls whether expansion sites are visible in the Kingdom scene. */
export const kingdomExpansionTilesVisibleState = readable(false, (set) => {
	let previousVisible: boolean | null = null;
	return gameSessionState.subscribe((state) => {
		const visible = Math.max(0, Math.floor(state.resources['expansion'] ?? 0)) > 0;
		if (visible === previousVisible) return;
		previousVisible = visible;
		set(visible);
	});
});
