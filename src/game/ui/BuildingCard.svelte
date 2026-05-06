<script lang="ts">
	import type { BuildingCatalogEntry } from '../../shared/multiplayer/snapshots';
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

	function tierOutlineColor(tier: number): string {
		if (tier <= 1) return 'rgba(82, 180, 98, 0.82)';
		if (tier === 2) return 'rgba(74, 145, 248, 0.82)';
		if (tier === 3) return 'rgba(164, 97, 233, 0.82)';
		return 'rgba(232, 176, 64, 0.86)';
	}
</script>

<div
	class="building-card"
	role="group"
	style={`--building-card-tier-outline: ${tierOutlineColor(def.tier)};`}
	on:mouseenter={onPreviewStart}
	on:mouseleave={onPreviewEnd}
>
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
				<div class="time">Build: {def.buildTime}⌛</div>
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
		background: var(--color-surface-3);
		border-radius: var(--radius-sm);
		padding: var(--space-md);
		gap: 14px;
		align-items: center;
		justify-content: space-between;
		cursor: default;
		box-shadow: inset 0 0 0 1px var(--building-card-tier-outline, rgba(255, 255, 255, 0.2));
	}

	.building-card__main {
		display: flex;
		gap: var(--space-md);
		align-items: center;
		min-width: 0;
		flex: 1;
	}

	.icon-container {
		width: 64px;
		height: 64px;
		background: var(--color-surface-1);
		border-radius: var(--radius-sm);
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
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.count {
		font-weight: var(--font-weight-semibold);
		font-size: 0.9rem;
		color: var(--color-accent-gold);
		margin-left: 6px;
	}

	.stats {
		font-size: 0.85rem;
		color: var(--color-text-muted);
		display: flex;
		gap: 14px;
		align-items: center;
		flex-wrap: nowrap;
		white-space: nowrap;
		overflow: hidden;
	}

	.cost,
	.time {
		display: flex;
		align-items: center;
		white-space: nowrap;
	}

	.cost-item {
		margin-left: var(--space-sm);
		color: var(--color-accent-gold);
	}

	.actions {
		flex-shrink: 0;
	}

	.actions:empty {
		display: none;
	}

	.actions .ui-button {
		background: #4a9eff;
		font-weight: bold;
		white-space: nowrap;
	}

	.actions .ui-button:hover {
		background: #3a8eef;
	}
</style>
