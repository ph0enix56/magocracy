import { readable } from 'svelte/store';
import { eventBus } from '../eventBus';
import type { CombatUiState } from '../eventBus';

export const blueprintInventory = readable<Record<string, number>>({}, (set) => {
	const unsubscribe = eventBus.subscribeGameToUi((event) => {
		if (event.type !== 'blueprint-inventory-updated') return;
		set(event.inventory);
	});
	return unsubscribe;
});

export type ShopViewState = {
	offers: Array<string | null>;
	buyCost: number;
	rerollCost: number;
};

export const shopState = readable<ShopViewState>({ offers: [], buyCost: 0, rerollCost: 0 }, (set) => {
	const unsubscribe = eventBus.subscribeGameToUi((event) => {
		if (event.type !== 'shop-state-updated') return;
		set({ offers: event.offers, buyCost: event.buyCost, rerollCost: event.rerollCost });
	});
	return unsubscribe;
});

export type ArmyUnitView = {
	entityId: string;
	unitId: string;
	name: string;
	assetPath: string;
	speed: number;
	health: number;
	drFlat: number;
	drPercent: number;
	actionsPerTurn: number;
	trainingLevel: number;
	trainingStatus: 'idle' | 'training';
	trainingProgress: number;
	nextTrainCost: Record<string, number>;
	trainTime: number;
};

export const armyState = readable<ArmyUnitView[]>([], (set) => {
	const unsubscribe = eventBus.subscribeGameToUi((event) => {
		if (event.type !== 'army-state-updated') return;
		set(event.units);
	});
	return unsubscribe;
});

export const combatState = readable<CombatUiState>({
	status: 'idle',
	round: 0,
	activeSide: 'armyA',
	armyA: [],
	armyB: [],
	log: []
}, (set) => {
	const unsubscribe = eventBus.subscribeGameToUi((event) => {
		if (event.type !== 'combat-state-updated') return;
		set(event.state);
	});
	return unsubscribe;
});
