import type { KnownResourceMap, ResourceKey } from './resources';

export const BuildingSchool = {
	founding: 'founding',
	sylvan: 'sylvan',
	geomancy: 'geomancy',
	pyromancy: 'pyromancy',
	necromancy: 'necromancy',
	artifact: 'artifact'
} as const;
export type BuildingSchool = (typeof BuildingSchool)[keyof typeof BuildingSchool];

export type BuildingStatus = 'constructing' | 'active' | 'upgrading';

export const AttackTargeting = {
	first: 'first',
	last: 'last',
	weak: 'weak',
	all: 'all'
} as const;
export type AttackTargeting = (typeof AttackTargeting)[keyof typeof AttackTargeting];

export const UnitRole = {
	tank: 'Tank',
	fighter: 'Fighter',
	shredder: 'Shredder',
	assassin: 'Assassin',
	areaCaster: 'Area Caster'
} as const;
export type UnitRole = (typeof UnitRole)[keyof typeof UnitRole];

export type ResourceMap = Record<string, number>;

export type { ResourceKey, KnownResourceMap };

export type AttackAction = {
	name: string;
	damage: number;
	range: number;
	targeting: AttackTargeting;
	actionPointCost: number;
};

export type BuildingKind = 'production' | 'army';
