import { derived } from 'svelte/store';
import type { SelectedTileView } from '../../multiplayer/client/gameSessionStore';
import { gameSessionState } from '../../multiplayer/client/gameSessionStore';

export type SidebarViewState = {
	selectedTile: SelectedTileView | null;
	canTownInteract: boolean;
	isScouting: boolean;
	viewedPlayerName: string | null;
};

export const sidebarViewState = derived(gameSessionState, ($state): SidebarViewState => ({
	selectedTile: $state.selectedTile,
	canTownInteract: $state.canTownInteract,
	isScouting: $state.isScouting,
	viewedPlayerName: $state.viewedPlayer?.name ?? null
}));
