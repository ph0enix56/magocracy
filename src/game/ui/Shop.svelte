<script lang="ts">
	import { shopModalState } from './store/uiState';
	import { shopPanelState } from './store/shopViewState';
	import BuildingCard from './BuildingCard.svelte';
	import DistrictDetailCard from './DistrictDetailCard.svelte';
	import UnitCard from './UnitCard.svelte';
	import type { BuildingCatalogEntry } from '../../shared/multiplayer/snapshots';
	import { gameSessionClient } from '../client/gameSessionStore';

	let state: { isOpen: boolean } = { isOpen: false };
	shopModalState.subscribe(v => (state = v));

	let pendingBuySlot: number | null = null;
	let pendingReroll = false;
	let previewBuilding: BuildingCatalogEntry | null = null;

	function close() {
		shopModalState.set({ isOpen: false });
		pendingBuySlot = null;
		pendingReroll = false;
		previewBuilding = null;
	}

	function canReroll(): boolean {
		return pendingBuySlot === null && !pendingReroll && $shopPanelState.canTownInteract;
	}

	async function requestReroll() {
		if (!canReroll()) return;
		pendingReroll = true;
		const result = await gameSessionClient.requestShopReroll();
		pendingReroll = false;
		if (!result.ok) {
			alert(result.reason);
		}
	}

	async function buy(slotIndex: number) {
		if (pendingBuySlot !== null || pendingReroll || !$shopPanelState.canTownInteract) return;
		pendingBuySlot = slotIndex;
		const result = await gameSessionClient.requestShopBuy(slotIndex);
		pendingBuySlot = null;
		if (!result.ok) {
			alert(result.reason);
		}
	}

	function defFor(id: string | null): BuildingCatalogEntry | null {
		if (!id) return null;
		return $shopPanelState.purchasableBuildings.find((building) => building.id === id) ?? null;
	}

	function onPreviewStart(event: CustomEvent<BuildingCatalogEntry>) {
		previewBuilding = event.detail;
	}

	function onPreviewEnd(event: CustomEvent<BuildingCatalogEntry>) {
		if (previewBuilding?.id === event.detail.id) {
			previewBuilding = null;
		}
	}
</script>

{#if state.isOpen}
	<div class="ui-overlay" style="--ui-overlay-z: 110;">
		<div class="ui-modal modal">
			<div class="ui-modal-header">
				<h2 class="ui-modal-title">Blueprint Shop</h2>
				<div class="header-actions">
					<button class="ui-button shop-reroll" disabled={!canReroll()} on:click={requestReroll}>
						Reroll ({$shopPanelState.rerollCost} mana)
					</button>
					<button class="ui-close-btn" on:click={close}>X</button>
				</div>
			</div>
			{#if $shopPanelState.isScouting && $shopPanelState.viewedPlayerName}
				<div class="readonly-banner">Scouting {$shopPanelState.viewedPlayerName}. Shop actions are disabled.</div>
			{/if}

			<div class="content">
				<div class="grid">
					{#each $shopPanelState.offers as offer, i}
						{#if offer}
							{@const def = defFor(offer.buildingId)}
							{#if def}
								<BuildingCard
									def={def}
									count={null}
									actionLabel={`Buy (${offer.buyCost} mana)`}
									actionDisabled={pendingBuySlot !== null || pendingReroll || !$shopPanelState.canTownInteract}
									on:action={() => buy(i)}
									on:previewstart={onPreviewStart}
									on:previewend={onPreviewEnd}
								/>
							{:else}
								<div class="empty-slot ui-muted">Unknown blueprint.</div>
							{/if}
						{:else}
							<div class="empty-slot ui-muted">Empty slot</div>
						{/if}
					{/each}
				</div>

				<div class="preview-pane">
					{#if previewBuilding}
						<div class="preview-stack">
							<DistrictDetailCard def={previewBuilding} showNotch={false} />
							{#if previewBuilding.housedUnit}
								<UnitCard unit={previewBuilding.housedUnit} tier={previewBuilding.tier} showNotch={false} />
							{/if}
						</div>
					{:else}
						<div class="preview-empty ui-muted">Hover a blueprint row to preview details.</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}


<style>
	.modal {
		width: fit-content;
		max-width: min(1100px, calc(100vw - var(--space-xl)));
		max-height: 80vh;
	}

	.header-actions {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

	.readonly-banner {
		padding: 10px var(--space-lg) 0;
		color: var(--color-accent-orange);
		font-size: 0.9rem;
	}

	.content {
		padding: var(--space-lg) 18px;
		display: grid;
		grid-template-columns: minmax(500px, 560px) minmax(360px, 420px);
		gap: var(--space-lg);
		align-items: stretch;
	}

	.grid {
		overflow-y: auto;
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-md);
		max-height: calc(80vh - 92px);
		padding-inline: 2px;
	}

	.empty-slot {
		padding: var(--space-lg);
		text-align: center;
		border: 1px dashed var(--color-surface-4);
		border-radius: var(--radius-sm);
		background: rgba(0, 0, 0, 0.15);
	}

	.preview-pane {
		min-height: 480px;
		max-height: calc(80vh - 92px);
		overflow-y: auto;
		overflow-x: hidden;
		padding-inline: 2px;
	}

	.preview-stack {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		flex-direction: column;
	}

	.shop-reroll {
		background: #4a9eff;
		font-weight: var(--font-weight-bold);
	}

	.shop-reroll:hover {
		background: #3a8eef;
	}

	.preview-empty {
		padding: var(--space-md);
		border: 1px dashed var(--color-border-dashed);
		border-radius: var(--radius-md);
	}

	@media (max-width: 1050px) {
		.content {
			grid-template-columns: 1fr;
		}

		.preview-pane {
			max-height: 46vh;
		}
	}
</style>
