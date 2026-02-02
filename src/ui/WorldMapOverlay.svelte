<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { eventBus } from '../eventBus';
	import { worldMapUiState } from './worldMapStore';

	let unsubscribe: (() => void) | null = null;

	onMount(() => {
		unsubscribe = eventBus.subscribeGameToUi((event) => {
			if (event.type === 'worldmap-visibility-changed') {
				worldMapUiState.update((s) =>
					event.isOpen
						? { ...s, isOpen: true }
							: { ...s, isOpen: false, points: [], selectedPoi: null }
				);
			} else if (event.type === 'worldmap-points-layout') {
				worldMapUiState.update((s) => ({ ...s, points: event.points }));
			} else if (event.type === 'worldmap-poi-selected') {
				worldMapUiState.update((s) => ({ ...s, selectedPoi: event.poi }));
			} else if (event.type === 'worldmap-poi-cleared') {
				worldMapUiState.update((s) => ({ ...s, selectedPoi: null }));
			} else if (event.type === 'worldmap-travel-updated') {
				worldMapUiState.update((s) => ({ ...s, travel: event.travel }));
			} else if (event.type === 'worldmap-action-result') {
				if (!event.ok && event.reason) alert(event.reason);
			}
		});
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});

	function ownerColor(owner: string): string {
		if (owner === 'player') return '#2d6a4f';
		if (owner === 'enemy') return '#9b2226';
		return '#3a86ff';
	}

	function canSendArmy(poi: any, travel: any): boolean {
		if (!poi) return false;
		if (!travel || travel.status !== 'idle') return false;
		if (poi.kind === 'kingdom') return false;
		if (poi.owner === 'player') return false;
		return true;
	}

	function sendArmy() {
		const s = $worldMapUiState;
		if (!s.selectedPoi) return;
		if (!canSendArmy(s.selectedPoi, s.travel)) return;
		eventBus.publishUiToGame({ type: 'worldmap-send-army', targetPointId: s.selectedPoi.id });
	}

	function canStartCombat(poi: any, travel: any): boolean {
		if (!poi) return false;
		if (!travel || travel.status !== 'arrived') return false;
		if (travel.toPointId !== poi.id) return false;
		if (poi.kind === 'kingdom') return false;
		if (poi.owner === 'player') return false;
		if (!poi.defenders || poi.defenders.length === 0) return false;
		return true;
	}

	function startCombat() {
		const s = $worldMapUiState;
		if (!s.selectedPoi) return;
		if (!canStartCombat(s.selectedPoi, s.travel)) return;
		eventBus.publishUiToGame({ type: 'worldmap-start-combat', targetPointId: s.selectedPoi.id });
	}
</script>

{#if $worldMapUiState.isOpen}
	<div class="wm-root">
		<div class="wm-header">World Map</div>

		{#if $worldMapUiState.travel.status === 'travelling'}
			<div class="wm-travel">
				Travelling → {$worldMapUiState.travel.toPointId}
				<div class="wm-travel-sub">
					Speed: {$worldMapUiState.travel.speedPerTick}/tick • ETA: {$worldMapUiState.travel.etaTicks} ticks
				</div>
				<div class="wm-travel-bar">
					<div
						class="wm-travel-fill"
						style="width:{Math.max(0, Math.min(100, 100 - ($worldMapUiState.travel.distanceRemaining / $worldMapUiState.travel.distanceTotal) * 100))}%"
					></div>
				</div>
			</div>
		{:else if $worldMapUiState.travel.status === 'arrived'}
			<div class="wm-travel">
				Arrived → {$worldMapUiState.travel.toPointId}
				<div class="wm-travel-sub">Ready to start combat from the POI prompt.</div>
			</div>
		{/if}

		{#if $worldMapUiState.selectedPoi}
			<div class="wm-prompt">
				<div class="wm-title">{$worldMapUiState.selectedPoi.name}</div>
				<div class="wm-sub">
					Owner: <span style="color:{ownerColor($worldMapUiState.selectedPoi.owner)}">{$worldMapUiState.selectedPoi.owner}</span>
				</div>
				<div class="wm-sub">Defenders:</div>
				<div class="wm-defenders">
					{#if $worldMapUiState.selectedPoi.defenders.length === 0}
						<div class="wm-muted">None</div>
					{:else}
						{#each $worldMapUiState.selectedPoi.defenders as d, i (d.unitId + ':' + i)}
							<div class="wm-defender">{d.name}</div>
						{/each}
					{/if}
				</div>
				<button
					class="wm-action"
					disabled={!canSendArmy($worldMapUiState.selectedPoi, $worldMapUiState.travel)}
					on:click={sendArmy}
				>
					Send Army
				</button>
				<button
					class="wm-action"
					disabled={!canStartCombat($worldMapUiState.selectedPoi, $worldMapUiState.travel)}
					on:click={startCombat}
				>
					Start combat
				</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.wm-root {
		position: fixed;
		inset: 0;
		pointer-events: none;
		font-family: system-ui, sans-serif;
	}
	.wm-header {
		position: absolute;
		top: 14px;
		left: 14px;
		padding: 8px 12px;
		border-radius: 10px;
		background: rgba(0, 0, 0, 0.55);
		color: #e0e1dd;
		font-size: 20px;
		letter-spacing: 0.4px;
	}
	.wm-prompt {
		position: absolute;
		right: 14px;
		bottom: 14px;
		width: 320px;
		padding: 14px;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.75);
		color: #e0e1dd;
		pointer-events: auto;
	}
	.wm-title {
		font-size: 18px;
		font-weight: 700;
		margin-bottom: 8px;
	}
	.wm-sub {
		font-size: 14px;
		opacity: 0.95;
		margin: 6px 0;
	}
	.wm-defenders {
		margin-top: 6px;
		max-height: 160px;
		overflow: auto;
		padding-right: 6px;
	}
	.wm-defender {
		font-size: 14px;
		padding: 4px 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}
	.wm-defender:last-child {
		border-bottom: none;
	}
	.wm-muted {
		opacity: 0.7;
		font-size: 14px;
	}
	.wm-action {
		margin-top: 10px;
		width: 100%;
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: rgba(255, 255, 255, 0.08);
		color: #e0e1dd;
		cursor: pointer;
	}
	.wm-action:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.wm-travel {
		position: absolute;
		top: 14px;
		left: 50%;
		transform: translateX(-50%);
		padding: 10px 14px;
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.65);
		color: #e0e1dd;
		pointer-events: none;
		text-align: center;
		min-width: 360px;
	}
	.wm-travel-sub {
		margin-top: 4px;
		font-size: 13px;
		opacity: 0.9;
	}
	.wm-travel-bar {
		margin-top: 8px;
		height: 8px;
		background: rgba(255, 255, 255, 0.12);
		border-radius: 999px;
		overflow: hidden;
	}
	.wm-travel-fill {
		height: 100%;
		background: rgba(58, 134, 255, 0.85);
		width: 0;
		transition: width 0.25s ease;
	}
</style>
