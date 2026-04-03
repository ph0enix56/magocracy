import type { KnownResourceMap, ResourceKey } from './resources';

export type AttackTargeting = 'first' | 'last' | 'weak' | 'all';

export type BuildingStatus = 'constructing' | 'active' | 'upgrading';

export type ResourceMap = Record<string, number>;

export type { ResourceKey, KnownResourceMap };

export type AttackAction = {
	damage: number;
	canUpgrade: boolean;
	range: number;
	targeting: AttackTargeting;
	actionPointCost: number;
};

export type BuildingKind = 'production' | 'army';
