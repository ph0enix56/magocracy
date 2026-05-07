import type { WorldStoreOptions } from './WorldStore';
import { WorldStore } from './WorldStore';

/** Thin wrapper that associates a {@link WorldStore} with a single player's game session. */
export class ServerGameState {
	readonly world: WorldStore;

	constructor(options?: WorldStoreOptions) {
		this.world = new WorldStore(options);
	}
}