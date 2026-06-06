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
	import { gameSessionClient } from '../client/gameSessionStore';
	import { gameSessionState } from '../client/gameSessionStore';
	import { armyModalState, blueprintModalState, shopModalState, howToPlayModalState } from './store/uiState';
	import { appViewState, type OverlayScreenView } from './store/appViewState';
	import {
		OVERLAY_BACKGROUND_EVENT,
		OVERLAY_TOWN_VISIBILITY_EVENT,
		type OverlayBackground,
		type OverlayTownVisibility
	} from '../../shared/ui/overlayRender';
	import HowToPlay from './HowToPlay.svelte';

	let overlayScreenView: OverlayScreenView = 'overview';
	let overlayTownVisibility: OverlayTownVisibility = { hideTownRender: false };
	let overlayBackground: OverlayBackground = {};
	let showScoutBackAction = false;

	$: inMatch = $gameSessionState.lobby?.status === 'in-game' || !!$gameSessionState.game;

	function openBlueprints() {
		blueprintModalState.set({ isOpen: true, mode: 'view', q: 0, r: 0 });
	}

	function openShop() {
		shopModalState.set({ isOpen: true });
	}

	function openArmy() {
		armyModalState.set({ isOpen: true });
	}

	function openHowToPlay() {
		howToPlayModalState.set({ isOpen: true });
	}

	function handleMiddleAction() {
		if (showScoutBackAction) {
			gameSessionClient.viewOwnTown();
			return;
		}
		if ($appViewState.activeOverlay?.isTownToggleable) {
			toggleOverlayScreenView();
			return;
		}
		openShop();
	}

	$: showScoutBackAction = !$appViewState.activeOverlay?.isTownToggleable && $appViewState.isScouting;

	$: if (!$appViewState.activeOverlay?.isTownToggleable) {
		overlayScreenView = 'overview';
	}

	$: overlayTownVisibility = $appViewState.activeOverlay && overlayScreenView === 'overview'
		? {
			hideTownRender: $appViewState.activeOverlay.hideTownRender
		}
		: { hideTownRender: false };

	$: overlayBackground = $appViewState.activeOverlay
		? { backgroundColor: $appViewState.activeOverlay.overviewBackgroundColor }
		: {};

	function toggleOverlayScreenView() {
		overlayScreenView = overlayScreenView === 'overview' ? 'town' : 'overview';
	}

	$: middleActionLabel = showScoutBackAction
		? 'Back'
		: $appViewState.activeOverlay?.isTownToggleable
		? overlayScreenView === 'overview'
			? 'Town'
			: 'Back'
		: 'Shop';
	$: middleActionIconPath = showScoutBackAction
		? 'assets/game_icons/entry-door.svg'
		: $appViewState.activeOverlay?.isTownToggleable
		? overlayScreenView === 'overview'
			? 'assets/game_icons/exit-door.svg'
			: 'assets/game_icons/entry-door.svg'
		: 'assets/game_icons/cash.svg';

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
	{#if inMatch}
		<div class="top-bar">
			<button class="how-to-play-btn" on:click={openHowToPlay} title="How to Play">?</button>
			<ResourceCounter keyName="wood" code="1fab5" />
			<ResourceCounter keyName="stone" code="1faa8" />
			<ResourceCounter keyName="food" code="1f35e" />
			<ResourceCounter keyName="mana" code="1f4a7" />
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
	{/if}

	<MultiplayerPanel />
	{#if $appViewState.activeOverlay?.fightPanel && overlayScreenView === 'overview'}
		<FightPhasePanel />
	{/if}
	{#if $appViewState.activeOverlay?.advancePanel && overlayScreenView === 'overview'}
		<AdvancePhasePanel />
	{/if}

	{#if !overlayTownVisibility.hideTownRender}
		<Sidebar />
	{/if}
	<BuildingSelector />
	<Shop />
	<Army />
	<Combat />
	<HowToPlay />
</div>

<style>
	.ui-root {
		position: fixed;
		inset: 0;
		pointer-events: none;
		--ui-edge-right: var(--space-lg);
		--ui-edge-bottom: var(--space-md);
	}
	.top-bar {
		position: absolute;
		top: var(--space-sm);
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-sm);
		pointer-events: auto;
	}

	.how-to-play-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.4);
		background: rgba(0, 0, 0, 0.6);
		color: white;
		font-weight: bold;
		font-size: 1.2rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}
	.how-to-play-btn:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: white;
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
			bottom: var(--space-xs);
		}
	}
	.scout-chip {
		font-weight: var(--font-weight-bold);
		background: rgba(168, 84, 28, 0.85);
	}

</style>
