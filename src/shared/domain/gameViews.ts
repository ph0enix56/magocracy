import type { ResourceMap, TrainingStatus } from './types';

export type ArmyUnit = {
	entityId: string;
	unitDefId: string;
	name: string;
	assetPath: string;
	initiative: number;
	health: number;
	drFlat: number;
	drPercent: number;
	actionPoints: number;
	trainingLevel: number;
	trainingStatus: TrainingStatus;
	trainingProgress: number;
	nextTrainCost: ResourceMap;
	trainTime: number;
};

export type FightArmyUnitSummary = {
	unitDefId: string;
	name: string;
	trainingLevel: number;
};
