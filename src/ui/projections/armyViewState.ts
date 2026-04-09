import { derived } from 'svelte/store';
import type { ArmyUnit } from '../../shared/domain/gameViews';
import type { BuildingCatalogEntry } from '../../shared/multiplayer/snapshots';
import { gameSessionState } from '../../multiplayer/client/gameSessionStore';

export type ArmyPanelViewState = {
	units: ArmyUnit[];
	catalog: BuildingCatalogEntry[];
	canTownInteract: boolean;
	canArmyReorder: boolean;
	isScouting: boolean;
	viewedPlayerName: string | null;
};

export const armyPanelState = derived(gameSessionState, ($state): ArmyPanelViewState => ({
	units: $state.army,
	catalog: $state.catalog,
	canTownInteract: $state.canTownInteract,
	canArmyReorder: $state.canArmyReorder,
	isScouting: $state.isScouting,
	viewedPlayerName: $state.viewedPlayer?.name ?? null
}));
