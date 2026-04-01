<script lang="ts">
	import { shopModalState } from './uiState';
	import { shopPanelState } from './projections/shopViewState';
	import BuildingCard from './BuildingCard.svelte';
	import type { BuildingCatalogEntry } from '../shared/multiplayer/contracts/snapshots';
	import { gameSessionClient } from '../multiplayer/client/gameSessionStore';

	let state: { isOpen: boolean } = { isOpen: false };
	shopModalState.subscribe(v => (state = v));

	let pendingBuySlot: number | null = null;
	let pendingReroll = false;

	function close() {
		shopModalState.set({ isOpen: false });
		pendingBuySlot = null;
		pendingReroll = false;
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
</script>

{#if state.isOpen}
	<div class="ui-overlay" style="--ui-overlay-z: 110;">
		<div class="ui-modal modal">
			<div class="ui-modal-header">
				<h2 class="ui-modal-title">Blueprint Shop</h2>
				<div class="header-actions">
					<button class="ui-button ui-button--ghost" disabled={!canReroll()} on:click={requestReroll}>
						Reroll ({$shopPanelState.rerollCost} gold)
					</button>
					<button class="ui-close-btn" on:click={close}>X</button>
				</div>
			</div>
			{#if $shopPanelState.isScouting && $shopPanelState.viewedPlayerName}
				<div class="readonly-banner">Scouting {$shopPanelState.viewedPlayerName}. Shop actions are disabled.</div>
			{/if}

			<div class="grid">
				{#each $shopPanelState.offers as slot, i}
					{#if slot}
						{@const def = defFor(slot)}
						{#if def}
							<BuildingCard
								def={def}
								count={null}
								actionLabel={`Buy (${$shopPanelState.buyCost} gold)`}
								actionDisabled={pendingBuySlot !== null || pendingReroll || !$shopPanelState.canTownInteract}
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

	.readonly-banner {
		padding: 10px 16px 0;
		color: #ffd28a;
		font-size: 0.9rem;
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
