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

export interface ShopModalState {
    isOpen: boolean;
}

export const shopModalState = writable<ShopModalState>({
    isOpen: false
});

export interface ArmyModalState {
    isOpen: boolean;
}

export const armyModalState = writable<ArmyModalState>({
    isOpen: false
});

export interface CombatModalState {
	isOpen: boolean;
}

export const combatModalState = writable<CombatModalState>({
	isOpen: false
});

export interface HowToPlayModalState {
	isOpen: boolean;
}

export const howToPlayModalState = writable<HowToPlayModalState>({
	isOpen: false
});
