import { WorldStore } from './ServerEcsWorld';

export class ServerGameState {
	readonly seed: number;
	readonly world: WorldStore;

	constructor(seed: number) {
		this.seed = seed;
		this.world = new WorldStore();
	}
}