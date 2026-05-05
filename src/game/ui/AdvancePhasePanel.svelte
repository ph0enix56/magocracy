<script lang="ts">
	import { advancePanelState } from './store/advanceViewState';
	import { gameSessionClient, gameSessionState } from '../client/gameSessionStore';
	import DistrictDetailCard from './DistrictDetailCard.svelte';
	import UnitCard from './UnitCard.svelte';
	import type { BuildingCatalogEntry } from '../../shared/multiplayer/snapshots';

	let isSubmittingPick = false;
	let previewBuilding: BuildingCatalogEntry | null = null;
	let popoutLeft = 0;
	let popoutTop = 0;

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

	function buildingName(buildingId: string): string {
		const entry = $gameSessionState.catalog.find(c => c.id === buildingId);
		return entry?.name ?? buildingId;
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

	function openBlueprintPopout(event: PointerEvent, buildingId: string) {
		const entry = $gameSessionState.catalog.find(c => c.id === buildingId);
		if (!entry) return;
		previewBuilding = entry;

		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const cardWidth = 430;
		const cardHeight = 320;

		let nextLeft = rect.right + 12;
		if (nextLeft + cardWidth > window.innerWidth) {
			nextLeft = Math.max(8, rect.left - cardWidth - 12);
		}

		let nextTop = rect.top;
		if (nextTop + cardHeight > window.innerHeight) {
			nextTop = Math.max(8, window.innerHeight - cardHeight - 8);
		}

		popoutLeft = nextLeft;
		popoutTop = nextTop;
	}

	function closePopout() {
		previewBuilding = null;
	}
</script>

<svelte:window on:pointerdown={closePopout} />

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
									<button
										class="charter-tag charter-tag--interactive"
										on:pointerdown|stopPropagation={(e) => openBlueprintPopout(e, blueprint.buildingId)}
									>
										+{blueprint.count} {buildingName(blueprint.buildingId)} (T{blueprint.tier})
									</button>
								{/each}
							</div>
						{/if}
					</div>

					{#if charter.selectedByPlayerId}
						<div class="charter-picked">Taken by {takenByName}</div>
					{:else}
						<button
							class="ui-button ui-button--action charter-pick"
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

	{#if previewBuilding}
		<div
			class="blueprint-popout"
			style="left: {popoutLeft}px; top: {popoutTop}px;"
			on:pointerdown|stopPropagation
		>
			<DistrictDetailCard def={previewBuilding} showNotch={false} />
			{#if previewBuilding.housedUnit}
				<div class="blueprint-popout-unit">
					<UnitCard unit={previewBuilding.housedUnit} tier={previewBuilding.tier} showNotch={false} />
				</div>
			{/if}
		</div>
	{/if}
{/if}

<style>
	.advance-panel {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(1120px, calc(100vw - var(--space-xl)));
		max-height: calc(100vh - var(--space-xl));
		overflow: auto;
		padding: var(--space-md);
		pointer-events: auto;
	}

	.advance-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-md);
		margin-bottom: 10px;
	}

	.advance-title {
		font-size: 1.15rem;
		font-weight: var(--font-weight-extrabold);
	}

	.advance-subtitle {
		font-size: 0.9rem;
		opacity: 0.8;
	}

	.advance-turn-block {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--space-xs);
	}

	.advance-turn-label {
		font-weight: var(--font-weight-bold);
	}

	.advance-turn-label--mine {
		color: #7af1b9;
	}

	.advance-timer {
		font-size: 1.2rem;
		font-weight: var(--font-weight-black);
	}

	.advance-order {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: var(--space-md);
	}

	.advance-order-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 0.85rem;
		padding: var(--space-xs) var(--space-sm);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.14);
	}

	.advance-order-chip--active {
		background: rgba(111, 191, 255, 0.26);
		border-color: rgba(111, 191, 255, 0.6);
	}

	.advance-order-chip--me {
		font-weight: var(--font-weight-bold);
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
		border-radius: var(--space-sm);
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
		gap: var(--space-sm);
	}

	.charter-title {
		font-weight: var(--font-weight-extrabold);
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
		color: inherit;
		font-family: inherit;
	}

	.charter-tag--interactive {
		cursor: pointer;
	}

	.charter-tag--interactive:hover {
		background: rgba(255, 255, 255, 0.22);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.charter-empty {
		font-size: 0.88rem;
		opacity: 0.65;
	}

	.charter-picked {
		font-size: 0.88rem;
		font-weight: var(--font-weight-bold);
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

	.blueprint-popout {
		position: fixed;
		z-index: 120;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: 430px;
		max-width: calc(100vw - 32px);
		filter: drop-shadow(var(--shadow-elevation-1));
	}

	.blueprint-popout-unit {
		width: 100%;
	}
</style>
