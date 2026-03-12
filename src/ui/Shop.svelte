<script lang="ts">
	import { onDestroy } from 'svelte';
	import { shopModalState } from './uiState';
	import { buildingCatalogState, shopState } from './gameState';
	import BuildingCard from './BuildingCard.svelte';
	import type { BuildingCatalogEntry } from '../shared/multiplayer/protocol';
	import { gameSessionClient } from '../multiplayer/client/gameSessionStore';

	let state: { isOpen: boolean } = { isOpen: false };
	shopModalState.subscribe(v => (state = v));

	let view: { offers: Array<string | null>; buyCost: number; rerollCost: number } = { offers: [], buyCost: 0, rerollCost: 0 };
	shopState.subscribe(v => (view = v));

	let pendingBuySlot: number | null = null;
	let pendingReroll = false;
	let purchasableBuildings: BuildingCatalogEntry[] = [];
	const unsubscribeCatalog = buildingCatalogState.subscribe((entries) => {
		purchasableBuildings = entries.filter((entry) => !entry.parentId && entry.type !== 'blocking');
	});

	function close() {
		shopModalState.set({ isOpen: false });
		pendingBuySlot = null;
		pendingReroll = false;
	}

	function canReroll(): boolean {
		return pendingBuySlot === null && !pendingReroll;
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
		if (pendingBuySlot !== null || pendingReroll) return;
		pendingBuySlot = slotIndex;
		const result = await gameSessionClient.requestShopBuy(slotIndex);
		pendingBuySlot = null;
		if (!result.ok) {
			alert(result.reason);
		}
	}

	onDestroy(() => {
		unsubscribeCatalog();
	});

	function defFor(id: string | null): BuildingCatalogEntry | null {
		if (!id) return null;
		return purchasableBuildings.find((building) => building.id === id) ?? null;
	}
</script>

{#if state.isOpen}
	<div class="ui-overlay" style="--ui-overlay-z: 110;">
		<div class="ui-modal modal">
			<div class="ui-modal-header">
				<h2 class="ui-modal-title">Blueprint Shop</h2>
				<div class="header-actions">
					<button class="ui-button ui-button--ghost" disabled={!canReroll()} on:click={requestReroll}>
						Reroll ({view.rerollCost} gold)
					</button>
					<button class="ui-close-btn" on:click={close}>X</button>
				</div>
			</div>

			<div class="grid">
				{#each view.offers as slot, i}
					{#if slot}
						{@const def = defFor(slot)}
						{#if def}
							<BuildingCard
								def={def}
								count={null}
								actionLabel={`Buy (${view.buyCost} gold)`}
								actionDisabled={pendingBuySlot !== null || pendingReroll}
								on:action={() => buy(i)}
							/>
						{:else}
							<div class="empty-slot ui-muted">Unknown blueprint.</div>
						{/if}
					{:else}
						<div class="empty-slot ui-muted">Empty slot</div>
					{/if}
				{/each}
			</div>
		</div>
	</div>
{/if}


<style>
	.modal {
		width: 720px;
		max-height: 80vh;
	}

	.header-actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.grid {
		padding: 16px;
		overflow-y: auto;
		display: grid;
		grid-template-columns: 1fr;
		gap: 12px;
	}

	.empty-slot {
		padding: 16px;
		text-align: center;
		border: 1px dashed #444;
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.15);
	}
</style>
