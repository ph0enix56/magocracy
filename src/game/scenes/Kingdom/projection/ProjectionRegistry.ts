import type { Scene } from 'phaser';
import { ProjectionWorld } from './model';

const PROJECTION_WORLD_KEY = 'magocracy:projection-world';

export function ensureProjectionWorld(scene: Scene): ProjectionWorld {
	const existing = scene.registry.get(PROJECTION_WORLD_KEY) as ProjectionWorld | undefined;
	if (existing) return existing;

	const world = new ProjectionWorld();
	scene.registry.set(PROJECTION_WORLD_KEY, world);
	return world;
}

export function getProjectionWorld(scene: Scene): ProjectionWorld {
	const world = scene.registry.get(PROJECTION_WORLD_KEY) as ProjectionWorld | undefined;
	if (!world) throw new Error('Projection world not initialized. KingdomScene must create it first.');
	return world;
}