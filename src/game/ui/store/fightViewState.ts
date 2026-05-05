import { derived } from 'svelte/store';
import type { BuildingCatalogEntry, FightSnapshot } from '../../../shared/multiplayer/snapshots';
import { gameSessionState } from '../../client/gameSessionStore';

export type FightPanelViewState = {
	isFightPhase: boolean;
	selfPlayerId: string | null;
	playerNameById: Record<string, string>;
	fight: FightSnapshot;
	catalog: BuildingCatalogEntry[];
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
		catalog: $state.catalog,
		inFinalResultsReveal: fight.currentRoundIndex >= fight.totalRounds
	};
});
