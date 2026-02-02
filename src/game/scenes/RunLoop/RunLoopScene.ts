import { Scene } from 'phaser';
import { getGameRun } from '../../run/runRegistry';
import { configuration } from '../../configuration';

export class RunLoopScene extends Scene {
	private readonly tickIntervalMs: number = configuration.loop.tickIntervalMs;
	private accumulator: number = 0;

	constructor() {
		super('RunLoop');
	}

	create(): void {
		// This scene is a headless tick driver.
		this.cameras.main.setVisible(false);
	}

	override update(_time: number, delta: number): void {
		this.accumulator += delta;
		while (this.accumulator >= this.tickIntervalMs) {
			this.accumulator -= this.tickIntervalMs;
			getGameRun(this).advanceTick();
		}
	}
}
