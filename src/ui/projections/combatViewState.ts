import { derived } from 'svelte/store';
import type { CombatSnapshot } from '../../shared/domain/combatTypes';
import { gameSessionState } from '../../multiplayer/client/gameSessionStore';

export type CombatPanelViewState = {
	combat: CombatSnapshot;
	combatOpenRequest: number;
	canCombatStep: boolean;
	isFightPhase: boolean;
	isScouting: boolean;
	viewedPlayerName: string | null;
};

export const combatPanelState = derived(gameSessionState, ($state): CombatPanelViewState => ({
	combat: $state.combat,
	combatOpenRequest: $state.combatOpenRequest,
	canCombatStep: $state.canCombatStep,
	isFightPhase: $state.isFightPhase,
	isScouting: $state.isScouting,
	viewedPlayerName: $state.viewedPlayer?.name ?? null
}));
