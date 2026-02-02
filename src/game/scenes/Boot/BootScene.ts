import { Scene } from 'phaser';
import { ensureGameRun } from '../../run/runRegistry';

export class BootScene extends Scene {
	constructor() {
		super('Boot');
	}

	create(): void {
		ensureGameRun(this);
		this.scene.launch('RunLoop');
		this.scene.start('Kingdom');
	}
}
