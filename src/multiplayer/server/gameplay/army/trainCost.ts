import { accumulateEffectsForTargetStat } from '../effects/effectDsl';
import type { BuildingDef } from '../../config/buildings';
import type { ArmyUnitState, KingdomTileState } from '../model';
import type { ResourceMap } from '../../../../shared/domain/types';

export interface TrainCostContext {
	unitEntityId: string;
	findHousingByUnitId: (unitEntityId: string) => KingdomTileState | undefined;
	resolveBuildingDef: (buildingId: string) => BuildingDef | undefined;
	getNeighbors: (q: number, r: number) => KingdomTileState[];
}

export function getTrainCostEffectsForUnit(context: TrainCostContext): { add: number; mult: number } {
	const housing = context.findHousingByUnitId(context.unitEntityId);
	if (!housing?.building || housing.building.status !== 'active') {
		return { add: 0, mult: 0 };
	}

	const housingDef = context.resolveBuildingDef(housing.building.buildingId);
	if (!housingDef?.army) return { add: 0, mult: 0 };

	return accumulateEffectsForTargetStat({
		targetTile: housing,
		targetBuildingDef: housingDef,
		targetStat: 'army:traincost',
		resolveBuildingDef: context.resolveBuildingDef,
		getNeighbors: context.getNeighbors
	});
}

export function computeNextTrainCost(
	unit: Pick<ArmyUnitState, 'trainingLevel'>,
	baseCost: ResourceMap,
	costMult: number,
	effects: { add: number; mult: number }
): ResourceMap {
	const levelMult = Math.pow(costMult, unit.trainingLevel);
	const out: ResourceMap = {};
	for (const [resource, base] of Object.entries(baseCost)) {
		const scaled = Math.ceil(base * levelMult);
		const withAdd = scaled + effects.add;
		const withMult = withAdd * (1 + effects.mult);
		out[resource] = Math.max(0, Math.ceil(withMult));
	}
	return out;
}
