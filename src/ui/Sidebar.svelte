<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import type { TileSelectedPayload } from '../eventBus';
	import { eventBus } from '../eventBus';
	import { buildingSelectorState } from './uiState';

	let visible = false;
	let selected: TileSelectedPayload | null = null;

	let unsubscribe: (() => void) | null = null;

	onMount(() => {
		unsubscribe = eventBus.subscribeGameToUi((event) => {
			if (event.type === 'tile-selected') {
				selected = event.payload;
				visible = true;
			} else if (event.type === 'tile-cleared') {
				selected = null;
				visible = false;
			}
		});
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});

	function onBuild() {
		if (!selected) return;
		buildingSelectorState.set({
			isOpen: true,
			q: selected.q,
			r: selected.r
		});
		visible = false;
		selected = null;
	}

	function onDestroyClick() {
		if (!selected) return;
		eventBus.publishUiToGame({ type: 'destroy-requested', q: selected.q, r: selected.r });
		visible = false;
		selected = null;
	}
</script>

{#if visible && selected}
	<div class="sidebar">
		<h2>Tile ({selected.q}, {selected.r})</h2>
		
		{#if selected.buildingId}
			<p><strong>{selected.buildingId}</strong></p>
		{/if}

		{#if selected.constructionProgress !== undefined}
			<div class="progress-container">
				<div class="progress-bar" style="width: {selected.constructionProgress}%"></div>
			</div>
			<p>Construction: {Math.round(selected.constructionProgress)}%</p>
		{/if}

		{#if selected.productionMultiplier !== undefined}
			<p>Production Mult: x{selected.productionMultiplier.toFixed(2)}</p>
		{/if}

		{#if selected.built}
			<button on:click={onDestroyClick}>Destroy</button>
		{:else}
			<button on:click={onBuild}>Build</button>
		{/if}
	</div>
{/if}

<style>
	.sidebar {
		position: fixed;
		left: 0;
		top: 0;
		bottom: 0;
		width: 200px;
		padding: 16px;
		box-sizing: border-box;
		background: rgba(0, 0, 0, 0.7);
		color: #fff;
		font-family: system-ui, sans-serif;
		pointer-events: auto;
	}
	button {
		margin-top: 12px;
		padding: 6px 12px;
		background: #444;
		color: #fff;
		border: none;
		cursor: pointer;
	}
	button:hover {
		background: #666;
	}
	.progress-container {
		width: 100%;
		height: 10px;
		background: #333;
		margin-top: 8px;
		border-radius: 5px;
		overflow: hidden;
	}
	.progress-bar {
		height: 100%;
		background: #0f0;
		transition: width 0.3s ease;
	}
</style>
