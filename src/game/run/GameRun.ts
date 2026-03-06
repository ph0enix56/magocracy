import { ECSManager } from '../scenes/Kingdom/ecs/ECSBase';
import { CombatSystem } from '../scenes/Kingdom/ecs/systems/CombatSystem';

export class GameRun {
	readonly seed: number;
	ecs: ECSManager;
	combatSystem: CombatSystem;

	constructor(seed: number) {
		this.seed = seed;
		this.ecs = new ECSManager();
		this.combatSystem = new CombatSystem(this.ecs);
	}

	advanceTick(): void {
		this.ecs.advanceTick();
	}
}
