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
