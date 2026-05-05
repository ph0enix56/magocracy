import { derived } from 'svelte/store';
import { gameSessionState } from '../../client/gameSessionStore';

export type LeaderboardEntry = {
	playerId: string;
	name: string;
	renown: number;
	isSelf: boolean;
};

export type RenownLeaderboardViewState = {
	entries: LeaderboardEntry[];
	activeViewPlayerId: string | null;
};

function toRenown(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
	return Math.max(0, Math.floor(value));
}

export const renownLeaderboardState = derived(gameSessionState, ($state): RenownLeaderboardViewState => {
	const lobbyPlayers = $state.lobby?.players ?? [];
	const gamePlayers = $state.game?.players ?? [];
	const renownByPlayerId = new Map<string, number>();

	for (const gamePlayer of gamePlayers) {
		renownByPlayerId.set(gamePlayer.playerId, toRenown(gamePlayer.resources['renown']));
	}

	const entries = lobbyPlayers
		.map((player) => ({
			playerId: player.playerId,
			name: player.name,
			renown: renownByPlayerId.get(player.playerId) ?? 0,
			isSelf: player.playerId === $state.playerId
		}))
		.sort((a, b) => b.renown - a.renown || a.name.localeCompare(b.name));

	return {
		entries,
		activeViewPlayerId: $state.viewedPlayerId ?? $state.playerId
	};
});
