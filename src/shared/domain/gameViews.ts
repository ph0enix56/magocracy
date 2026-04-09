import type { AttackAction, UnitRole } from './types';

export type ArmyUnit = {
	entityId: string;
	unitDefId: string;
	name: string;
	role: UnitRole;
	assetPath: string;
	initiative: number;
	health: number;
	drFlat: number;
	drPercent: number;
	actionPoints: number;
	actions: AttackAction[];
};

export type FightArmyUnitSummary = {
	unitDefId: string;
	name: string;
};
