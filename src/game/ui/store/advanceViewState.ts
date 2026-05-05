import { derived } from 'svelte/store';
import type { AdvanceSnapshot } from '../../../shared/multiplayer/snapshots';
import { gameSessionState } from '../../client/gameSessionStore';

export type AdvancePanelViewState = {
	isAdvancePhase: boolean;
	selfPlayerId: string | null;
	playerNameById: Record<string, string>;
	advance: AdvanceSnapshot;
	isMyTurn: boolean;
	inReveal: boolean;
};

export const advancePanelState = derived(gameSessionState, ($state): AdvancePanelViewState => {
	const playerNameById: Record<string, string> = {};
	for (const player of $state.lobby?.players ?? []) {
		playerNameById[player.playerId] = player.name;
	}

	const selfPlayerId = $state.playerId;
	const currentPickerPlayerId = $state.advance.currentPickerPlayerId;

	return {
		isAdvancePhase: $state.isAdvancePhase,
		selfPlayerId,
		playerNameById,
		advance: $state.advance,
		isMyTurn: !!selfPlayerId && currentPickerPlayerId === selfPlayerId,
		inReveal: !currentPickerPlayerId && $state.advance.secondsToPhaseEnd > 0
	};
});
