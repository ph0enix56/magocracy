import type { Scene } from 'phaser';
import { GameRun } from './GameRun';

const RUN_KEY = 'magocracy:run';

export function ensureGameRun(scene: Scene): GameRun {
	const existing = scene.registry.get(RUN_KEY) as GameRun | undefined;
	if (existing) return existing;

	const seed = Date.now() & 0xffffffff;
	const run = new GameRun(seed);
	scene.registry.set(RUN_KEY, run);
	return run;
}

export function getGameRun(scene: Scene): GameRun {
	const run = scene.registry.get(RUN_KEY) as GameRun | undefined;
	if (!run) throw new Error('GameRun not initialized. BootScene must run first.');
	return run;
}
