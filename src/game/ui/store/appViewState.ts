import { derived } from 'svelte/store';
import type { GamePhase } from '../../../shared/multiplayer/snapshots';
import { gameSessionState } from '../../client/gameSessionStore';

export type OverlayScreenView = 'overview' | 'town';

export type OverlayPhaseConfig = {
	fightPanel: boolean;
	advancePanel: boolean;
	overviewBackgroundColor: number;
	hideTownRender: boolean;
	isTownToggleable: boolean;
};

const OVERLAY_PHASES: Partial<Record<GamePhase, OverlayPhaseConfig>> = {
	advance: {
		fightPanel: false,
		advancePanel: true,
		overviewBackgroundColor: 0xE2D5B8,
		hideTownRender: true,
		isTownToggleable: true
	},
	build: {
		fightPanel: false,
		advancePanel: false,
		overviewBackgroundColor: 0xB9EAF5,
		hideTownRender: false,
		isTownToggleable: false
	},
	combat: {
		fightPanel: true,
		advancePanel: false,
		overviewBackgroundColor: 0xF4C7C7,
		hideTownRender: true,
		isTownToggleable: true
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
