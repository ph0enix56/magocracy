import { derived } from 'svelte/store';
import type { AdvanceSnapshot, BuildingCatalogEntry, FightSnapshot, LobbyPlayerSnapshot } from '../shared/multiplayer/contracts/snapshots';
import type { ArmyUnit } from '../shared/domain/gameViews';
import type { CombatSnapshot } from '../shared/domain/combatTypes';
import { gameSessionState, type SelectedTileView } from '../multiplayer/client/gameSessionStore';

export const blueprintInventory = derived(gameSessionState, ($state) => $state.blueprints);

export type ShopViewState = {
	offers: Array<string | null>;
	buyCost: number;
	rerollCost: number;
};

export const shopState = derived(gameSessionState, ($state): ShopViewState => $state.shop);

export const armyState = derived(gameSessionState, ($state): ArmyUnit[] => $state.army);

export const combatState = derived(gameSessionState, ($state): CombatSnapshot => $state.combat);
export const fightState = derived(gameSessionState, ($state): FightSnapshot => $state.fight);
export const advanceState = derived(gameSessionState, ($state): AdvanceSnapshot => $state.advance);
export const selectedTileState = derived(gameSessionState, ($state): SelectedTileView | null => $state.selectedTile);
export const buildingCatalogState = derived(gameSessionState, ($state): BuildingCatalogEntry[] => $state.catalog);
export const combatOpenRequestState = derived(gameSessionState, ($state) => $state.combatOpenRequest);

export type ViewModeState = {
	canIssueCommands: boolean;
	canTownInteract: boolean;
	canArmyReorder: boolean;
	canCombatStep: boolean;
	currentPhase: string;
	isFightPhase: boolean;
	isAdvancePhase: boolean;
	isScouting: boolean;
	viewedPlayer: LobbyPlayerSnapshot | null;
	viewedPlayerId: string | null;
};

export const viewModeState = derived(
	gameSessionState,
	($state): ViewModeState => ({
		canIssueCommands: $state.canIssueCommands,
		canTownInteract: $state.canTownInteract,
		canArmyReorder: $state.canArmyReorder,
		canCombatStep: $state.canCombatStep,
		currentPhase: $state.currentPhase,
		isFightPhase: $state.isFightPhase,
		isAdvancePhase: $state.isAdvancePhase,
		isScouting: $state.isScouting,
		viewedPlayer: $state.viewedPlayer,
		viewedPlayerId: $state.viewedPlayerId
	})
);
