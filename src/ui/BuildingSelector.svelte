<script lang="ts">
    import { blueprintModalState } from './uiState';
    import { buildingSelectorState } from './projections/buildingSelectorViewState';
    import BuildingCard from './BuildingCard.svelte';
    import { gameSessionClient } from '../multiplayer/client/gameSessionStore';

    // Subscribe to stores
    let state: { isOpen: boolean; mode: 'view' | 'build'; q: number; r: number } = { isOpen: false, mode: 'view', q: 0, r: 0 };
    blueprintModalState.subscribe(v => state = v);

    function close() {
        blueprintModalState.set({ ...state, isOpen: false });
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
</script>

{#if state.isOpen}
    <div class="ui-overlay" style="--ui-overlay-z: 100;">
        <div class="ui-modal modal">
            <div class="ui-modal-header">
                <h2 class="ui-modal-title">{state.mode === 'build' ? 'Select Blueprint' : 'Blueprint Inventory'}</h2>
                <button class="ui-close-btn" on:click={close}>X</button>
            </div>
            
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
