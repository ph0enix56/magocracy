import type { WorldStoreOptions } from './WorldStore';
import { WorldStore } from './WorldStore';

export class ServerGameState {
	readonly seed: number;
	readonly world: WorldStore;

	constructor(seed: number, options?: WorldStoreOptions) {
		this.seed = seed;
		this.world = new WorldStore(options);
	}
}