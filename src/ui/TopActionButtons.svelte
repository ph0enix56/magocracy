<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let blueprintCount = 0;
	export let armyCount = 0;
	export let canTownInteract = false;
	export let canArmyReorder = false;

	const dispatch = createEventDispatcher<{
		openBlueprints: void;
		openShop: void;
		openArmy: void;
	}>();

	function handleOpenBlueprints() {
		dispatch('openBlueprints');
	}

	function handleOpenShop() {
		dispatch('openShop');
	}

	function handleOpenArmy() {
		dispatch('openArmy');
	}
</script>

<div class="top-actions" role="group" aria-label="Town actions">
	<button
		type="button"
		class="top-action-card top-action-card--wide"
		disabled={!canTownInteract}
		on:click={handleOpenBlueprints}
	>
		<img class="top-action-icon" src="/assets/game_icons/tied-scroll.svg" alt="" aria-hidden="true" />
		<div class="top-action-count">{blueprintCount}</div>
		<div class="top-action-label">Blueprints</div>
	</button>
	<button
		type="button"
		class="top-action-card top-action-card--shop"
		disabled={!canTownInteract}
		on:click={handleOpenShop}
	>
		<img class="top-action-icon top-action-icon--shop" src="/assets/game_icons/cash.svg" alt="" aria-hidden="true" />
		<div class="top-action-label">Shop</div>
	</button>
	<button
		type="button"
		class="top-action-card top-action-card--wide"
		disabled={!canArmyReorder}
		on:click={handleOpenArmy}
	>
		<img class="top-action-icon" src="/assets/game_icons/swords-emblem.svg" alt="" aria-hidden="true" />
		<div class="top-action-count">{armyCount}</div>
		<div class="top-action-label">Army</div>
	</button>
</div>

<style>
	.top-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.top-action-card {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: 4px;
		color: #ffffff;
		background: rgba(0, 0, 0, 0.7);
		font-family: Inter, system-ui, sans-serif;
		cursor: pointer;
		padding: 0;
		overflow: hidden;
		transition: background 0.18s ease, transform 0.18s ease, opacity 0.18s ease;
	}

	.top-action-card--wide {
		width: 200px;
		height: 120px;
	}

	.top-action-card--shop {
		width: 140px;
		height: 140px;
	}

	.top-action-card:hover:not(:disabled) {
		background: rgba(0, 0, 0, 0.78);
		transform: translateY(-1px);
	}

	.top-action-card:disabled {
		opacity: 0.58;
		cursor: not-allowed;
	}

	.top-action-icon {
		position: absolute;
		width: 55px;
		height: 58px;
		left: 40px;
		top: 15px;
		object-fit: contain;
		pointer-events: none;
	}

	.top-action-icon--shop {
		left: 50%;
		top: 12px;
		transform: translateX(-50%);
		width: 80px;
		height: 80px;
	}

	.top-action-count {
		position: absolute;
		top: 15px;
		right: 36px;
		font-size: 36px;
		font-weight: 700;
		line-height: 1;
		text-align: center;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.45);
	}

	.top-action-label {
		position: absolute;
		bottom: 8px;
		left: 0;
		width: 100%;
		font-size: 28px;
		font-weight: 400;
		line-height: 1;
		text-align: center;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
	}

	@media (max-width: 1200px) {
		.top-action-card--wide {
			width: 158px;
			height: 95px;
		}

		.top-action-card--shop {
			width: 112px;
			height: 112px;
		}

		.top-action-icon {
			width: 44px;
			height: 46px;
			left: 31px;
			top: 12px;
		}

		.top-action-icon--shop {
			width: 64px;
			height: 64px;
			left: 50%;
			top: 9px;
		}

		.top-action-count {
			font-size: 30px;
			top: 13px;
			right: 27px;
		}

		.top-action-label {
			font-size: 24px;
			bottom: 6px;
		}
	}

	@media (max-width: 900px) {
		.top-actions {
			justify-content: center;
			width: 100%;
		}
	}
</style>
