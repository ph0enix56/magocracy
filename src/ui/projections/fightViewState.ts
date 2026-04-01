import { derived } from 'svelte/store';
import type { FightSnapshot } from '../../shared/multiplayer/contracts/snapshots';
import { gameSessionState } from '../../multiplayer/client/gameSessionStore';

export type FightPanelViewState = {
	isFightPhase: boolean;
	selfPlayerId: string | null;
	playerNameById: Record<string, string>;
	fight: FightSnapshot;
	inFinalResultsReveal: boolean;
};

export const fightPanelState = derived(gameSessionState, ($state): FightPanelViewState => {
	const playerNameById: Record<string, string> = {};
	for (const player of $state.lobby?.players ?? []) {
		playerNameById[player.playerId] = player.name;
	}

	const fight = $state.fight;

	return {
		isFightPhase: $state.isFightPhase,
		selfPlayerId: $state.playerId,
		playerNameById,
		fight,
		inFinalResultsReveal: fight.currentRoundIndex >= fight.encountersPerPhase
	};
});
