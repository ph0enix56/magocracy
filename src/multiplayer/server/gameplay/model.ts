import type { KingdomCoord } from '../../../shared/kingdom/kingdomGrid';
import type { AttackAction, BuildingStatus, ResourceMap, TrainingDelta, TrainingStatus } from '../../../shared/domain/types';

export type PositionComponent = KingdomCoord;

export interface BuildingComponent {
	buildingId: string;
	status: BuildingStatus;
	progress: number;
	upgradeNextId?: string;
	housedUnitEntityId?: string;
}

export type ArmyUnitAction = AttackAction;

export interface ArmyUnitTrainingState {
	status: TrainingStatus;
	progress: number;
}

export type ArmyUnitTrainDef = TrainingDelta;

export interface ArmyUnitTrainingConfig {
	costBase: ResourceMap;
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