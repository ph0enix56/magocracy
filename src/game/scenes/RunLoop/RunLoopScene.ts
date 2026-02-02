import { Scene } from 'phaser';
import { getGameRun } from '../../run/runRegistry';

export class RunLoopScene extends Scene {
	private readonly TICK_INTERVAL_MS = 1000;
	private accumulator = 0;

	constructor() {
		super('RunLoop');
	}

	create(): void {
		// This scene is a headless tick driver.
		this.cameras.main.setVisible(false);
	}

	override update(_time: number, delta: number): void {
		this.accumulator += delta;
		while (this.accumulator >= this.TICK_INTERVAL_MS) {
			this.accumulator -= this.TICK_INTERVAL_MS;
			getGameRun(this).advanceTick();
		}
	}
}
