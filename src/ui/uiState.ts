import { writable } from 'svelte/store';

export interface BuildingSelectorState {
    isOpen: boolean;
    q: number;
    r: number;
}

export const buildingSelectorState = writable<BuildingSelectorState>({
    isOpen: false,
    q: 0,
    r: 0
});

export type BlueprintModalMode = 'view' | 'build';

export interface BlueprintModalState {
    isOpen: boolean;
    mode: BlueprintModalMode;
    q: number;
    r: number;
}

export const blueprintModalState = writable<BlueprintModalState>({
    isOpen: false,
    mode: 'view',
    q: 0,
    r: 0
});

// Blueprint inventory: buildingId -> count (each blueprint allows one build)
export const blueprintInventory = writable<Record<string, number>>({
    // Starter blueprints for testing
    mine: 2,
    lumber_camp: 1,
    farm: 1,
    house: 1
});

export interface ShopModalState {
    isOpen: boolean;
}

export const shopModalState = writable<ShopModalState>({
    isOpen: false
});
