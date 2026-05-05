<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { blueprintModalState } from './store/uiState';
	import { sidebarViewState } from './store/sidebarViewState';
	import BuildingCard from './BuildingCard.svelte';
	import {
		gameSessionClient,
		gameSessionState,
		type CommandResult,
		type SelectedTileView
	} from '../client/gameSessionStore';
	import { getHexTileColorForSchool, toCssHexColor } from '../../shared/ui/buildingSchoolColors';
	import { orderedResourceEntries, resourceEmoji } from './cardFormatters';
	import UnitCard from './UnitCard.svelte';

	let visible = false;
	let selected: SelectedTileView | null = null;
	let cardEl: HTMLDivElement | null = null;
	let cardLeft = 16;
	let cardTop = 16;
	let notchSide: 'left' | 'right' = 'right';
	let lastAnchor: { x: number; y: number } | null = null;
	let actionDialogEl: HTMLDialogElement | null = null;

	type PendingTileAction =
		| { kind: 'expand'; q: number; r: number }
		| { kind: 'destroy'; q: number; r: number }
		| { kind: 'upgrade'; q: number; r: number; upgradeBuildingId: string };

	let pendingTileAction: PendingTileAction | null = null;
	let pendingUpgradeBuildingId: string | null = null;

	const CARD_GAP = 24;
	const CARD_MARGIN = 12;

	const unsubscribe = sidebarViewState.subscribe((view) => {
		const nextSelected = view.selectedTile;
		if (!nextSelected) {
			selected = null;
			visible = false;
			lastAnchor = null;
			return;
		}
		selected = nextSelected;
		visible = true;
		if (nextSelected.anchor) {
			void positionCardFromAnchor(nextSelected.anchor.screenX, nextSelected.anchor.screenY);
		}
	});

	onMount(() => {
		const handleResize = () => {
			if (!visible) return;
			if (lastAnchor) {
				void positionCardFromAnchor(lastAnchor.x, lastAnchor.y);
			}
		};

		window.addEventListener('resize', handleResize);
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});

	onDestroy(() => {
		unsubscribe();
	});

	$: canInteract = $sidebarViewState.canTownInteract && !$sidebarViewState.isScouting;
	$: selectedHousedUnit = selected?.housedArmyUnit ?? selected?.housedUnit ?? null;
	$: pendingUpgradeBuildingId = getPendingUpgradeBuildingId(pendingTileAction);
	$: pendingUpgradeDef = pendingUpgradeBuildingId
		? ($gameSessionState.catalog.find((entry) => entry.id === pendingUpgradeBuildingId) ?? null)
		: null;

	function getPendingUpgradeBuildingId(action: PendingTileAction | null): string | null {
		if (!action || action.kind !== 'upgrade') return null;
		return action.upgradeBuildingId;
	}

	function schoolDistrictLabel(school: string | undefined): string {
		if (!school) return 'Unknown district';
		return `${school.charAt(0).toUpperCase()}${school.slice(1)} district`;
	}

	function kindLabel(kind: SelectedTileView['buildingKind']): string {
		if (kind === 'army') return 'Army';
		if (kind === 'production') return 'Production';
		return 'District';
	}

	function iconBackground(selectedTile: SelectedTileView): string {
		if (!selectedTile.built) return '#8b8b8b';
		return toCssHexColor(getHexTileColorForSchool(selectedTile.buildingSchool));
	}

	async function positionCardFromAnchor(screenX: number, screenY: number): Promise<void> {
		lastAnchor = { x: screenX, y: screenY };
		await tick();

		const cardWidth = cardEl?.offsetWidth ?? (selectedHousedUnit ? 860 : 420);
		const cardHeight = cardEl?.offsetHeight ?? 220;
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		let nextLeft = screenX - cardWidth - CARD_GAP;
		notchSide = 'left';
		if (nextLeft < CARD_MARGIN) {
			nextLeft = screenX + CARD_GAP;
			notchSide = 'right';
		}

		nextLeft = Math.max(CARD_MARGIN, Math.min(nextLeft, viewportWidth - cardWidth - CARD_MARGIN));

		let nextTop = Math.round(screenY - cardHeight / 2);
		nextTop = Math.max(CARD_MARGIN, Math.min(nextTop, viewportHeight - cardHeight - CARD_MARGIN));

		cardLeft = nextLeft;
		cardTop = nextTop;
	}

	function onBuild() {
		if (!selected) return;
		if (!canInteract) return;
		if (selected.isExpansionSite) {
			void onExpand();
			return;
		}
		blueprintModalState.set({ isOpen: true, mode: 'build', q: selected.q, r: selected.r });
		visible = false;
		selected = null;
	}

	async function onExpand() {
		if (!selected) return;
		if (!canInteract) return;
		openTileActionDialog({ kind: 'expand', q: selected.q, r: selected.r });
	}

	async function onDestroyClick() {
		if (!selected) return;
		if (!canInteract) return;
		openTileActionDialog({ kind: 'destroy', q: selected.q, r: selected.r });
	}

	async function onUpgradeClick() {
		if (!selected?.nextUpgradeId) return;
		if (!canInteract) return;
		openTileActionDialog({
			kind: 'upgrade',
			q: selected.q,
			r: selected.r,
			upgradeBuildingId: selected.nextUpgradeId
		});
	}

	function openTileActionDialog(action: PendingTileAction): void {
		pendingTileAction = action;
		if (!actionDialogEl) return;
		if (actionDialogEl.open) {
			actionDialogEl.close();
		}
		actionDialogEl.showModal();
	}

	function closeTileActionDialog(): void {
		if (actionDialogEl?.open) {
			actionDialogEl.close();
		}
		pendingTileAction = null;
	}

	function onTileActionDialogClosed(): void {
		pendingTileAction = null;
	}

	async function confirmTileAction(): Promise<void> {
		if (!pendingTileAction) return;
		const action = pendingTileAction;
		let result: CommandResult;

		if (action.kind === 'expand') {
			result = await gameSessionClient.requestExpandTile(action.q, action.r);
		} else if (action.kind === 'destroy') {
			result = await gameSessionClient.requestDestroy(action.q, action.r);
		} else {
			result = await gameSessionClient.requestUpgrade(action.q, action.r, action.upgradeBuildingId);
		}

		closeTileActionDialog();
		if (!result.ok) {
			alert(result.reason);
			return;
		}
		visible = false;
		selected = null;
	}
