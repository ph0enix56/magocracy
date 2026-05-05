import { derived } from 'svelte/store';
import type { BuildingCatalogEntry, LobbyPlayerSnapshot, PlayerGameView } from '../../../shared/multiplayer/snapshots';
import type { ResourceMap } from '../../../shared/domain/types';
import { gameSessionState, type SelectedTileView } from '../../client/gameSessionStore';

/** Shared selector for authoritative resources of the currently viewed player. */
export const sessionResourcesState = derived(gameSessionState, ($state): ResourceMap => $state.resources);

/** Shared selector for currently available building catalog entries. */
export const sessionBuildingCatalogState = derived(gameSessionState, ($state): BuildingCatalogEntry[] => $state.catalog);

/** Shared selector for lobby roster used by multiple projection modules. */
export const sessionLobbyPlayersState = derived(gameSessionState, ($state): LobbyPlayerSnapshot[] => $state.lobby?.players ?? []);

/** Shared selector for game player views used by multiple projection modules. */
export const sessionGamePlayersState = derived(gameSessionState, ($state): PlayerGameView[] => $state.game?.players ?? []);

/** Shared selector for tile context consumed by scene and panel projections. */
export const sessionSelectedTileState = derived(gameSessionState, ($state): SelectedTileView | null => $state.selectedTile);

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
