import { derived } from 'svelte/store';
import type { BuildingCatalogEntry } from '../../shared/multiplayer/contracts/snapshots';
import type { ResourceMap } from '../../shared/domain/types';
import { gameSessionState } from '../../multiplayer/client/gameSessionStore';

export type BuildingSelectorViewState = {
	blueprintInventory: ResourceMap;
	purchasableBuildings: BuildingCatalogEntry[];
	canTownInteract: boolean;
	isScouting: boolean;
	viewedPlayerName: string | null;
};

export const buildingSelectorState = derived(gameSessionState, ($state): BuildingSelectorViewState => ({
	blueprintInventory: $state.blueprints,
	purchasableBuildings: $state.catalog.filter((entry) => !entry.parentId),
	canTownInteract: $state.canTownInteract,
	isScouting: $state.isScouting,
	viewedPlayerName: $state.viewedPlayer?.name ?? null
}));