</script>

{#if visible && selected}
	<div
		class="tile-card ui-notched-card {notchSide === 'left' ? 'ui-notched-card--notch-left' : 'ui-notched-card--notch-right'} {selectedHousedUnit ? 'tile-card--with-unit' : ''}"
		bind:this={cardEl}
		style="left: {cardLeft}px; top: {cardTop}px;"
		on:pointerdown|stopPropagation
		on:pointerup|stopPropagation
	>
		<div class="tile-card__layout">
			<div class="tile-card__primary">
				<div class="tile-card__header">
					<div class="tile-card__icon" style="background: {iconBackground(selected)};">
						{#if selected.built && selected.buildingAssetPath}
							<img src={`assets/${selected.buildingAssetPath}`} alt={selected.buildingName ?? selected.buildingId ?? 'Building'} />
						{/if}
					</div>
					<div class="tile-card__titles">
						<h2>{selected.isExpansionSite ? 'Expansion site' : selected.built ? (selected.buildingName ?? selected.buildingId ?? 'Building') : 'Empty space'}</h2>
						{#if selected.built}
							<p>Tier {selected.buildingTier ?? '?'} {schoolDistrictLabel(selected.buildingSchool)}</p>
							<p>{kindLabel(selected.buildingKind)}</p>
						{:else if selected.isExpansionSite}
							<p>Spend 1 expansion token to unlock this tile.</p>
						{/if}
					</div>
				</div>

				{#if selected.built}
					<div class="tile-card__description">
						{#each orderedResourceEntries(selected.buildingProductions) as [resource, amount] (`${resource}-${amount}`)}
							<p>Produces {amount} {resourceEmoji(resource)} / ⌛.</p>
						{/each}

						{#if selectedHousedUnit}
							<p>Houses {selectedHousedUnit.name}.</p>
						{/if}

						{#if selected.buildingDescription}
							<p>{selected.buildingDescription}</p>
						{/if}
					</div>
				{/if}

				{#if selected.constructionProgress !== undefined}
					<p class="tile-card__status">Construction: {Math.round(selected.constructionProgress)}%</p>
				{/if}
				{#if selected.upgradeProgress !== undefined}
					<p class="tile-card__status">Upgrade: {Math.round(selected.upgradeProgress)}%</p>
				{/if}

				{#if !canInteract && $sidebarViewState.isScouting && $sidebarViewState.viewedPlayerName}
					<p class="tile-card__status">Scouting {$sidebarViewState.viewedPlayerName}. Interactions are disabled.</p>
				{/if}

				{#if canInteract}
					<div class="tile-card__actions">
						{#if selected.isExpansionSite}
							<button class="ui-button tile-card__action" on:pointerdown|stopPropagation on:click|stopPropagation={onExpand}>Expand</button>
						{:else if selected.built}
							{#if selected.nextUpgradeId}
								<button class="ui-button tile-card__action" on:pointerdown|stopPropagation on:click|stopPropagation={onUpgradeClick}>Upgrade</button>
							{/if}
							<button class="ui-button tile-card__action" on:pointerdown|stopPropagation on:click|stopPropagation={onDestroyClick}>Destroy</button>
						{:else}
							<button class="ui-button tile-card__action" on:pointerdown|stopPropagation on:click|stopPropagation={onBuild}>Build</button>
						{/if}
					</div>
				{/if}
			</div>

			{#if selectedHousedUnit}
				<div class="tile-card__unit-panel">
					<UnitCard unit={selectedHousedUnit} tier={selected.buildingTier ?? null} showNotch={false} />
				</div>
			{/if}
		</div>
	</div>
{/if}

<dialog class="tile-action-dialog" bind:this={actionDialogEl} on:close={onTileActionDialogClosed}>
	{#if pendingTileAction}
		<div class="tile-action-dialog__content">
			{#if pendingTileAction.kind === 'expand'}
				<h3>Expand Tile</h3>
				<p>Spend 1 expansion token to unlock this tile?</p>
			{:else if pendingTileAction.kind === 'destroy'}
				<h3>Destroy District</h3>
				<p>Destroy the district on this tile?</p>
			{:else}
				<h3>Upgrade District</h3>
				<p>Upgrade into the following district:</p>
				{#if pendingUpgradeDef}
					<div class="tile-action-dialog__upgrade-card">
						<BuildingCard def={pendingUpgradeDef} count={null} actionLabel={null} actionDisabled={false} />
					</div>
				{:else}
					<p class="ui-muted">Upgrade target details unavailable.</p>
				{/if}
			{/if}

			<div class="tile-action-dialog__actions">
				<button class="ui-button ui-button--ghost" on:click={closeTileActionDialog}>Cancel</button>
				<button class="ui-button" on:click={confirmTileAction}>Confirm</button>
			</div>
		</div>
	{/if}
</dialog>

<style>
	.tile-card {
		position: fixed;
		padding: 14px;
		max-width: min(430px, calc(100vw - var(--space-xl)));
		min-width: min(330px, calc(100vw - var(--space-xl)));
		z-index: 40;
		pointer-events: auto;
	}

	.tile-card--with-unit {
		max-width: min(880px, calc(100vw - var(--space-xl)));
	}

	.tile-card__layout {
		display: grid;
		grid-template-columns: minmax(300px, 430px);
		gap: var(--space-md);
		align-items: start;
	}

	.tile-card--with-unit .tile-card__layout {
		grid-template-columns: minmax(300px, 430px) minmax(300px, 420px);
	}

	.tile-card__primary,
	.tile-card__unit-panel {
		min-width: 0;
	}

	.tile-card__header {
		display: flex;
		align-items: flex-start;
		gap: 14px;
	}

	.tile-card__icon {
		width: 74px;
		height: 74px;
		flex: none;
		display: grid;
		place-items: center;
		overflow: hidden;
	}

	.tile-card__icon img {
		width: 70%;
		height: 70%;
		object-fit: contain;
	}

	.tile-card__titles {
		min-width: 0;
	}

	.tile-card__titles h2 {
		margin: 0;
		line-height: 1;
		font-weight: var(--font-weight-extrabold);
		font-size: 28px;
	}

	.tile-card__titles p {
		margin: var(--space-xs) 0 0;
		font-size: var(--space-lg);
		line-height: 1.1;
	}

	.tile-card__status {
		margin: 10px 0 0;
		font-size: var(--space-lg);
		line-height: 1.2;
	}

	.tile-card__description {
		margin-top: 10px;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.tile-card__description p {
		margin: 0;
		font-size: var(--space-lg);
		line-height: 1.2;
	}

	.tile-card__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 14px;
		justify-content: center;
	}

	.tile-card__action {
		background: #2270ff;
		border-color: var(--color-border-subtle);
		font-weight: var(--font-weight-bold);
		line-height: 1;
		font-size: var(--space-xl);
		padding: var(--space-sm) 14px;
	}

	.tile-card__action:hover {
		background: #3a86ff;
	}

	.tile-action-dialog {
		padding: 0;
		border: 1px solid rgba(255, 255, 255, 0.24);
		border-radius: var(--radius-lg);
		background: var(--color-surface-2);
		color: var(--color-text-light);
		width: min(640px, calc(100vw - var(--space-xl)));
		pointer-events: auto;
	}

	.tile-action-dialog::backdrop {
		background: var(--color-surface-trans-55);
	}

	.tile-action-dialog__content {
		padding: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.tile-action-dialog__content h3 {
		margin: 0;
		font-size: 1.2rem;
	}

	.tile-action-dialog__content p {
		margin: 0;
	}

	.tile-action-dialog__upgrade-card {
		padding: 2px;
	}

	.tile-action-dialog__actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
	}

	@media (max-width: 860px) {
		.tile-card {
			min-width: min(280px, calc(100vw - var(--space-xl)));
		}

		.tile-card--with-unit .tile-card__layout {
			grid-template-columns: 1fr;
		}

		.tile-card__titles h2 {
			font-size: 22px;
		}

		.tile-card__titles p,
		.tile-card__status,
		.tile-card__description p {
			font-size: 14px;
		}

		.tile-card__icon {
			width: 58px;
			height: 58px;
		}
	}
</style>
