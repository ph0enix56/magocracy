import { derived } from 'svelte/store';
import { gameSessionState } from '../../multiplayer/client/gameSessionStore';

/** Shared interaction and scouting context used across UI projections. */
export type ViewContextState = {
	playerId: string | null;
	viewedPlayerId: string | null;
	viewedPlayerName: string | null;
	isScouting: boolean;
	canTownInteract: boolean;
	canArmyReorder: boolean;
	canCombatStep: boolean;
	currentPhase: string;
	isFightPhase: boolean;
	isAdvancePhase: boolean;
};

export const viewContextState = derived(gameSessionState, ($state): ViewContextState => ({
	playerId: $state.playerId,
	viewedPlayerId: $state.viewedPlayerId,
	viewedPlayerName: $state.viewedPlayer?.name ?? null,
	isScouting: $state.isScouting,
	canTownInteract: $state.canTownInteract,
	canArmyReorder: $state.canArmyReorder,
	canCombatStep: $state.canCombatStep,
	currentPhase: $state.currentPhase,
	isFightPhase: $state.isFightPhase,
	isAdvancePhase: $state.isAdvancePhase
}));