import { readable } from 'svelte/store';
import { eventBus } from '../eventBus';

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
