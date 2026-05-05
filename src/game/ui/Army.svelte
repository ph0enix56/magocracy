<script lang="ts">
	import { armyModalState } from './store/uiState';
	import { armyPanelState } from './store/armyViewState';
	import { gameSessionClient } from '../client/gameSessionStore';
	import UnitCard from './UnitCard.svelte';
	import type { ArmyUnit } from '../../shared/domain/gameViews';
	import type { BuildingCatalogEntry } from '../../shared/multiplayer/snapshots';

	let state: { isOpen: boolean } = { isOpen: false };
	armyModalState.subscribe(v => (state = v));
	let hoveredUnitEntityId: string | null = null;

	$: tierByUnitDefId = buildTierByUnitDefId($armyPanelState.catalog);
	$: hoveredUnit = $armyPanelState.units.find((unit) => unit.entityId === hoveredUnitEntityId) ?? null;

	function close() {
		armyModalState.set({ isOpen: false });
		hoveredUnitEntityId = null;
	}

	function buildTierByUnitDefId(catalog: BuildingCatalogEntry[]): Map<string, number> {
		const out = new Map<string, number>();
		for (const entry of catalog) {
			if (!entry.housedUnit?.id) continue;
			const current = out.get(entry.housedUnit.id);
			if (current === undefined || entry.tier < current) {
				out.set(entry.housedUnit.id, entry.tier);
			}
		}
		return out;
	}

	function onUnitPreviewStart(unit: ArmyUnit): void {
		hoveredUnitEntityId = unit.entityId;
	}

	function onUnitPreviewEnd(unit: ArmyUnit): void {
		if (hoveredUnitEntityId === unit.entityId) {
			hoveredUnitEntityId = null;
		}
	}

	async function reorder(unitEntityId: string, direction: 'up' | 'down') {
		if (!$armyPanelState.canArmyReorder) return;
		const result = await gameSessionClient.requestArmyReorder(unitEntityId, direction);
		if (!result.ok) {
			alert(result.reason);
		}
	}
</script>

{#if state.isOpen}
	<div class="ui-overlay" style="--ui-overlay-z: 120;">
		<div class="ui-modal modal">
			<div class="ui-modal-header">
				<h2 class="ui-modal-title">Army</h2>
				<button class="ui-close-btn" on:click={close}>X</button>
			</div>
			{#if $armyPanelState.isScouting && $armyPanelState.viewedPlayerName}
				<div class="readonly-banner">Scouting {$armyPanelState.viewedPlayerName}. Army actions are disabled.</div>
			{/if}

			<div class="content">
				<div class="list">
					{#if $armyPanelState.units.length === 0}
						<div class="empty ui-muted">No units yet. Build an army building.</div>
					{/if}

					{#each $armyPanelState.units as u, i (u.entityId)}
						<div class="unit-row" role="group" on:mouseenter={() => onUnitPreviewStart(u)} on:mouseleave={() => onUnitPreviewEnd(u)}>
							<div class="unit-row__trigger" role="group">
								<div class="icon-container">
									<img class="unit-icon unit-icon--ally" src={`assets/${u.assetPath}`} alt={u.name} />
								</div>
								<div class="unit-name">{u.name}</div>
							</div>
							<div class="reorder">
								<button class="ui-button ui-button--tiny reorder-btn" disabled={i === 0 || !$armyPanelState.canArmyReorder} on:click={() => reorder(u.entityId, 'up')}>↑</button>
								<button
									class="ui-button ui-button--tiny reorder-btn"
									disabled={i === $armyPanelState.units.length - 1 || !$armyPanelState.canArmyReorder}
									on:click={() => reorder(u.entityId, 'down')}
								>
									↓
								</button>
							</div>
						</div>
					{/each}
				</div>

				<div class="preview-pane">
					{#if hoveredUnit}
						<UnitCard unit={hoveredUnit} tier={tierByUnitDefId.get(hoveredUnit.unitDefId) ?? null} showNotch={false} />
					{:else}
						<div class="preview-empty ui-muted">Hover a unit row to preview details.</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}


<style>
	.modal {
		width: fit-content;
		max-width: min(960px, calc(100vw - 24px));
		max-height: 80vh;
	}

	.content {
		padding: 16px 18px;
		display: grid;
		grid-template-columns: minmax(340px, 400px) minmax(360px, 420px);
		gap: 16px;
		align-items: start;
	}

	.list {
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-height: calc(80vh - 92px);
		padding-inline: 2px;
	}

	.readonly-banner {
		padding: 10px 16px 0;
		color: #ffd28a;
		font-size: 0.9rem;
	}

	.empty {
		padding: 12px;
	}

	.unit-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #333;
		border-radius: 4px;
		padding: 10px;
		gap: 10px;
		cursor: default;
	}

	.unit-row__trigger {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		flex: 1;
	}

	.unit-name {
		font-size: 1.05rem;
		font-weight: 700;
	}

	.reorder {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
	}

	.icon-container {
		width: 52px;
		height: 52px;
		background: #222;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.icon-container img {
		max-width: 100%;
		max-height: 100%;
	}

	.unit-icon--ally {
		filter: grayscale(0) sepia(1) hue-rotate(85deg) saturate(5) contrast(1) brightness(1);
	}

	.reorder-btn {
		background: #444;
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: #fff;
		font-weight: 800;
	}

	.reorder-btn:hover {
		background: #555;
	}

	.reorder-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.preview-pane {
		min-height: 200px;
		max-height: calc(80vh - 92px);
		overflow-y: auto;
		overflow-x: hidden;
		padding-inline: 2px;
	}

	.preview-empty {
		padding: 12px;
		border: 1px dashed rgba(255, 255, 255, 0.25);
		border-radius: 6px;
	}

	@media (max-width: 980px) {
		.content {
			grid-template-columns: 1fr;
		}

		.preview-pane {
			max-height: 46vh;
		}
	}
</style>
