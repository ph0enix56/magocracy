<script lang="ts">
	import { fightPanelState } from './store/fightViewState';
	import { gameSessionClient } from '../client/gameSessionStore';
	import UnitCard from './UnitCard.svelte';
	import type { BuildingCatalogEntry, UnitCatalogEntry } from '../../shared/multiplayer/snapshots';

	let isOpeningReplay = false;
	let hoveredUnitDefId: string | null = null;

	type UnitPreviewEntry = {
		unit: UnitCatalogEntry;
		tier: number;
	};

	$: unitPreviewByDefId = buildUnitPreviewByDefId($fightPanelState.catalog);
	$: hoveredUnitPreview = hoveredUnitDefId ? unitPreviewByDefId.get(hoveredUnitDefId) ?? null : null;

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
		return $fightPanelState.playerNameById[playerId] ?? playerId;
	}

	function buildUnitPreviewByDefId(catalog: BuildingCatalogEntry[]): Map<string, UnitPreviewEntry> {
		const out = new Map<string, UnitPreviewEntry>();
		for (const entry of catalog) {
			if (!entry.housedUnit) continue;
			const existing = out.get(entry.housedUnit.id);
			if (!existing || entry.tier < existing.tier) {
				out.set(entry.housedUnit.id, { unit: entry.housedUnit, tier: entry.tier });
			}
		}
		return out;
	}

	function onUnitHover(unitDefId: string): void {
		hoveredUnitDefId = unitDefId;
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
		const result = $fightPanelState.fight.results.find((entry) => entry.matchId === matchId);
		if (!result || result.status !== 'finished') return 'Pending';
		if (!result.playerBId) return 'Bye';
		if (!result.winnerPlayerId) return 'Draw';
		return `${playerName(result.winnerPlayerId)} won`;
	}

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

{#if $fightPanelState.isFightPhase}
	<div class="fight-panel ui-panel">
		<div class="fight-header">
			<div>
				<div class="fight-title">Fight Phase</div>
				<div class="fight-subtitle">
					{#if $fightPanelState.inFinalResultsReveal}
						Final results
					{:else}
						Round {$fightPanelState.fight.currentRoundIndex + 1} / {$fightPanelState.fight.totalRounds}
					{/if}
				</div>
			</div>
			<div class="fight-timer">{formatCountdown($fightPanelState.fight.secondsToNextRound)}</div>
		</div>

		<div class="fight-layout" role="group" on:mouseleave={() => (hoveredUnitDefId = null)}>
			<div class="fight-body">
				{#if $fightPanelState.fight.playerRounds.length === 0}
					<div class="fight-empty">No pairings available.</div>
				{:else}
					{#each $fightPanelState.fight.playerRounds as round (round.matchId)}
						<div class="fight-row">
							<div class="fight-row-main">
								<div class="fight-row-top">
									<div class="fight-round">R{round.roundIndex + 1}</div>
									<div class="fight-opponent">{playerName($fightPanelState.selfPlayerId)} vs {playerName(round.opponentPlayerId)}</div>
									<div class={`fight-status fight-status--${round.status}`}>{statusLabel(round.status)}</div>
									<div class="fight-result">{resultWinnerLabel(round.matchId)}</div>
								</div>
								<div class="fight-armies">
									<div class="fight-army-line">
										<span class="fight-army-name">{playerName($fightPanelState.selfPlayerId)}:</span>
										{#if round.selfArmy.length === 0}
											<span>No units</span>
										{:else}
											<span class="fight-unit-list">
												{#each round.selfArmy as unit, unitIndex (`self-${round.matchId}-${unit.unitDefId}-${unitIndex}`)}
													<button type="button" class="fight-unit-link" on:mouseenter={() => onUnitHover(unit.unitDefId)} on:focus={() => onUnitHover(unit.unitDefId)}>{unit.name}</button>{#if unitIndex < round.selfArmy.length - 1}, {/if}
												{/each}
											</span>
										{/if}
									</div>
									<div class="fight-army-line">
										<span class="fight-army-name">{playerName(round.opponentPlayerId)}:</span>
										{#if round.opponentArmy.length === 0}
											<span>No units</span>
										{:else}
											<span class="fight-unit-list">
												{#each round.opponentArmy as unit, unitIndex (`opp-${round.matchId}-${unit.unitDefId}-${unitIndex}`)}
													<button type="button" class="fight-unit-link" on:mouseenter={() => onUnitHover(unit.unitDefId)} on:focus={() => onUnitHover(unit.unitDefId)}>{unit.name}</button>{#if unitIndex < round.opponentArmy.length - 1}, {/if}
												{/each}
											</span>
										{/if}
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

			<div class="fight-preview-pane">
				{#if hoveredUnitPreview}
					<UnitCard unit={hoveredUnitPreview.unit} tier={hoveredUnitPreview.tier} showNotch={false} />
				{:else}
					<div class="fight-preview-empty ui-muted">Hover a unit name to preview details.</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.fight-panel {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(980px, calc(100vw - var(--space-xl)));
		max-height: calc(100vh - var(--space-xl));
		overflow: auto;
		padding: var(--space-md);
		pointer-events: auto;
	}

	.fight-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-md);
		margin-bottom: 10px;
	}

	.fight-title {
		font-size: 1.1rem;
		font-weight: var(--font-weight-extrabold);
	}

	.fight-subtitle {
		font-size: 0.9rem;
		opacity: 0.8;
	}

	.fight-timer {
		font-size: 1.4rem;
		font-weight: var(--font-weight-black);
		letter-spacing: 0.03em;
	}

	.fight-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(340px, 420px);
		gap: var(--space-md);
		align-items: stretch;
	}

	.fight-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.fight-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: var(--space-sm);
		border-radius: var(--radius-md);
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.fight-row-main {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: var(--space-sm);
		flex: 1;
	}

	.fight-row-top {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.fight-round {
		font-weight: var(--font-weight-extrabold);
		min-width: 34px;
	}

	.fight-opponent {
		font-weight: var(--font-weight-bold);
	}

	.fight-armies {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		font-size: 0.9rem;
		opacity: 0.9;
	}

	.fight-army-line {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.fight-unit-list {
		display: inline;
	}

	.fight-unit-link {
		padding: 0;
		border: none;
		background: transparent;
		color: #dce8ff;
		font: inherit;
		cursor: pointer;
		text-decoration: underline;
	}

	.fight-unit-link:hover,
	.fight-unit-link:focus-visible {
		color: var(--color-text-light);
	}

	.fight-army-name {
		font-weight: var(--font-weight-bold);
	}

	.fight-status {
		font-size: 0.85rem;
		padding: 2px var(--space-sm);
		border-radius: var(--radius-pill);
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

	.fight-preview-pane {
		position: sticky;
		top: 0;
		min-height: 400px;
		max-height: calc(100vh - 130px);
		overflow: auto;
		padding-right: var(--space-xs);
	}

	.fight-preview-empty {
		padding: var(--space-md);
		border: 1px dashed var(--color-border-dashed);
		border-radius: var(--radius-md);
	}

	.fight-empty {
		padding: 10px;
		opacity: 0.75;
	}

	@media (max-width: 1050px) {
		.fight-layout {
			grid-template-columns: 1fr;
		}

		.fight-preview-pane {
			position: static;
			max-height: 42vh;
		}
	}
</style>
