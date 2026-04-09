<script lang="ts">
	import type { BuildingCatalogEntry } from '../shared/multiplayer/snapshots';
	import { createEventDispatcher } from 'svelte';
	import { orderedResourceEntries, resourceEmoji } from './cardFormatters';

	export let def: BuildingCatalogEntry;
	export let count: number | null = null;
	export let actionLabel: string | null = null;
	export let actionDisabled: boolean = false;

	const dispatch = createEventDispatcher<{
		action: void;
		previewstart: BuildingCatalogEntry;
		previewend: BuildingCatalogEntry;
	}>();

	function onAction() {
		dispatch('action');
	}

	function onPreviewStart() {
		dispatch('previewstart', def);
	}

	function onPreviewEnd() {
		dispatch('previewend', def);
	}
</script>

<div class="building-card" role="group" on:mouseenter={onPreviewStart} on:mouseleave={onPreviewEnd}>
	<div class="building-card__main">
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
			<div class="stats">
				<div class="cost">
					Cost:
					{#each orderedResourceEntries(def.cost) as [resource, amount] (`${resource}-${amount}`)}
						<span class="cost-item">{amount} {resourceEmoji(resource)}</span>
					{/each}
				</div>
				<div class="time">Build: {def.buildTime}s</div>
			</div>
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
		justify-content: space-between;
		cursor: default;
	}

	.building-card__main {
		display: flex;
		gap: 12px;
		align-items: center;
		min-width: 0;
		flex: 1;
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
		min-width: 0;
	}

	.name {
		font-weight: bold;
		font-size: 1.1rem;
		margin-bottom: 6px;
	}

	.count {
		font-weight: 600;
		font-size: 0.9rem;
		color: #ffd700;
		margin-left: 6px;
	}

	.stats {
		font-size: 0.85rem;
		color: #aaa;
		display: flex;
		gap: 18px;
		align-items: center;
		flex-wrap: wrap;
	}

	.cost,
	.time {
		display: flex;
		align-items: center;
	}

	.cost-item {
		margin-left: 8px;
		color: #ffd700;
	}

	.actions {
		flex-shrink: 0;
	}

	.actions .ui-button {
		background: #4a9eff;
		font-weight: bold;
	}

	.actions .ui-button:hover {
		background: #3a8eef;
	}
</style>
