<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let blueprintCount = 0;
	export let armyCount = 0;
	export let middleLabel = 'Shop';
	export let middleIconPath: string | null = '/assets/game_icons/cash.svg';

	const dispatch = createEventDispatcher<{
		openBlueprints: void;
		openMiddle: void;
		openArmy: void;
	}>();

	function handleOpenBlueprints() {
		dispatch('openBlueprints');
	}

	function handleOpenMiddle() {
		dispatch('openMiddle');
	}

	function handleOpenArmy() {
		dispatch('openArmy');
	}
</script>

<div class="top-actions" role="group" aria-label="Town actions">
	<button
		type="button"
		class="top-action-card top-action-card--wide"
		on:click={handleOpenBlueprints}
	>
		<img class="top-action-icon" src="/assets/game_icons/tied-scroll.svg" alt="" aria-hidden="true" />
		<div class="top-action-count">{blueprintCount}</div>
		<div class="top-action-label">Blueprints</div>
	</button>
	<button
		type="button"
		class="top-action-card top-action-card--middle"
		on:click={handleOpenMiddle}
	>
		{#if middleIconPath}
			<img class="top-action-icon top-action-icon--middle" src={middleIconPath} alt="" aria-hidden="true" />
		{:else}
			<div class="top-action-placeholder" aria-hidden="true">◉</div>
		{/if}
		<div class="top-action-label">{middleLabel}</div>
	</button>
	<button
		type="button"
		class="top-action-card top-action-card--wide"
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
		gap: var(--space-sm);
	}

	.top-action-card {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: var(--radius-sm);
		color: var(--color-text-light);
		background: rgba(0, 0, 0, 0.7);
		cursor: pointer;
		padding: 0;
		overflow: hidden;
		transition: background 0.18s ease, transform 0.18s ease, opacity 0.18s ease;
	}

	.top-action-card--wide {
		width: 164px;
		height: 96px;
	}

	.top-action-card--middle {
		width: 110px;
		height: 110px;
	}

	.top-action-card:hover:not(:disabled) {
		background: rgba(0, 0, 0, 0.78);
		transform: translateY(-1px);
	}

	.top-action-icon {
		position: absolute;
		width: 44px;
		height: 46px;
		left: 30px;
		top: 11px;
		object-fit: contain;
		pointer-events: none;
	}

	.top-action-icon--middle {
		left: 50%;
		top: 9px;
		transform: translateX(-50%);
		width: 60px;
		height: 60px;
	}

	.top-action-placeholder {
		position: absolute;
		left: 50%;
		top: 18px;
		transform: translateX(-50%);
		font-size: 30px;
		font-weight: var(--font-weight-bold);
		line-height: 1;
	}

	.top-action-count {
		position: absolute;
		top: 11px;
		right: 26px;
		font-size: 28px;
		font-weight: var(--font-weight-bold);
		line-height: 1;
		text-align: center;
		text-shadow: 0 2px var(--space-xs) rgba(0, 0, 0, 0.45);
	}

	.top-action-label {
		position: absolute;
		bottom: 7px;
		left: 0;
		width: 100%;
		font-size: var(--ui-font-size-xl);
		font-weight: var(--font-weight-regular);
		line-height: 1;
		text-align: center;
		text-shadow: 0 2px var(--space-xs) rgba(0, 0, 0, 0.4);
	}

	@media (max-width: 1200px) {
		.top-action-card--wide {
			width: 146px;
			height: 86px;
		}

		.top-action-card--middle {
			width: 98px;
			height: 98px;
		}

		.top-action-icon {
			width: 39px;
			height: 41px;
			left: 27px;
			top: 9px;
		}

		.top-action-icon--middle {
			width: 54px;
			height: 54px;
			left: 50%;
			top: var(--space-sm);
		}

		.top-action-count {
			font-size: var(--space-xl);
			top: 10px;
			right: 22px;
		}

		.top-action-label {
			font-size: var(--ui-font-size-lg);
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
