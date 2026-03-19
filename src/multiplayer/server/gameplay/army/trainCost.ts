import { accumulateEffectsForTargetStat } from '../effects/effectDsl';
import type { BuildingDef } from '../../config/buildings';
import type { ArmyUnitComponent, Entity } from '../model';

export interface TrainCostContext {
	unitEntityId: string;
	findHousingByUnitId: (unitEntityId: string) => Entity | undefined;
	resolveBuildingDef: (buildingId: string) => BuildingDef | undefined;
	getNeighbors: (q: number, r: number) => Entity[];
}

export function getTrainCostEffectsForUnit(context: TrainCostContext): { add: number; mult: number } {
	const housing = context.findHousingByUnitId(context.unitEntityId);
	if (!housing?.building || housing.building.status !== 'active' || !housing.position) {
		return { add: 0, mult: 0 };
	}

	const housingDef = context.resolveBuildingDef(housing.building.buildingId);
	if (!housingDef?.army) return { add: 0, mult: 0 };

	return accumulateEffectsForTargetStat({
		targetEntity: housing,
		targetBuildingDef: housingDef,
		targetStat: 'army:traincost',
		resolveBuildingDef: context.resolveBuildingDef,
		getNeighbors: context.getNeighbors
	});
}

export function computeNextTrainCost(
	unit: Pick<ArmyUnitComponent, 'training' | 'trainingLevel'>,
	effects: { add: number; mult: number }
): Record<string, number> {
	const levelMult = Math.pow(unit.training.costMult, unit.trainingLevel);
	const out: Record<string, number> = {};
	for (const [resource, base] of Object.entries(unit.training.costBase)) {
		const scaled = Math.ceil(base * levelMult);
		const withAdd = scaled + effects.add;
		const withMult = withAdd * (1 + effects.mult);
		out[resource] = Math.max(0, Math.ceil(withMult));
	}
	return out;
}
