export type AttackTargeting = 'first' | 'last' | 'weak' | 'all';

export type BuildingStatus = 'constructing' | 'active' | 'upgrading';

export type TrainingStatus = 'idle' | 'training';

export type ResourceMap = Record<string, number>;

export type AttackAction = {
	damage: number;
	canUpgrade: boolean;
	range: number;
	targeting: AttackTargeting;
	actionPointCost: number;
};

export type TrainingDelta = {
	health: number;
	attackDamage: number;
	drFlat: number;
};

export type BuildingKind = 'production' | 'army';
