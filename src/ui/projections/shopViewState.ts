import { derived } from 'svelte/store';
import type { BuildingCatalogEntry, ShopOfferSnapshot } from '../../shared/multiplayer/snapshots';
import { gameSessionState } from '../../multiplayer/client/gameSessionStore';

export type ShopPanelViewState = {
	offers: Array<ShopOfferSnapshot | null>;
	rerollCost: number;
	purchasableBuildings: BuildingCatalogEntry[];
	canTownInteract: boolean;
	isScouting: boolean;
	viewedPlayerName: string | null;
};

export const shopPanelState = derived(gameSessionState, ($state): ShopPanelViewState => ({
	offers: $state.shop.offers,
	rerollCost: $state.shop.rerollCost,
	purchasableBuildings: $state.catalog.filter((entry) => !entry.parentId),
	canTownInteract: $state.canTownInteract,
	isScouting: $state.isScouting,
	viewedPlayerName: $state.viewedPlayer?.name ?? null
}));
