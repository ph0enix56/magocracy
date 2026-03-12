<script lang="ts">
	import Sidebar from './Sidebar.svelte';
	import ResourceCounter from './ResourceCounter.svelte';
	import BuildingSelector from './BuildingSelector.svelte';
	import Shop from './Shop.svelte';
	import Army from './Army.svelte';
	import Combat from './Combat.svelte';
	import MultiplayerPanel from './MultiplayerPanel.svelte';
	import { armyModalState, blueprintModalState, shopModalState } from './uiState';
	import { gameSessionState } from '../multiplayer/client/gameSessionStore';

	function openBlueprints() {
		if (!$gameSessionState.canIssueCommands) return;
		blueprintModalState.set({ isOpen: true, mode: 'view', q: 0, r: 0 });
	}

	function openShop() {
		if (!$gameSessionState.canIssueCommands) return;
		shopModalState.set({ isOpen: true });
	}

	function openArmy() {
		if (!$gameSessionState.canIssueCommands) return;
		armyModalState.set({ isOpen: true });
	}
</script>

<div class="ui-root">
	<div class="top-bar">
		<ResourceCounter keyName="stone" icon="🪨" />
		<ResourceCounter keyName="wood" icon="🪵" />
		<ResourceCounter keyName="food" icon="🍞" />
		<ResourceCounter keyName="mana" icon="💧" />
		<ResourceCounter keyName="gold" icon="💰" />
		<button class="ui-button" disabled={!$gameSessionState.canIssueCommands} on:click={openShop}>Shop</button>
		<button class="ui-button" disabled={!$gameSessionState.canIssueCommands} on:click={openArmy}>Army</button>
		<button class="ui-button" disabled={!$gameSessionState.canIssueCommands} on:click={openBlueprints}>Blueprints</button>
		{#if $gameSessionState.isScouting && $gameSessionState.viewedPlayer}
			<div class="ui-chip scout-chip">Scouting {$gameSessionState.viewedPlayer.name}</div>
		{/if}
	</div>

	<MultiplayerPanel />

	<Sidebar />
	<BuildingSelector />
	<Shop />
	<Army />
	<Combat />
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
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		pointer-events: auto;
	}
	.scout-chip {
		font-weight: 700;
		background: rgba(168, 84, 28, 0.85);
	}
</style>
