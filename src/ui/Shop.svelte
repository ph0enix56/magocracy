<script lang="ts">
	import { shopModalState } from './uiState';
	import { shopPanelState } from './projections/shopViewState';
	import BuildingCard from './BuildingCard.svelte';
	import DistrictDetailCard from './DistrictDetailCard.svelte';
	import UnitCard from './UnitCard.svelte';
	import type { BuildingCatalogEntry } from '../shared/multiplayer/snapshots';
	import { gameSessionClient } from '../multiplayer/client/gameSessionStore';

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
		max-width: min(980px, calc(100vw - 24px));
		max-height: 80vh;
	}

	.header-actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.readonly-banner {
		padding: 10px 16px 0;
		color: #ffd28a;
		font-size: 0.9rem;
	}

	.content {
		padding: 16px 18px;
		display: grid;
		grid-template-columns: minmax(360px, 420px) minmax(360px, 420px);
		gap: 16px;
		align-items: start;
	}

	.grid {
		overflow-y: auto;
		display: grid;
		grid-template-columns: 1fr;
		gap: 12px;
		max-height: calc(80vh - 92px);
		padding-inline: 2px;
	}

	.empty-slot {
		padding: 16px;
		text-align: center;
		border: 1px dashed #444;
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.15);
	}

	.preview-pane {
		min-height: 200px;
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
		font-weight: 700;
	}

	.shop-reroll:hover {
		background: #3a8eef;
	}

	.preview-empty {
		padding: 12px;
		border: 1px dashed rgba(255, 255, 255, 0.25);
		border-radius: 6px;
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
