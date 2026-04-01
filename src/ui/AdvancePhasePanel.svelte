<script lang="ts">
	import { advancePanelState } from './projections/advanceViewState';
	import { gameSessionClient } from '../multiplayer/client/gameSessionStore';

	let isSubmittingPick = false;

	function playerName(playerId: string | null | undefined): string {
		if (!playerId) return 'Unknown';
		return $advancePanelState.playerNameById[playerId] ?? playerId;
	}

	function formatCountdown(seconds: number): string {
		const total = Math.max(0, Math.floor(seconds));
		const mm = Math.floor(total / 60)
			.toString()
			.padStart(2, '0');
		const ss = (total % 60).toString().padStart(2, '0');
		return `${mm}:${ss}`;
	}

	function formatResourceName(key: string): string {
		if (!key) return key;
		return `${key.slice(0, 1).toUpperCase()}${key.slice(1)}`;
	}

	async function pickCharter(charterId: string) {
		if (isSubmittingPick) return;
		isSubmittingPick = true;
		const result = await gameSessionClient.requestAdvanceSelectCharter(charterId);
		isSubmittingPick = false;
		if (!result.ok) {
			alert(result.reason);
		}
	}

	$: selfPlayerId = $advancePanelState.selfPlayerId;
	$: currentPickerPlayerId = $advancePanelState.advance.currentPickerPlayerId;
	$: isMyTurn = $advancePanelState.isMyTurn;
	$: inReveal = $advancePanelState.inReveal;
</script>

{#if $advancePanelState.isAdvancePhase}
	<div class="advance-panel ui-panel">
		<div class="advance-header">
			<div>
				<div class="advance-title">Advance Phase</div>
				<div class="advance-subtitle">Charter Level {$advancePanelState.advance.level}</div>
			</div>
			<div class="advance-turn-block">
				{#if currentPickerPlayerId}
					<div class={`advance-turn-label ${isMyTurn ? 'advance-turn-label--mine' : ''}`}>
						Picking: {isMyTurn ? 'You' : playerName(currentPickerPlayerId)}
					</div>
					<div class="advance-timer">{formatCountdown($advancePanelState.advance.secondsRemaining)}</div>
				{:else if inReveal}
					<div class="advance-turn-label">Results reveal</div>
					<div class="advance-timer">{formatCountdown($advancePanelState.advance.secondsToPhaseEnd)}</div>
				{/if}
			</div>
		</div>

		<div class="advance-order">
			{#each $advancePanelState.advance.pickOrderPlayerIds as playerId, index (playerId)}
				<div class={`advance-order-chip ${playerId === currentPickerPlayerId ? 'advance-order-chip--active' : ''} ${playerId === selfPlayerId ? 'advance-order-chip--me' : ''}`}>
					<span class="advance-order-index">{index + 1}.</span>
					<span>{playerName(playerId)}{playerId === selfPlayerId ? ' (you)' : ''}</span>
				</div>
			{/each}
		</div>

		<div class="advance-grid">
			{#each $advancePanelState.advance.charters as charter (charter.charterId)}
				{@const takenByName = charter.selectedByPlayerId ? playerName(charter.selectedByPlayerId) : ''}
				<div class={`charter-card ${charter.selectedByPlayerId ? 'charter-card--taken' : ''}`}>
					<div class="charter-head">
						<div class="charter-title">{charter.title}</div>
						<div class="charter-level">L{charter.level}</div>
					</div>
					<div class="charter-section">
						<div class="charter-section-title">Resources</div>
						{#if charter.resources.length === 0}
							<div class="charter-empty">None</div>
						{:else}
							<div class="charter-tags">
								{#each charter.resources as grant (`${charter.charterId}-${grant.resource}`)}
									<span class="charter-tag">+{grant.amount} {formatResourceName(grant.resource)}</span>
								{/each}
							</div>
						{/if}
					</div>

					<div class="charter-section">
						<div class="charter-section-title">Blueprints</div>
						{#if charter.blueprints.length === 0}
							<div class="charter-empty">None</div>
						{:else}
							<div class="charter-tags">
								{#each charter.blueprints as blueprint (`${charter.charterId}-${blueprint.buildingId}-${blueprint.tier}`)}
									<span class="charter-tag">+{blueprint.count} {blueprint.buildingId} (T{blueprint.tier})</span>
								{/each}
							</div>
						{/if}
					</div>

					{#if charter.selectedByPlayerId}
						<div class="charter-picked">Taken by {takenByName}</div>
					{:else}
						<button
							class="ui-button charter-pick"
							disabled={!isMyTurn || isSubmittingPick}
							on:click={() => pickCharter(charter.charterId)}
						>
							{isMyTurn ? 'Pick Charter' : 'Waiting'}
						</button>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.advance-panel {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(1120px, calc(100vw - 24px));
		max-height: calc(100vh - 24px);
		overflow: auto;
		padding: 12px;
		pointer-events: auto;
	}

	.advance-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		margin-bottom: 10px;
	}

	.advance-title {
		font-size: 1.15rem;
		font-weight: 800;
	}

	.advance-subtitle {
		font-size: 0.9rem;
		opacity: 0.8;
	}

	.advance-turn-block {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}

	.advance-turn-label {
		font-weight: 700;
	}

	.advance-turn-label--mine {
		color: #7af1b9;
	}

	.advance-timer {
		font-size: 1.2rem;
		font-weight: 900;
	}

	.advance-order {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 12px;
	}

	.advance-order-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 0.85rem;
		padding: 4px 8px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.14);
	}

	.advance-order-chip--active {
		background: rgba(111, 191, 255, 0.26);
		border-color: rgba(111, 191, 255, 0.6);
	}

	.advance-order-chip--me {
		font-weight: 700;
	}

	.advance-order-index {
		opacity: 0.75;
	}

	.advance-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}

	.charter-card {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 10px;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.22);
		border: 1px solid rgba(255, 255, 255, 0.14);
	}

	.charter-card--taken {
		opacity: 0.55;
		filter: grayscale(0.45);
	}

	.charter-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}

	.charter-title {
		font-weight: 800;
	}

	.charter-level {
		font-size: 0.8rem;
		padding: 2px 7px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.12);
	}

	.charter-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.charter-section-title {
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		opacity: 0.72;
	}

	.charter-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.charter-tag {
		font-size: 0.82rem;
		padding: 3px 7px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.11);
		border: 1px solid rgba(255, 255, 255, 0.14);
	}

	.charter-empty {
		font-size: 0.88rem;
		opacity: 0.65;
	}

	.charter-picked {
		font-size: 0.88rem;
		font-weight: 700;
		opacity: 0.9;
	}

	.charter-pick {
		align-self: flex-start;
	}

	@media (max-width: 980px) {
		.advance-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 680px) {
		.advance-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
