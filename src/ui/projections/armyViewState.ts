import { derived } from 'svelte/store';
import type { ArmyUnit } from '../../shared/domain/gameViews';
import { gameSessionState } from '../../multiplayer/client/gameSessionStore';

export type ArmyPanelViewState = {
	units: ArmyUnit[];
	canTownInteract: boolean;
	canArmyReorder: boolean;
	isScouting: boolean;
	viewedPlayerName: string | null;
};

export const armyPanelState = derived(gameSessionState, ($state): ArmyPanelViewState => ({
	units: $state.army,
	canTownInteract: $state.canTownInteract,
	canArmyReorder: $state.canArmyReorder,
	isScouting: $state.isScouting,
	viewedPlayerName: $state.viewedPlayer?.name ?? null
}));
