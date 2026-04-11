<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { blueprintModalState } from './uiState';
	import { sidebarViewState } from './projections/sidebarViewState';
	import type { ResourceMap } from '../shared/domain/types';
	import { gameSessionClient, type SelectedTileView } from '../multiplayer/client/gameSessionStore';
	import { getHexTileColorForSchool, toCssHexColor } from '../shared/ui/buildingSchoolColors';
	import { orderedResourceEntries, resourceEmoji } from './cardFormatters';
	import UnitCard from './UnitCard.svelte';

	let visible = false;
	let selected: SelectedTileView | null = null;
	let cardEl: HTMLDivElement | null = null;
	let cardLeft = 16;
	let cardTop = 16;
	let notchSide: 'left' | 'right' = 'right';
	let lastAnchor: { x: number; y: number } | null = null;

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
		const ok = confirm('Expand this tile by spending 1 expansion token?');
		if (!ok) return;
		const result = await gameSessionClient.requestExpandTile(selected.q, selected.r);
		if (!result.ok) {
			alert(result.reason);
			return;
		}
		visible = false;
		selected = null;
	}

	async function onDestroyClick() {
		if (!selected) return;
		if (!canInteract) return;
		const result = await gameSessionClient.requestDestroy(selected.q, selected.r);
		if (!result.ok) {
			alert(result.reason);
			return;
		}
		visible = false;
	}

	function formatCost(cost: ResourceMap | undefined): string {
		if (!cost) return '';
		return Object.entries(cost)
			.map(([res, amount]) => `${amount} ${res}`)
			.join(', ');
	}

	async function onUpgradeClick() {
		if (!selected?.nextUpgradeId) return;
		if (!canInteract) return;
		const costStr = formatCost(selected.nextUpgradeCost);
		const timeStr = selected.nextUpgradeTime !== undefined ? `${selected.nextUpgradeTime}s` : '';
		const ok = confirm(`Upgrade to ${selected.nextUpgradeId}?\nCost: ${costStr}\nTime: ${timeStr}`);
		if (!ok) return;

		const result = await gameSessionClient.requestUpgrade(selected.q, selected.r, selected.nextUpgradeId);
		if (!result.ok) {
			alert(result.reason);
			return;
		}
		visible = false;
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

<style>
	.tile-card {
		position: fixed;
		padding: 14px;
		max-width: min(430px, calc(100vw - 24px));
		min-width: min(330px, calc(100vw - 24px));
		z-index: 40;
		pointer-events: auto;
	}

	.tile-card--with-unit {
		max-width: min(880px, calc(100vw - 24px));
	}

	.tile-card__layout {
		display: grid;
		grid-template-columns: minmax(300px, 430px);
		gap: 12px;
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
		font-weight: 800;
		font-size: 28px;
	}

	.tile-card__titles p {
		margin: 4px 0 0;
		font-size: 16px;
		line-height: 1.1;
	}

	.tile-card__status {
		margin: 10px 0 0;
		font-size: 16px;
		line-height: 1.2;
	}

	.tile-card__description {
		margin-top: 10px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.tile-card__description p {
		margin: 0;
		font-size: 16px;
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
		border-color: rgba(255, 255, 255, 0.08);
		font-weight: 700;
		line-height: 1;
		font-size: 24px;
		padding: 8px 14px;
	}

	.tile-card__action:hover {
		background: #3a86ff;
	}

	@media (max-width: 860px) {
		.tile-card {
			min-width: min(280px, calc(100vw - 24px));
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
