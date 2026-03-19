<script lang="ts">
    import { onDestroy } from 'svelte';
    import { blueprintModalState } from './uiState';
    import { blueprintInventory, buildingCatalogState } from './gameState';
    import BuildingCard from './BuildingCard.svelte';
    import type { ResourceMap } from '../shared/domain/types';
    import type { BuildingCatalogEntry } from '../shared/multiplayer/protocol';
    import { gameSessionClient, gameSessionState } from '../multiplayer/client/gameSessionStore';

    // Subscribe to stores
    let state: { isOpen: boolean; mode: 'view' | 'build'; q: number; r: number } = { isOpen: false, mode: 'view', q: 0, r: 0 };
    blueprintModalState.subscribe(v => state = v);

    let inventory: ResourceMap = {};
    blueprintInventory.subscribe(v => inventory = v);
    let purchasableBuildings: BuildingCatalogEntry[] = [];
    const unsubscribeCatalog = buildingCatalogState.subscribe((entries) => {
        purchasableBuildings = entries.filter((entry) => !entry.parentId && !entry.isBlocker);
    });

    function close() {
        blueprintModalState.set({ ...state, isOpen: false });
    }

    async function build(buildingId: string) {
        if (state.mode !== 'build' || !$gameSessionState.canTownInteract) return;
        const result = await gameSessionClient.requestBuild(state.q, state.r, buildingId);
        close();
        if (!result.ok) {
            alert(result.reason);
        }
    }

    function ownedBlueprints() {
        return purchasableBuildings
            .map(def => ({ def, count: inventory[def.id] || 0 }))
            .filter(x => x.count > 0);
    }

	onDestroy(() => {
		unsubscribeCatalog();
	});
</script>

{#if state.isOpen}
    <div class="ui-overlay" style="--ui-overlay-z: 100;">
        <div class="ui-modal modal">
            <div class="ui-modal-header">
                <h2 class="ui-modal-title">{state.mode === 'build' ? 'Select Blueprint' : 'Blueprint Inventory'}</h2>
                <button class="ui-close-btn" on:click={close}>X</button>
            </div>
            
            <div class="list">
                {#if state.mode === 'build' && $gameSessionState.isScouting && $gameSessionState.viewedPlayer}
                    <div class="empty ui-muted">Scouting {$gameSessionState.viewedPlayer.name}. Building is disabled.</div>
                {/if}
                {#each ownedBlueprints() as item}
                    <BuildingCard
                        def={item.def}
                        count={item.count}
                        actionLabel={state.mode === 'build' ? 'Use' : null}
                        actionDisabled={state.mode === 'build' && !$gameSessionState.canTownInteract}
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
