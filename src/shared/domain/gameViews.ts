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
};

export type FightArmyUnitSummary = {
	unitDefId: string;
	name: string;
};
