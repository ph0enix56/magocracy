<script lang="ts">
	import Sidebar from './Sidebar.svelte';
	import ResourceCounter from './ResourceCounter.svelte';
	import BuildingSelector from './BuildingSelector.svelte';
	import Shop from './Shop.svelte';
	import Army from './Army.svelte';
	import Combat from './Combat.svelte';
	import MultiplayerPanel from './MultiplayerPanel.svelte';
	import FightPhasePanel from './FightPhasePanel.svelte';
	import AdvancePhasePanel from './AdvancePhasePanel.svelte';
	import TopActionButtons from './TopActionButtons.svelte';
	import RenownLeaderboard from './RenownLeaderboard.svelte';
	import PhaseTimer from './PhaseTimer.svelte';
	import { armyModalState, blueprintModalState, shopModalState } from './uiState';
	import { appViewState, type OverlayScreenView } from './projections/appViewState';
	import {
		OVERLAY_BACKGROUND_EVENT,
		OVERLAY_TOWN_VISIBILITY_EVENT,
		type OverlayBackground,
		type OverlayTownVisibility
	} from '../shared/ui/overlayRender';

	let overlayScreenView: OverlayScreenView = 'overview';
	let overlayTownVisibility: OverlayTownVisibility = { hideTownRender: false };
	let overlayBackground: OverlayBackground = {};

	function openBlueprints() {
		if (!$appViewState.canTownInteract) return;
		blueprintModalState.set({ isOpen: true, mode: 'view', q: 0, r: 0 });
	}

	function openShop() {
		if (!$appViewState.canTownInteract) return;
		shopModalState.set({ isOpen: true });
	}

	function openArmy() {
		if (!$appViewState.canArmyReorder) return;
		armyModalState.set({ isOpen: true });
	}

	$: if (!$appViewState.canTownInteract) {
		shopModalState.set({ isOpen: false });
		blueprintModalState.set({ isOpen: false, mode: 'view', q: 0, r: 0 });
	}

	$: if (!$appViewState.activeOverlay) {
		overlayScreenView = 'overview';
	}

	$: overlayTownVisibility = $appViewState.activeOverlay && overlayScreenView === 'overview'
		? {
			hideTownRender: true
		}
		: { hideTownRender: false };

	$: overlayBackground = $appViewState.activeOverlay
		? { backgroundColor: $appViewState.activeOverlay.overviewBackgroundColor }
		: {};

	function toggleOverlayScreenView() {
		overlayScreenView = overlayScreenView === 'overview' ? 'town' : 'overview';
	}

	$: {
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent<OverlayTownVisibility>(OVERLAY_TOWN_VISIBILITY_EVENT, {
				detail: overlayTownVisibility
			}));
			window.dispatchEvent(new CustomEvent<OverlayBackground>(OVERLAY_BACKGROUND_EVENT, {
				detail: overlayBackground
			}));
		}
	}
</script>

<div class="ui-root">
	<div class="top-bar">
		<ResourceCounter keyName="stone" icon="🪨" />
		<ResourceCounter keyName="wood" icon="🪵" />
		<ResourceCounter keyName="food" icon="🍞" />
		<ResourceCounter keyName="mana" icon="💧" />
		<ResourceCounter keyName="gold" icon="💰" />
		{#if $appViewState.isScouting && $appViewState.viewedPlayerName}
			<div class="ui-chip scout-chip">Scouting {$appViewState.viewedPlayerName}</div>
		{/if}
	</div>

	<RenownLeaderboard />

	<div class="bottom-actions-wrap">
		<TopActionButtons
			blueprintCount={$appViewState.blueprintCount}
			armyCount={$appViewState.armyCount}
			canTownInteract={$appViewState.canTownInteract}
			canArmyReorder={$appViewState.canArmyReorder}
			on:openBlueprints={openBlueprints}
			on:openShop={openShop}
			on:openArmy={openArmy}
		/>
	</div>

	<PhaseTimer />

	<MultiplayerPanel />
	{#if $appViewState.activeOverlay?.fightPanel && overlayScreenView === 'overview'}
		<FightPhasePanel />
	{/if}
	{#if $appViewState.activeOverlay?.advancePanel && overlayScreenView === 'overview'}
		<AdvancePhasePanel />
	{/if}

	{#if $appViewState.activeOverlay}
		<div class="fight-toggle-wrap">
			<button class="ui-button fight-toggle" on:click={toggleOverlayScreenView}>
				{overlayScreenView === 'overview' ? $appViewState.activeOverlay.showTownToggleLabel : $appViewState.activeOverlay.showOverviewToggleLabel}
			</button>
		</div>
	{/if}

	{#if !$appViewState.activeOverlay}
		<Sidebar />
		<BuildingSelector />
	{/if}
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

	.bottom-actions-wrap {
		position: absolute;
		left: 50%;
		bottom: 6px;
		transform: translateX(-50%);
		pointer-events: auto;
	}

	@media (max-height: 760px) {
		.bottom-actions-wrap {
			bottom: 4px;
		}
	}
	.scout-chip {
		font-weight: 700;
		background: rgba(168, 84, 28, 0.85);
	}

	.fight-toggle-wrap {
		position: absolute;
		left: 50%;
		bottom: 12px;
		transform: translateX(-50%);
		pointer-events: auto;
	}

	.fight-toggle {
		min-width: 200px;
	}

</style>
