import { derived } from 'svelte/store';
import type { ArmyUnitSnapshot, BuildingCatalogEntry, CombatSnapshot } from '../shared/multiplayer/protocol';
import { gameSessionState, type SelectedTileView } from '../multiplayer/client/gameSessionStore';

export const blueprintInventory = derived(gameSessionState, ($state) => $state.blueprints);

export type ShopViewState = {
	offers: Array<string | null>;
	buyCost: number;
	rerollCost: number;
};

export const shopState = derived(gameSessionState, ($state): ShopViewState => $state.shop);

export type ArmyUnitView = ArmyUnitSnapshot;

export const armyState = derived(gameSessionState, ($state): ArmyUnitView[] => $state.army);

export type CombatUiState = CombatSnapshot;

export const combatState = derived(gameSessionState, ($state): CombatUiState => $state.combat);
export const selectedTileState = derived(gameSessionState, ($state): SelectedTileView | null => $state.selectedTile);
export const buildingCatalogState = derived(gameSessionState, ($state): BuildingCatalogEntry[] => $state.catalog);
export const combatOpenRequestState = derived(gameSessionState, ($state) => $state.combatOpenRequest);
