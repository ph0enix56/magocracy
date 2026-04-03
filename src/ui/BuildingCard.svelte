<script lang="ts">
	import type { BuildingCatalogEntry } from '../shared/multiplayer/snapshots';
	import { createEventDispatcher } from 'svelte';

	export let def: BuildingCatalogEntry;
	export let count: number | null = null;
	export let actionLabel: string | null = null;
	export let actionDisabled: boolean = false;

	const dispatch = createEventDispatcher<{ action: void }>();

	function onAction() {
		dispatch('action');
	}
</script>

<div class="building-card">
	<div class="icon-container">
		<img src={`assets/${def.assetPath}`} alt={def.name} />
	</div>
	<div class="info">
		<div class="name">
			{def.name}
			{#if count !== null}
				<span class="count">x{count}</span>
			{/if}
		</div>
		<div class="description">{def.description}</div>
		<div class="stats">
			<div class="cost">
				Cost:
				{#each Object.entries(def.cost) as [res, amount]}
					<span class="cost-item">{amount} {res}</span>
				{/each}
			</div>
			<div class="time">Time: {def.buildTime}s</div>
		</div>
	</div>
	<div class="actions">
		{#if actionLabel}
			<button class="ui-button" disabled={actionDisabled} on:click={onAction}>{actionLabel}</button>
		{/if}
	</div>
</div>

<style>
	.building-card {
		display: flex;
		background: #333;
		border-radius: 4px;
		padding: 12px;
		gap: 16px;
		align-items: center;
	}

	.icon-container {
		width: 64px;
		height: 64px;
		background: #222;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.icon-container img {
		max-width: 100%;
		max-height: 100%;
	}

	.info {
		flex: 1;
	}

	.name {
		font-weight: bold;
		font-size: 1.1rem;
		margin-bottom: 4px;
	}

	.count {
		font-weight: 600;
		font-size: 0.9rem;
		color: #ffd700;
		margin-left: 6px;
	}

	.description {
		font-size: 0.9rem;
		color: #ccc;
		margin-bottom: 8px;
	}

	.stats {
		font-size: 0.85rem;
		color: #aaa;
		display: flex;
		gap: 16px;
	}

	.cost-item {
		margin-right: 8px;
		color: #ffd700;
	}

	.actions .ui-button {
		background: #4a9eff;
		font-weight: bold;
	}

	.actions .ui-button:hover {
		background: #3a8eef;
	}
</style>
