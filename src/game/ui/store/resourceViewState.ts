import { derived } from 'svelte/store';
import { gameSessionState } from '../../client/gameSessionStore';

export function createResourceAmountState(keyName: string) {
	return derived(gameSessionState, ($state) => $state.resources[keyName] ?? 0);
}
