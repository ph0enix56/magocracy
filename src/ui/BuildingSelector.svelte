<script lang="ts">
    import { getBuildableBuildings } from '../game/scenes/Kingdom/data/buildings';
    import { eventBus } from '../eventBus';
    import { blueprintInventory, blueprintModalState } from './uiState';

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
        const buildables = getBuildableBuildings();
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
                    <div class="building-card">
                        <div class="icon-container">
                            <img src={`assets/${item.def.assetPath}`} alt={item.def.name} />
                        </div>
                        <div class="info">
                            <div class="name">{item.def.name} <span class="count">x{item.count}</span></div>
                            <div class="description">{item.def.description}</div>
                            <div class="stats">
                                <div class="cost">
                                    Cost:
                                    {#each Object.entries(item.def.cost) as [res, amount]}
                                        <span class="cost-item">{amount} {res}</span>
                                    {/each}
                                </div>
                                <div class="time">Time: {item.def.buildTime}s</div>
                            </div>
                        </div>
                        <div class="actions">
                            {#if state.mode === 'build'}
                                <button on:click={() => build(item.def.id)}>Use</button>
                            {/if}
                        </div>
                    </div>
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

    .building-card {
        display: flex;
        background: #333;
        border-radius: 4px;
        padding: 12px;
        gap: 16px;
        align-items: center;
    }

    .icon-container {
        width: 64px;
        height: 64px;
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

    .info {
        flex: 1;
    }

    .name {
        font-weight: bold;
        font-size: 1.1rem;
        margin-bottom: 4px;
    }

    .count {
        font-weight: 600;
        font-size: 0.9rem;
        color: #ffd700;
        margin-left: 6px;
    }

    .description {
        font-size: 0.9rem;
        color: #ccc;
        margin-bottom: 8px;
    }

    .stats {
        font-size: 0.85rem;
        color: #aaa;
        display: flex;
        gap: 16px;
    }

    .cost-item {
        margin-right: 8px;
        color: #ffd700;
    }

    .actions button {
        padding: 8px 16px;
        background: #4a9eff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
    }

    .actions button:hover {
        background: #3a8eef;
    }

    .empty {
        padding: 12px;
        color: #ccc;
        text-align: center;
        border: 1px dashed #444;
        border-radius: 4px;
    }
</style>
