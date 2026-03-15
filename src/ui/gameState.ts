import { derived } from 'svelte/store';
import type { ArmyUnitSnapshot, BuildingCatalogEntry, CombatSnapshot, FightSnapshot, LobbyPlayerSnapshot } from '../shared/multiplayer/protocol';
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
export const fightState = derived(gameSessionState, ($state): FightSnapshot => $state.fight);
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
		isScouting: $state.isScouting,
		viewedPlayer: $state.viewedPlayer,
		viewedPlayerId: $state.viewedPlayerId
	})
);
