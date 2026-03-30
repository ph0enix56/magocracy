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
	import { gameSessionState } from '../multiplayer/client/gameSessionStore';
	import type { GamePhase } from '../shared/multiplayer/contracts/snapshots';
	import {
		OVERLAY_BACKGROUND_EVENT,
		OVERLAY_TOWN_VISIBILITY_EVENT,
		type OverlayBackground,
		type OverlayTownVisibility
	} from '../shared/ui/overlayRender';

	type OverlayScreenView = 'overview' | 'town';
	type OverlayPhaseConfig = {
		fightPanel: boolean;
		advancePanel: boolean;
		showTownToggleLabel: string;
		showOverviewToggleLabel: string;
		overviewBackgroundColor: number;
	};

	const OVERLAY_PHASES: Partial<Record<GamePhase, OverlayPhaseConfig>> = {
		combat: {
			fightPanel: true,
			advancePanel: false,
			showTownToggleLabel: 'Show Town',
			showOverviewToggleLabel: 'Show Fight Overview',
			overviewBackgroundColor: 0xf4c7c7
		},
		advance: {
			fightPanel: false,
			advancePanel: true,
			showTownToggleLabel: 'Show Town',
			showOverviewToggleLabel: 'Show Charter Draft',
			overviewBackgroundColor: 0xe2d5b8
		}
	};

	let overlayScreenView: OverlayScreenView = 'overview';
	let activeOverlay: OverlayPhaseConfig | null = null;
	let overlayTownVisibility: OverlayTownVisibility = { hideTownRender: false };
	let overlayBackground: OverlayBackground = {};
	let blueprintCount = 0;
	let armyCount = 0;

	function openBlueprints() {
		if (!$gameSessionState.canTownInteract) return;
		blueprintModalState.set({ isOpen: true, mode: 'view', q: 0, r: 0 });
	}

	function openShop() {
		if (!$gameSessionState.canTownInteract) return;
		shopModalState.set({ isOpen: true });
	}

	function openArmy() {
		if (!$gameSessionState.canArmyReorder) return;
		armyModalState.set({ isOpen: true });
	}

	$: if (!$gameSessionState.canTownInteract) {
		shopModalState.set({ isOpen: false });
		blueprintModalState.set({ isOpen: false, mode: 'view', q: 0, r: 0 });
	}

	$: activeOverlay = OVERLAY_PHASES[$gameSessionState.currentPhase] ?? null;

	$: if (!activeOverlay) {
		overlayScreenView = 'overview';
	}

	$: overlayTownVisibility = activeOverlay && overlayScreenView === 'overview'
		? {
			hideTownRender: true
		}
		: { hideTownRender: false };

	$: overlayBackground = activeOverlay
		? { backgroundColor: activeOverlay.overviewBackgroundColor }
		: {};

	$: blueprintCount = Object.values($gameSessionState.blueprints).reduce((sum, value) => {
		if (typeof value !== 'number' || !Number.isFinite(value)) return sum;
		return sum + Math.max(0, Math.floor(value));
	}, 0);

	$: armyCount = $gameSessionState.army.length;

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
		{#if $gameSessionState.isScouting && $gameSessionState.viewedPlayer}
			<div class="ui-chip scout-chip">Scouting {$gameSessionState.viewedPlayer.name}</div>
		{/if}
	</div>

	<RenownLeaderboard />

	<div class="bottom-actions-wrap">
		<TopActionButtons
			blueprintCount={blueprintCount}
			armyCount={armyCount}
			canTownInteract={$gameSessionState.canTownInteract}
			canArmyReorder={$gameSessionState.canArmyReorder}
			on:openBlueprints={openBlueprints}
			on:openShop={openShop}
			on:openArmy={openArmy}
		/>
	</div>

	<PhaseTimer />

	<MultiplayerPanel />
	{#if activeOverlay?.fightPanel && overlayScreenView === 'overview'}
		<FightPhasePanel />
	{/if}
	{#if activeOverlay?.advancePanel && overlayScreenView === 'overview'}
		<AdvancePhasePanel />
	{/if}

	{#if activeOverlay}
		<div class="fight-toggle-wrap">
			<button class="ui-button fight-toggle" on:click={toggleOverlayScreenView}>
				{overlayScreenView === 'overview' ? activeOverlay.showTownToggleLabel : activeOverlay.showOverviewToggleLabel}
			</button>
		</div>
	{/if}

	{#if !activeOverlay}
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
