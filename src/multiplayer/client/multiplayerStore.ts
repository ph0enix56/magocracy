import { readable } from 'svelte/store';
import { multiplayerClient } from './clientSingleton';

export const multiplayerState = readable(multiplayerClient.getState(), (set) => {
	const unsubscribe = multiplayerClient.subscribe((state) => set(state));
	return unsubscribe;
});
