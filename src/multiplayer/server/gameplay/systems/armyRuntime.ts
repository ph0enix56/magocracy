import { getBuildingDef, getUnitDef } from '../../config/buildings';
import { accumulateEffectsForTargetStat } from '../effects/effectDsl';
import { getNeighborsFromWorld } from '../kingdom/neighborLookup';
import type { Entity } from '../model';
import type { ServerEcsWorld } from '../ServerEcsWorld';

type UnitEffectStat = 'unit:hp' | 'unit:drflat' | 'unit:drpercent' | 'unit:ap' | 'unit:initiative' | 'unit:damage';

export function recomputeHousedArmyUnit(world: ServerEcsWorld, housingEntityId: string): void {
	const housingEntity = world.getEntity(housingEntityId);
	if (!housingEntity?.building || !housingEntity.position) return;
	const housedUnitEntityId = housingEntity.building.housedUnitEntityId;
	if (!housedUnitEntityId) return;

	const unitEntity = world.getEntity(housedUnitEntityId);
	if (!unitEntity?.armyUnit) return;

	const buildingDef = getBuildingDef(housingEntity.building.buildingId);
	if (!buildingDef?.army) return;
	const unitDef = getUnitDef(buildingDef.army.unitId);
	if (!unitDef) return;

	const trainingLevel = Math.max(0, Math.floor(unitEntity.armyUnit.trainingLevel));
	const trainingDef = unitEntity.armyUnit.training.def;

	const baseHp = applyIntStatEffects(world, housingEntity, buildingDef, 'unit:hp', unitDef.health);
	const baseDrFlat = applyIntStatEffects(world, housingEntity, buildingDef, 'unit:drflat', unitDef.drFlat);
	const baseDrPercent = applyIntStatEffects(world, housingEntity, buildingDef, 'unit:drpercent', unitDef.drPercent);
	const baseAp = applyIntStatEffects(world, housingEntity, buildingDef, 'unit:ap', unitDef.actionsPerTurn);
	const baseInitiative = applyIntStatEffects(world, housingEntity, buildingDef, 'unit:initiative', unitDef.speed);

	const actions = unitDef.actions.map((action) => ({
		...action,
		damage: applyIntStatEffects(world, housingEntity, buildingDef, 'unit:damage', action.damage)
	}));

	unitEntity.armyUnit.unitId = unitDef.id;
	unitEntity.armyUnit.name = unitDef.name;
	unitEntity.armyUnit.textureId = unitDef.textureId;
	unitEntity.armyUnit.assetPath = unitDef.assetPath;
	unitEntity.armyUnit.speed = baseInitiative;
	unitEntity.armyUnit.health = Math.max(0, baseHp + trainingLevel * trainingDef.health);
	unitEntity.armyUnit.drFlat = Math.max(0, baseDrFlat + trainingLevel * trainingDef.drFlat);
	unitEntity.armyUnit.drPercent = Math.max(0, baseDrPercent);
	unitEntity.armyUnit.actionsPerTurn = Math.max(0, baseAp);
	unitEntity.armyUnit.actions = actions;
}

export function getHousingBuildingForUnit(world: ServerEcsWorld, unitEntityId: string): Entity | undefined {
	for (const entity of world.getEntitiesWith(['building'])) {
		if (entity.building?.housedUnitEntityId === unitEntityId) return entity;
	}
	return undefined;
}

export function recomputeAllHousedArmyUnits(world: ServerEcsWorld): void {
	for (const entity of world.getEntitiesWith(['building'])) {
		if (entity.building?.status !== 'active') continue;
		if (!entity.building.housedUnitEntityId) continue;
		recomputeHousedArmyUnit(world, entity.id);
	}
}

function applyIntStatEffects(
	world: ServerEcsWorld,
	targetEntity: Entity,
	targetBuildingDef: NonNullable<ReturnType<typeof getBuildingDef>>,
	stat: UnitEffectStat,
	baseValue: number
): number {
	const effects = accumulateEffectsForTargetStat({
		targetEntity,
		targetBuildingDef,
		targetStat: stat,
		resolveBuildingDef: getBuildingDef,
		getNeighbors: (q, r) => getNeighborsFromWorld(world, q, r)
	});
	return Math.max(0, Math.floor((baseValue + effects.add) * (1 + effects.mult)));
}
