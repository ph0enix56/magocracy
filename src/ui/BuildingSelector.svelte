<script lang="ts">
    import { blueprintModalState } from './uiState';
    import { buildingSelectorState } from './projections/buildingSelectorViewState';
    import BuildingCard from './BuildingCard.svelte';
    import DistrictDetailCard from './DistrictDetailCard.svelte';
    import UnitCard from './UnitCard.svelte';
    import type { BuildingCatalogEntry } from '../shared/multiplayer/snapshots';
    import { gameSessionClient } from '../multiplayer/client/gameSessionStore';

    // Subscribe to stores
    let state: { isOpen: boolean; mode: 'view' | 'build'; q: number; r: number } = { isOpen: false, mode: 'view', q: 0, r: 0 };
    blueprintModalState.subscribe(v => state = v);

    let previewBuilding: BuildingCatalogEntry | null = null;

    function close() {
        blueprintModalState.set({ ...state, isOpen: false });
        previewBuilding = null;
    }

    async function build(buildingId: string) {
        if (state.mode !== 'build' || !$buildingSelectorState.canTownInteract) return;
        const result = await gameSessionClient.requestBuild(state.q, state.r, buildingId);
        close();
        if (!result.ok) {
            alert(result.reason);
        }
    }

    function ownedBlueprints() {
        const inventory = $buildingSelectorState.blueprintInventory;
        return $buildingSelectorState.purchasableBuildings
            .map(def => ({ def, count: inventory[def.id] || 0 }))
            .filter(x => x.count > 0);
    }

    function onPreviewStart(event: CustomEvent<BuildingCatalogEntry>) {
        previewBuilding = event.detail;
    }

    function onPreviewEnd(event: CustomEvent<BuildingCatalogEntry>) {
        if (previewBuilding?.id === event.detail.id) {
            previewBuilding = null;
        }
    }
</script>

{#if state.isOpen}
    <div class="ui-overlay" style="--ui-overlay-z: 100;">
        <div class="ui-modal modal">
            <div class="ui-modal-header">
                <h2 class="ui-modal-title">{state.mode === 'build' ? 'Select Blueprint' : 'Blueprint Inventory'}</h2>
                <button class="ui-close-btn" on:click={close}>X</button>
            </div>
            
            <div class="content">
                <div class="list">
					{#if state.mode === 'build' && $buildingSelectorState.isScouting && $buildingSelectorState.viewedPlayerName}
						<div class="empty ui-muted">Scouting {$buildingSelectorState.viewedPlayerName}. Building is disabled.</div>
                    {/if}
                    {#each ownedBlueprints() as item}
                        <BuildingCard
                            def={item.def}
                            count={item.count}
                            actionLabel={state.mode === 'build' ? 'Use' : null}
							actionDisabled={state.mode === 'build' && !$buildingSelectorState.canTownInteract}
                            on:action={() => build(item.def.id)}
                            on:previewstart={onPreviewStart}
                            on:previewend={onPreviewEnd}
                        />
                    {/each}

                    {#if ownedBlueprints().length === 0}
                        <div class="empty ui-muted">No blueprints yet.</div>
                    {/if}
                </div>

                <div class="preview-pane">
                    {#if previewBuilding}
                        <div class="preview-stack">
                            <DistrictDetailCard def={previewBuilding} showNotch={false} />
                            {#if previewBuilding.housedUnit}
                                <UnitCard unit={previewBuilding.housedUnit} tier={previewBuilding.tier} showNotch={false} />
                            {/if}
                        </div>
                    {:else}
                        <div class="preview-empty ui-muted">Hover a blueprint row to preview details.</div>
                    {/if}
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal {
        width: fit-content;
        max-width: min(1100px, calc(100vw - 24px));
        max-height: 80vh;
    }

    .content {
        padding: 16px 18px;
        display: grid;
        grid-template-columns: minmax(500px, 560px) minmax(360px, 420px);
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

    .empty {
        padding: 12px;
        margin-bottom: 8px;
    }

    .preview-pane {
        min-height: 200px;
        max-height: calc(80vh - 92px);
        overflow-y: auto;
        overflow-x: hidden;
        padding-inline: 2px;
    }

    .preview-stack {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        flex-direction: column;
    }

    .preview-empty {
        padding: 12px;
        border: 1px dashed rgba(255, 255, 255, 0.25);
        border-radius: 6px;
    }

    @media (max-width: 1000px) {
        .content {
            grid-template-columns: 1fr;
        }

        .preview-pane {
            max-height: 46vh;
        }
    }
</style>
