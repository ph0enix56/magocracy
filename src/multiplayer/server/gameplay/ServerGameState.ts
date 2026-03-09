import { CombatSystem } from './systems/CombatSystem';
import { ServerEcsWorld } from './ServerEcsWorld';

export class ServerGameState {
	readonly seed: number;
	readonly ecs: ServerEcsWorld;
	readonly combatSystem: CombatSystem;

	constructor(seed: number) {
		this.seed = seed;
		this.ecs = new ServerEcsWorld();
		this.combatSystem = new CombatSystem();
	}

	advanceTick(): void {
		this.ecs.advanceTick();
	}
}