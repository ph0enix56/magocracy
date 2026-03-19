import type { Entity } from '../model';
import type { ServerEcsWorld } from '../ServerEcsWorld';

const DOUBLED_DIRECTIONS = [
	{ dq: 1, dr: 1 },
	{ dq: 2, dr: 0 },
	{ dq: 1, dr: -1 },
	{ dq: -1, dr: -1 },
	{ dq: -2, dr: 0 },
	{ dq: -1, dr: 1 }
] as const;

export function getNeighborsFromPositionedEntities(positionedEntities: Entity[], q: number, r: number): Entity[] {
	return DOUBLED_DIRECTIONS
		.map(({ dq, dr }) => positionedEntities.find((entity) => entity.position?.q === q + dq && entity.position?.r === r + dr))
		.filter((entity): entity is Entity => !!entity);
}

export function getNeighborsFromWorld(world: ServerEcsWorld, q: number, r: number): Entity[] {
	return getNeighborsFromPositionedEntities(world.getEntitiesWith(['position']), q, r);
}
