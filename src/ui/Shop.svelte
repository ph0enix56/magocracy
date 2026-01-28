<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { eventBus } from '../eventBus';
	import { getPurchasableBuildings, type BuildingDef } from '../game/scenes/Kingdom/data/buildings';
	import { shopModalState } from './uiState';
	import { shopState } from './gameState';
	import BuildingCard from './BuildingCard.svelte';

	let state: { isOpen: boolean } = { isOpen: false };
	shopModalState.subscribe(v => (state = v));

	let view: { offers: Array<string | null>; buyCost: number; rerollCost: number } = { offers: [], buyCost: 0, rerollCost: 0 };
	shopState.subscribe(v => (view = v));

	let pendingBuySlot: number | null = null;
	let pendingReroll = false;

	function purchasablePool(): BuildingDef[] {
		return getPurchasableBuildings();
	}

	function close() {
		shopModalState.set({ isOpen: false });
		pendingBuySlot = null;
		pendingReroll = false;
	}

	function canReroll(): boolean {
		return pendingBuySlot === null && !pendingReroll;
	}

	function requestReroll() {
		if (!canReroll()) return;
		pendingReroll = true;
		eventBus.publishUiToGame({ type: 'shop-reroll-requested' });
	}

	function buy(slotIndex: number) {
		if (pendingBuySlot !== null || pendingReroll) return;
		pendingBuySlot = slotIndex;
		eventBus.publishUiToGame({ type: 'shop-buy-requested', slotIndex });
	}

	let unsubscribe: (() => void) | null = null;

	onMount(() => {
		unsubscribe = eventBus.subscribeGameToUi((event) => {
			if (event.type !== 'shop-action-result') return;

			if (!event.ok) {
				if (event.reason) alert(event.reason);
			}

			if (event.action === 'buy') {
				pendingBuySlot = null;
			} else if (event.action === 'reroll') {
				pendingReroll = false;
			}
		});
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});

	function defFor(id: string | null): BuildingDef | null {
		if (!id) return null;
		return purchasablePool().find(b => b.id === id) ?? null;
	}
</script>

{#if state.isOpen}
	<div class="overlay">
		<div class="modal">
			<div class="header">
				<h2>Blueprint Shop</h2>
				<div class="header-actions">
					<button class="fill-btn" disabled={!canReroll()} on:click={requestReroll}>
						Reroll ({view.rerollCost} gold)
					</button>
					<button class="close-btn" on:click={close}>X</button>
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
							<div class="empty-slot">Unknown blueprint.</div>
						{/if}
					{:else}
						<div class="empty-slot">Empty slot</div>
					{/if}
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: auto;
		z-index: 110;
	}

	.modal {
		background: #2a2a2a;
		color: #fff;
		width: 720px;
		max-height: 80vh;
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
		border: 1px solid #444;
	}

	.header {
		padding: 16px;
		border-bottom: 1px solid #444;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.header h2 {
		margin: 0;
		font-size: 1.2rem;
	}

	.header-actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.close-btn {
		background: none;
		border: none;
		color: #aaa;
		cursor: pointer;
		font-size: 1.2rem;
	}

	.fill-btn {
		padding: 6px 10px;
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.35);
		color: #fff;
		border: 1px solid rgba(255, 255, 255, 0.15);
		cursor: pointer;
		font-family: system-ui, sans-serif;
	}

	.fill-btn:hover {
		background: rgba(0, 0, 0, 0.55);
	}

	.fill-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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
		color: #ccc;
		text-align: center;
		border: 1px dashed #444;
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.15);
	}
</style>
