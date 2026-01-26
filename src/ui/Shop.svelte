<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { eventBus } from '../eventBus';
	import { getPurchasableBuildings, type BuildingDef } from '../game/scenes/Kingdom/data/buildings';
	import { blueprintInventory, shopModalState } from './uiState';
	import BuildingCard from './BuildingCard.svelte';

	const BUY_COST = 10;
	const FILL_COST = 10;
	const SHOP_SIZE = 4;

	let state: { isOpen: boolean } = { isOpen: false };
	shopModalState.subscribe(v => (state = v));

	let inventory: Record<string, number> = {};
	blueprintInventory.subscribe(v => (inventory = v));

	let slots: Array<string | null> = Array.from({ length: SHOP_SIZE }, () => null);

	let pendingPurchase: { slotIndex: number; buildingId: string } | null = null;
	let pendingFill = false;

	function purchasablePool(): BuildingDef[] {
		return getPurchasableBuildings();
	}

	function drawRandom(): string | null {
		const pool = purchasablePool().map(b => b.id);
		if (pool.length === 0) return null;
		return pool[Math.floor(Math.random() * pool.length)]!;
	}

	function rerollOffers() {
		slots = Array.from({ length: SHOP_SIZE }, () => drawRandom());
	}

	function close() {
		shopModalState.set({ isOpen: false });
		pendingPurchase = null;
		pendingFill = false;
	}

	function canReroll(): boolean {
		return !pendingPurchase && !pendingFill;
	}

	function requestReroll() {
		if (!canReroll()) return;
		pendingFill = true;
		eventBus.publishUiToGame({ type: 'spend-gold', amount: FILL_COST, reason: 'shop-fill' });
	}

	function buy(slotIndex: number, buildingId: string) {
		if (pendingPurchase || pendingFill) return;
		pendingPurchase = { slotIndex, buildingId };
		eventBus.publishUiToGame({ type: 'spend-gold', amount: BUY_COST, reason: 'shop-buy' });
	}

	let unsubscribe: (() => void) | null = null;

	onMount(() => {
		unsubscribe = eventBus.subscribeGameToUi((event) => {
			if (event.type !== 'spend-gold-result') return;

			if (event.requestReason === 'shop-buy' && pendingPurchase) {
				if (event.amount !== BUY_COST) return;

				if (!event.ok) {
					if (event.reason) alert(event.reason);
					pendingPurchase = null;
					return;
				}

				const { slotIndex, buildingId } = pendingPurchase;
				const current = inventory[buildingId] || 0;
				blueprintInventory.set({ ...inventory, [buildingId]: current + 1 });
				slots = slots.map((s, i) => (i === slotIndex ? null : s));
				pendingPurchase = null;
				return;
			}

			if (event.requestReason === 'shop-fill' && pendingFill) {
				if (event.amount !== FILL_COST) return;

				if (!event.ok) {
					if (event.reason) alert(event.reason);
					pendingFill = false;
					return;
				}

				rerollOffers();
				pendingFill = false;
			}
		});
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});

	let wasOpen = false;
	$: if (state.isOpen && !wasOpen) {
		rerollOffers();
		wasOpen = true;
	} else if (!state.isOpen && wasOpen) {
		wasOpen = false;
	}

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
						Reroll ({FILL_COST} gold)
					</button>
					<button class="close-btn" on:click={close}>X</button>
				</div>
			</div>

			<div class="grid">
				{#each slots as slot, i}
					{#if slot}
						{@const def = defFor(slot)}
						{#if def}
							<BuildingCard
								def={def}
								count={null}
								actionLabel={`Buy (${BUY_COST} gold)`}
								actionDisabled={!!pendingPurchase || pendingFill}
								on:action={() => buy(i, def.id)}
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
