<script lang="ts">
	import Sidebar from './Sidebar.svelte';
	import ResourceCounter from './ResourceCounter.svelte';
	import BuildingSelector from './BuildingSelector.svelte';
	import Shop from './Shop.svelte';
	import Army from './Army.svelte';
	import Combat from './Combat.svelte';
	import { armyModalState, blueprintModalState, shopModalState } from './uiState';
	import { eventBus } from '../eventBus';
	import WorldMapOverlay from './WorldMapOverlay.svelte';
	import { worldMapUiState } from './worldMapStore';

	function openBlueprints() {
		blueprintModalState.set({ isOpen: true, mode: 'view', q: 0, r: 0 });
	}

	function openShop() {
		shopModalState.set({ isOpen: true });
	}

	function openArmy() {
		armyModalState.set({ isOpen: true });
	}

	function toggleWorldMap() {
		eventBus.publishUiToGame({ type: 'worldmap-toggle' });
	}
</script>

<div class="ui-root">
	<div class="top-bar">
		<ResourceCounter keyName="stone" icon="🪨" />
		<ResourceCounter keyName="wood" icon="🪵" />
		<ResourceCounter keyName="food" icon="🍞" />
		<ResourceCounter keyName="mana" icon="💧" />
		<ResourceCounter keyName="gold" icon="💰" />
		<button class="ui-button" on:click={openShop}>Shop</button>
		<button class="ui-button" on:click={openArmy}>Army</button>
		<button class="ui-button" on:click={openBlueprints}>Blueprints</button>
	</div>

	<button class="ui-button worldmap-btn" on:click={toggleWorldMap}>
		{#if $worldMapUiState.isOpen}
			Return
		{:else}
			World Map
		{/if}
	</button>

	<Sidebar />
	<BuildingSelector />
	<Shop />
	<Army />
	<Combat />
	<WorldMapOverlay />
</div>

<style>
	.ui-root {
		position: fixed;
		inset: 0;
		pointer-events: none;
	}
	.top-bar {
		position: absolute;
		top: 8px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 8px;
		pointer-events: auto;
	}
	.worldmap-btn {
		position: absolute;
		top: 10px;
		right: 10px;
		border-radius: 10px;
		pointer-events: auto;
	}
</style>
