<script lang="ts">
    import { eventBus } from '../eventBus';
    import { blueprintInventory, blueprintModalState } from './uiState';
    import BuildingCard from './BuildingCard.svelte';
    import { getPurchasableBuildings } from '../game/scenes/Kingdom/data/buildings';

    // Subscribe to stores
    let state: { isOpen: boolean; mode: 'view' | 'build'; q: number; r: number } = { isOpen: false, mode: 'view', q: 0, r: 0 };
    blueprintModalState.subscribe(v => state = v);

    let inventory: Record<string, number> = {};
    blueprintInventory.subscribe(v => inventory = v);

    // Pending build: consume blueprint only when game confirms build.
    let pendingBuild: { q: number; r: number; buildingId: string } | null = null;

    eventBus.subscribeGameToUi((event) => {
        if (event.type !== 'build-result') return;
        if (!pendingBuild) return;
        if (event.q !== pendingBuild.q || event.r !== pendingBuild.r || event.buildingId !== pendingBuild.buildingId) return;

        if (event.ok) {
            const current = inventory[pendingBuild.buildingId] || 0;
            const next = Math.max(0, current - 1);
            const updated = { ...inventory };
            if (next === 0) delete updated[pendingBuild.buildingId];
            else updated[pendingBuild.buildingId] = next;
            blueprintInventory.set(updated);
        } else {
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
    <div class="overlay">
        <div class="modal">
            <div class="header">
                <h2>{state.mode === 'build' ? 'Select Blueprint' : 'Blueprint Inventory'}</h2>
                <button class="close-btn" on:click={close}>X</button>
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
                    <div class="empty">No blueprints yet.</div>
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        z-index: 100;
    }

    .modal {
        background: #2a2a2a;
        color: #fff;
        width: 600px;
        max-height: 80vh;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        border: 1px solid #444;
    }

    .header {
        padding: 16px;
        border-bottom: 1px solid #444;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .header h2 {
        margin: 0;
        font-size: 1.2rem;
    }

    .close-btn {
        background: none;
        border: none;
        color: #aaa;
        cursor: pointer;
        font-size: 1.2rem;
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
        color: #ccc;
        margin-bottom: 8px;
    }
</style>
