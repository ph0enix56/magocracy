export interface PositionComponent {
	q: number;
	r: number;
}

export interface BuildingComponent {
	buildingId: string;
	status: 'constructing' | 'active' | 'upgrading';
	progress: number;
	upgradeNextId?: string;
	housedUnitEntityId?: string;
}

export interface ArmyUnitAction {
	damage: number;
	canUpgrade: boolean;
	range: number;
	targeting: 'first' | 'last' | 'weak' | 'all';
	actionPointCost: number;
}

export interface ArmyUnitTrainingState {
	status: 'idle' | 'training';
	progress: number;
}

export interface ArmyUnitTrainDef {
	health: number;
	attackDamage: number;
	drFlat: number;
}

export interface ArmyUnitTrainingConfig {
	costBase: Record<string, number>;
	costMult: number;
	time: number;
	def: ArmyUnitTrainDef;
}

export interface ArmyUnitComponent {
	unitId: string;
	name: string;
	textureId: string;
	assetPath: string;
	speed: number;
	health: number;
	drFlat: number;
	drPercent: number;
	actionsPerTurn: number;
	actions: ArmyUnitAction[];
	trainingLevel: number;
	training: ArmyUnitTrainingConfig & ArmyUnitTrainingState;
}

export interface Entity {
	id: string;
	position?: PositionComponent;
	building?: BuildingComponent;
	armyUnit?: ArmyUnitComponent;
}

export interface System {
	update(delta: number, time: number): void;
	advanceTick(): void;
}