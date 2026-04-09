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
	let showHousedUnitCard = false;

	const CARD_GAP = 24;
	const CARD_MARGIN = 12;

	const unsubscribe = sidebarViewState.subscribe((view) => {
		const nextSelected = view.selectedTile;
		if (!nextSelected) {
			selected = null;
			visible = false;
			lastAnchor = null;
			showHousedUnitCard = false;
			return;
		}
		selected = nextSelected;
		visible = true;
		showHousedUnitCard = false;
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

	function openHousedUnitCard(): void {
		if (!selected?.housedUnit) return;
		showHousedUnitCard = true;
	}

	function closeHousedUnitCard(): void {
		showHousedUnitCard = false;
	}

	async function positionCardFromAnchor(screenX: number, screenY: number): Promise<void> {
		lastAnchor = { x: screenX, y: screenY };
		await tick();

		const cardWidth = cardEl?.offsetWidth ?? 420;
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
		showHousedUnitCard = false;
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
		showHousedUnitCard = false;
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
		showHousedUnitCard = false;
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
		showHousedUnitCard = false;
	}
</script>

{#if visible && selected}
	<div
		class="tile-card ui-notched-card {notchSide === 'left' ? 'ui-notched-card--notch-left' : 'ui-notched-card--notch-right'}"
		bind:this={cardEl}
		style="left: {cardLeft}px; top: {cardTop}px;"
		on:pointerdown|stopPropagation
		on:pointerup|stopPropagation
	>
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
					<p>Produces {amount} {resourceEmoji(resource)} / ⌛</p>
				{/each}

				{#if selected.housedUnit}
					<p>
						Houses
						<span class="tile-card__unit-hover" role="group" on:mouseenter={openHousedUnitCard} on:mouseleave={closeHousedUnitCard}>
							<button
								type="button"
								class="tile-card__unit-link"
								on:focus={openHousedUnitCard}
								on:blur={closeHousedUnitCard}
							>
								{selected.housedUnit.name}
							</button>
							{#if showHousedUnitCard}
								<span class="tile-card__unit-popover">
									<UnitCard unit={selected.housedUnit} tier={selected.buildingTier ?? null} showNotch={false} />
								</span>
							{/if}
						</span>.
					</p>
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

	.tile-card__unit-link {
		margin-left: 4px;
		padding: 0;
		border: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.9);
		background: transparent;
		color: inherit;
		font: inherit;
		line-height: inherit;
		cursor: pointer;
	}

	.tile-card__unit-hover {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.tile-card__unit-popover {
		position: absolute;
		top: -14px;
		z-index: 3;
	}

	.tile-card.ui-notched-card--notch-left .tile-card__unit-hover .tile-card__unit-popover {
		right: calc(100% + 16px);
	}

	.tile-card.ui-notched-card--notch-right .tile-card__unit-hover .tile-card__unit-popover {
		left: calc(100% + 16px);
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
