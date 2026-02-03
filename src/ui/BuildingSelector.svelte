<script lang="ts">
    import { eventBus } from '../eventBus';
    import { blueprintModalState } from './uiState';
    import { blueprintInventory } from './gameState';
    import BuildingCard from './BuildingCard.svelte';
    import { getPurchasableBuildings } from '../game/scenes/Kingdom/data/buildings';

    // Subscribe to stores
    let state: { isOpen: boolean; mode: 'view' | 'build'; q: number; r: number } = { isOpen: false, mode: 'view', q: 0, r: 0 };
    blueprintModalState.subscribe(v => state = v);

    let inventory: Record<string, number> = {};
    blueprintInventory.subscribe(v => inventory = v);

    // Pending build: used only for correlating build-result.
    let pendingBuild: { q: number; r: number; buildingId: string } | null = null;

    eventBus.subscribeGameToUi((event) => {
        if (event.type !== 'build-result') return;
        if (!pendingBuild) return;
        if (event.q !== pendingBuild.q || event.r !== pendingBuild.r || event.buildingId !== pendingBuild.buildingId) return;

        if (!event.ok) {
            if (event.reason) alert(event.reason);
        }
        pendingBuild = null;
    });

    function close() {
        blueprintModalState.set({ ...state, isOpen: false });
        pendingBuild = null;
    }

    function build(buildingId: string) {
        if (state.mode !== 'build') return;
        pendingBuild = { q: state.q, r: state.r, buildingId };
        eventBus.publishUiToGame({ type: 'build-requested', q: state.q, r: state.r, buildingId });
        close();
    }

    function ownedBlueprints() {
        const buildables = getPurchasableBuildings();
        return buildables
            .map(def => ({ def, count: inventory[def.id] || 0 }))
            .filter(x => x.count > 0);
    }
</script>

{#if state.isOpen}
    <div class="ui-overlay" style="--ui-overlay-z: 100;">
        <div class="ui-modal modal">
            <div class="ui-modal-header">
                <h2 class="ui-modal-title">{state.mode === 'build' ? 'Select Blueprint' : 'Blueprint Inventory'}</h2>
                <button class="ui-close-btn" on:click={close}>X</button>
            </div>
            
            <div class="list">
                {#each ownedBlueprints() as item}
                    <BuildingCard
                        def={item.def}
                        count={item.count}
                        actionLabel={state.mode === 'build' ? 'Use' : null}
                        on:action={() => build(item.def.id)}
                    />
                {/each}

                {#if ownedBlueprints().length === 0}
                    <div class="empty ui-muted">No blueprints yet.</div>
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    .modal {
        width: 600px;
        max-height: 80vh;
    }

    .list {
        padding: 16px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .empty {
        padding: 12px;
        margin-bottom: 8px;
    }
</style>
