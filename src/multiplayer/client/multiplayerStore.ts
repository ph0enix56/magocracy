import { readable } from 'svelte/store';
import { MultiplayerClient } from './MultiplayerClient';

export const multiplayerClient = new MultiplayerClient();

export const multiplayerState = readable(multiplayerClient.getState(), (set) => {
	const unsubscribe = multiplayerClient.subscribe((state) => set(state));
	return unsubscribe;
});
