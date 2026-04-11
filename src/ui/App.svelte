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
		blueprintModalState.set({ isOpen: true, mode: 'view', q: 0, r: 0 });
	}

	function openShop() {
		shopModalState.set({ isOpen: true });
	}

	function openArmy() {
		armyModalState.set({ isOpen: true });
	}

	function handleMiddleAction() {
		if ($appViewState.activeOverlay) {
			toggleOverlayScreenView();
			return;
		}
		openShop();
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

	$: middleActionLabel = $appViewState.activeOverlay
		? overlayScreenView === 'overview'
			? 'Town'
			: 'Back'
		: 'Shop';
	$: middleActionIconPath = $appViewState.activeOverlay
		? overlayScreenView === 'overview'
			? '/assets/game_icons/exit-door.svg'
			: '/assets/game_icons/entry-door.svg'
		: '/assets/game_icons/cash.svg';

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
		<ResourceCounter keyName="wood" icon="🪵" />
		<ResourceCounter keyName="stone" icon="🪨" />
		<ResourceCounter keyName="food" icon="🍞" />
		<ResourceCounter keyName="mana" icon="💧" />
		<ResourceCounter keyName="expansion" icon="➕" />
		{#if $appViewState.isScouting && $appViewState.viewedPlayerName}
			<div class="ui-chip scout-chip">Scouting {$appViewState.viewedPlayerName}</div>
		{/if}
	</div>

	<RenownLeaderboard />

	<div class="bottom-actions-wrap">
		<TopActionButtons
			blueprintCount={$appViewState.blueprintCount}
			armyCount={$appViewState.armyCount}
			middleLabel={middleActionLabel}
			middleIconPath={middleActionIconPath}
			on:openBlueprints={openBlueprints}
			on:openMiddle={handleMiddleAction}
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
		--ui-edge-right: 16px;
		--ui-edge-bottom: 12px;
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
		bottom: var(--ui-edge-bottom);
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

</style>
