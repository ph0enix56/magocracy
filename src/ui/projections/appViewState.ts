import { derived } from 'svelte/store';
import type { GamePhase } from '../../shared/multiplayer/snapshots';
import { gameSessionState } from '../../multiplayer/client/gameSessionStore';

export type OverlayScreenView = 'overview' | 'town';

export type OverlayPhaseConfig = {
	fightPanel: boolean;
	advancePanel: boolean;
	showTownToggleLabel: string;
	showOverviewToggleLabel: string;
	overviewBackgroundColor: number;
};

const OVERLAY_PHASES: Partial<Record<GamePhase, OverlayPhaseConfig>> = {
	combat: {
		fightPanel: true,
		advancePanel: false,
		showTownToggleLabel: 'Show Town',
		showOverviewToggleLabel: 'Show Fight Overview',
		overviewBackgroundColor: 0xf4c7c7
	},
	advance: {
		fightPanel: false,
		advancePanel: true,
		showTownToggleLabel: 'Show Town',
		showOverviewToggleLabel: 'Show Charter Draft',
		overviewBackgroundColor: 0xe2d5b8
	}
};

/** View model consumed by the root UI shell. */
export type AppViewState = {
	activeOverlay: OverlayPhaseConfig | null;
	blueprintCount: number;
	armyCount: number;
	canTownInteract: boolean;
	canArmyReorder: boolean;
	isScouting: boolean;
	viewedPlayerName: string | null;
};

export const appViewState = derived(gameSessionState, ($state): AppViewState => ({
	activeOverlay: OVERLAY_PHASES[$state.currentPhase] ?? null,
	blueprintCount: Object.values($state.blueprints).reduce((sum, value) => {
		if (typeof value !== 'number' || !Number.isFinite(value)) return sum;
		return sum + Math.max(0, Math.floor(value));
	}, 0),
	armyCount: $state.army.length,
	canTownInteract: $state.canTownInteract,
	canArmyReorder: $state.canArmyReorder,
	isScouting: $state.isScouting,
	viewedPlayerName: $state.viewedPlayer?.name ?? null
}));
