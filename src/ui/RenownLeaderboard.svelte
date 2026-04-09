<script lang="ts">
	import { renownLeaderboardState, type LeaderboardEntry } from './projections/renownLeaderboardState';
	import { gameSessionClient } from '../multiplayer/client/gameSessionStore';

	let hoveredPlayerId: string | null = null;

	function hoverEntry(entry: LeaderboardEntry): void {
		hoveredPlayerId = entry.isSelf ? null : entry.playerId;
	}

	function clearHover(): void {
		hoveredPlayerId = null;
	}

	function selectEntry(entry: LeaderboardEntry): void {
		if (entry.isSelf) {
			gameSessionClient.viewOwnTown();
			return;
		}
		gameSessionClient.scoutPlayer(entry.playerId);
	}
</script>

{#if $renownLeaderboardState.entries.length > 1}
	<div class="renown-leaderboard" aria-label="Renown leaderboard">
		{#each $renownLeaderboardState.entries as entry (entry.playerId)}
			<button
				type="button"
				class="leaderboard-card"
				class:leaderboard-card--self={entry.isSelf}
				class:leaderboard-card--hover={hoveredPlayerId === entry.playerId}
				class:leaderboard-card--active={$renownLeaderboardState.activeViewPlayerId === entry.playerId && !entry.isSelf}
				on:mouseenter={() => hoverEntry(entry)}
				on:mouseleave={clearHover}
				on:focus={() => hoverEntry(entry)}
				on:blur={clearHover}
				on:click={() => selectEntry(entry)}
				aria-label={entry.isSelf ? `Your renown: ${entry.renown}` : `Scout ${entry.name}`}
			>
				<div class="leaderboard-name">{entry.name}</div>
				<div class="leaderboard-score">{hoveredPlayerId === entry.playerId && !entry.isSelf ? 'Scout...' : entry.renown}</div>
			</button>
		{/each}
	</div>
{/if}

<style>
	.renown-leaderboard {
		position: absolute;
		top: 176px;
		right: var(--ui-edge-right, 16px);
		width: 142px;
		max-height: calc(100vh - 176px - 116px);
		overflow-y: auto;
		padding: 10px 8px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		background: rgba(0, 0, 0, 0.5);
		border-radius: 4px;
		pointer-events: auto;
	}

	.leaderboard-card {
		width: 100%;
		height: 54px;
		padding: 0;
		border: 0;
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.7);
		color: #fff;
		text-align: center;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		justify-content: center;
		transition: border-color 0.16s ease, background 0.16s ease;
	}

	.leaderboard-card--hover,
	.leaderboard-card--active,
	.leaderboard-card:focus-visible {
		border: 2px solid #ffffff;
	}

	.leaderboard-card--self {
		border: 2px solid #ffd52d;
	}

	.leaderboard-card--self.leaderboard-card--hover,
	.leaderboard-card--self:focus-visible {
		border-color: #ffd52d;
	}

	.leaderboard-name {
		height: 27px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: var(--ui-font-size-sm);
		font-weight: 400;
		line-height: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		padding: 0 6px;
	}

	.leaderboard-card--self .leaderboard-name {
		font-weight: 700;
	}

	.leaderboard-score {
		height: 27px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: var(--ui-font-size-lg);
		font-weight: 400;
		line-height: 1;
	}

	.leaderboard-card--hover .leaderboard-score {
		font-size: var(--ui-font-size-md);
		font-style: italic;
	}

	@media (max-width: 1200px) {
		.renown-leaderboard {
			top: 168px;
			right: var(--ui-edge-right, 16px);
			transform: scale(0.9);
			transform-origin: top right;
		}
	}
</style>
