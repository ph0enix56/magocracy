<script lang="ts">
	import { fightState } from './gameState';
	import { gameSessionClient, gameSessionState } from '../multiplayer/client/gameSessionStore';

	let isOpeningReplay = false;

	function formatCountdown(seconds: number): string {
		const total = Math.max(0, Math.floor(seconds));
		const mm = Math.floor(total / 60)
			.toString()
			.padStart(2, '0');
		const ss = (total % 60).toString().padStart(2, '0');
		return `${mm}:${ss}`;
	}

	function playerName(playerId: string | null | undefined): string {
		if (!playerId) return 'BYE';
		const player = $gameSessionState.lobby?.players.find((entry) => entry.playerId === playerId);
		return player?.name ?? playerId;
	}

	function formatArmyUnits(units: Array<{ name: string; trainingLevel: number }>): string {
		if (units.length === 0) return 'No units';
		return units.map((unit) => `${unit.name} (Lv ${unit.trainingLevel})`).join(', ');
	}

	function statusLabel(status: string): string {
		switch (status) {
			case 'pending':
				return 'Pending';
			case 'won':
				return 'Victory';
			case 'lost':
				return 'Defeat';
			case 'draw':
				return 'Draw';
			case 'bye':
				return 'Bye';
			default:
				return status;
		}
	}

	function resultWinnerLabel(matchId: string): string {
		const result = $fightState.results.find((entry) => entry.matchId === matchId);
		if (!result || result.status !== 'finished') return 'Pending';
		if (!result.playerBId) return 'Bye';
		if (!result.winnerPlayerId) return 'Draw';
		return `${playerName(result.winnerPlayerId)} won`;
	}

	$: inFinalResultsReveal = $fightState.currentRoundIndex >= $fightState.encountersPerPhase;

	async function openReplay(matchId: string) {
		if (isOpeningReplay) return;
		isOpeningReplay = true;
		const result = await gameSessionClient.requestFightReplayOpen(matchId);
		isOpeningReplay = false;
		if (!result.ok) {
			alert(result.reason);
		}
	}
</script>

{#if $gameSessionState.isFightPhase}
	<div class="fight-panel ui-panel">
		<div class="fight-header">
			<div>
				<div class="fight-title">Fight Phase</div>
				<div class="fight-subtitle">
					{#if inFinalResultsReveal}
						Final results
					{:else}
						Round {$fightState.currentRoundIndex + 1} / {$fightState.encountersPerPhase}
					{/if}
				</div>
			</div>
			<div class="fight-timer">{formatCountdown($fightState.secondsToNextRound)}</div>
		</div>

		<div class="fight-body">
			{#if $fightState.playerRounds.length === 0}
				<div class="fight-empty">No pairings available.</div>
			{:else}
				{#each $fightState.playerRounds as round (round.matchId)}
					<div class="fight-row">
						<div class="fight-row-main">
							<div class="fight-row-top">
								<div class="fight-round">R{round.roundIndex + 1}</div>
								<div class="fight-opponent">{playerName($gameSessionState.playerId)} vs {playerName(round.opponentPlayerId)}</div>
								<div class={`fight-status fight-status--${round.status}`}>{statusLabel(round.status)}</div>
								<div class="fight-result">{resultWinnerLabel(round.matchId)}</div>
							</div>
							<div class="fight-armies">
								<div class="fight-army-line">
									<span class="fight-army-name">{playerName($gameSessionState.playerId)}:</span>
									<span>{formatArmyUnits(round.selfArmy)}</span>
								</div>
								<div class="fight-army-line">
									<span class="fight-army-name">{playerName(round.opponentPlayerId)}:</span>
									<span>{formatArmyUnits(round.opponentArmy)}</span>
								</div>
							</div>
						</div>
						<button class="ui-button ui-button--ghost replay-btn" disabled={!round.replayAvailable || isOpeningReplay} on:click={() => openReplay(round.matchId)}>
							Replay
						</button>
					</div>
				{/each}
			{/if}
		</div>
	</div>
{/if}

<style>
	.fight-panel {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(980px, calc(100vw - 24px));
		max-height: calc(100vh - 24px);
		overflow: auto;
		padding: 12px;
		pointer-events: auto;
	}

	.fight-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		margin-bottom: 10px;
	}

	.fight-title {
		font-size: 1.1rem;
		font-weight: 800;
	}

	.fight-subtitle {
		font-size: 0.9rem;
		opacity: 0.8;
	}

	.fight-timer {
		font-size: 1.4rem;
		font-weight: 900;
		letter-spacing: 0.03em;
	}

	.fight-body {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.fight-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 8px;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.fight-row-main {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 8px;
		flex: 1;
	}

	.fight-row-top {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.fight-round {
		font-weight: 800;
		min-width: 34px;
	}

	.fight-opponent {
		font-weight: 700;
	}

	.fight-armies {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.9rem;
		opacity: 0.9;
	}

	.fight-army-line {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.fight-army-name {
		font-weight: 700;
	}

	.fight-status {
		font-size: 0.85rem;
		padding: 2px 8px;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.22);
	}

	.fight-status--won {
		background: rgba(28, 132, 72, 0.35);
	}

	.fight-status--lost {
		background: rgba(160, 36, 36, 0.35);
	}

	.fight-status--draw {
		background: rgba(104, 104, 104, 0.35);
	}

	.fight-status--pending {
		background: rgba(80, 80, 80, 0.25);
	}

	.fight-status--bye {
		background: rgba(89, 70, 30, 0.35);
	}

	.fight-result {
		opacity: 0.85;
		font-size: 0.9rem;
	}

	.replay-btn {
		min-width: 86px;
	}

	.fight-empty {
		padding: 10px;
		opacity: 0.75;
	}
</style>
