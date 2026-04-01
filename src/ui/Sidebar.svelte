<script lang="ts">
	import { onDestroy } from 'svelte';
	import { blueprintModalState } from './uiState';
	import { sidebarViewState } from './projections/sidebarViewState';
	import type { ResourceMap } from '../shared/domain/types';
	import { gameSessionClient, type SelectedTileView } from '../multiplayer/client/gameSessionStore';

	let visible = false;
	let selected: SelectedTileView | null = null;

	const unsubscribe = sidebarViewState.subscribe((view) => {
		const nextSelected = view.selectedTile;
		if (!nextSelected) {
			selected = null;
			visible = false;
			return;
		}

		const selectionChanged = !selected || selected.q !== nextSelected.q || selected.r !== nextSelected.r;
		selected = nextSelected;
		if (selectionChanged) {
			visible = true;
		}
	});

	onDestroy(() => {
		unsubscribe();
	});

	function onBuild() {
		if (!selected) return;
		if (!$sidebarViewState.canTownInteract) return;
		blueprintModalState.set({ isOpen: true, mode: 'build', q: selected.q, r: selected.r });
		visible = false;
		selected = null;
	}

	async function onDestroyClick() {
		if (!selected) return;
		if (!$sidebarViewState.canTownInteract) return;
		const result = await gameSessionClient.requestDestroy(selected.q, selected.r);
		if (!result.ok) {
			alert(result.reason);
			return;
		}
		visible = false;
	}

	function formatCost(cost: ResourceMap | undefined): string {
		if (!cost) return '';
		return Object.entries(cost)
			.map(([res, amount]) => `${amount} ${res}`)
			.join(', ');
	}

	async function onUpgradeClick() {
		if (!selected?.nextUpgradeId) return;
		if (!$sidebarViewState.canTownInteract) return;
		const costStr = formatCost(selected.nextUpgradeCost);
		const timeStr = selected.nextUpgradeTime !== undefined ? `${selected.nextUpgradeTime}s` : '';
		const ok = confirm(`Upgrade to ${selected.nextUpgradeId}?\nCost: ${costStr}\nTime: ${timeStr}`);
		if (!ok) return;

		const result = await gameSessionClient.requestUpgrade(selected.q, selected.r, selected.nextUpgradeId);
		if (!result.ok) {
			alert(result.reason);
			return;
		}
		visible = false;
	}
</script>

{#if visible && selected}
	<div class="ui-panel sidebar">
		<h2 class="ui-panel-title">Tile ({selected.q}, {selected.r})</h2>
		{#if $sidebarViewState.isScouting && $sidebarViewState.viewedPlayerName}
			<p class="ui-muted">Scouting {$sidebarViewState.viewedPlayerName}. Commands are disabled.</p>
		{/if}
		
		{#if selected.buildingId}
			<p><strong>{selected.buildingId}</strong></p>
		{/if}

		{#if selected.constructionProgress !== undefined}
			<div class="ui-progress">
				<div class="ui-progress-fill" style="width: {selected.constructionProgress}%"></div>
			</div>
			<p>Construction: {Math.round(selected.constructionProgress)}%</p>
		{/if}

		{#if selected.productionMultiplier !== undefined}
			<p>Production Mult: x{selected.productionMultiplier.toFixed(2)}</p>
		{/if}

		{#if selected.upgradingToId}
			<div class="upgrade-section">
				<p><strong>Upgrading</strong> → {selected.upgradingToId}</p>
				{#if selected.upgradeProgress !== undefined}
					<div class="ui-progress">
						<div class="ui-progress-fill" style="width: {selected.upgradeProgress}%"></div>
					</div>
					<p>Upgrade: {Math.round(selected.upgradeProgress)}%</p>
				{/if}
			</div>
		{:else if selected.nextUpgradeId}
			<div class="upgrade-section">
				<p><strong>Next upgrade:</strong> {selected.nextUpgradeId}</p>
				{#if selected.nextUpgradeCost}
					<p>Cost: {formatCost(selected.nextUpgradeCost)}</p>
				{/if}
				{#if selected.nextUpgradeTime !== undefined}
					<p>Time: {selected.nextUpgradeTime}s</p>
				{/if}
				<button class="ui-button" disabled={!$sidebarViewState.canTownInteract} on:click={onUpgradeClick}>Upgrade</button>
			</div>
		{/if}

		{#if selected.built}
			<button class="ui-button" disabled={!$sidebarViewState.canTownInteract} on:click={onDestroyClick}>Destroy</button>
		{:else}
			<button class="ui-button" disabled={!$sidebarViewState.canTownInteract} on:click={onBuild}>Build</button>
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
		pointer-events: auto;
	}
	.upgrade-section {
		margin-top: 12px;
		padding-top: 8px;
		border-top: 1px solid rgba(255, 255, 255, 0.15);
	}
</style>
