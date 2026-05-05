import type { KingdomCoord } from '../../shared/kingdom/kingdomGrid';
import type { BuildingStatus } from '../../shared/domain/types';

export interface BuildingState {
	buildingId: string;
	status: BuildingStatus;
	progress: number;
	upgradeNextId?: string;
	housedUnitId?: string;
}

export interface ArmyUnitState {
	armyUnitId: string;
	unitDefId: string;
	initiative: number;
	health: number;
	drFlat: number;
	drPercent: number;
	actionPoints: number;
}

export interface KingdomTileState {
	tileId: string;
	coord: KingdomCoord;
	isExpansionSite?: true;
	building?: BuildingState;
}