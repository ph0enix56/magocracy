import { getBuildingDef, getUnitDef } from '../../config/buildings';
import { accumulateEffectsForTargetStat } from '../effects/effectDsl';
import { getNeighborsFromWorld } from '../kingdom/neighborLookup';
import type { KingdomTileState } from '../model';
import type { WorldStore } from '../WorldStore';

type UnitEffectStat = 'unit:hp' | 'unit:drflat' | 'unit:drpercent' | 'unit:ap' | 'unit:initiative' | 'unit:damage';

export function recomputeHousedArmyUnit(world: WorldStore, housingEntityId: string): void {
	const housingTile = world.getKingdomTile(housingEntityId);
	if (!housingTile?.building) return;
	const housedUnitId = housingTile.building.housedUnitId;
	if (!housedUnitId) return;

	const housedUnit = world.getArmyUnit(housedUnitId);
	if (!housedUnit) return;

	const buildingDef = getBuildingDef(housingTile.building.buildingId);
	if (!buildingDef?.housedUnitDefId) return;
	const unitDef = getUnitDef(buildingDef.housedUnitDefId);
	if (!unitDef) return;

	const baseHp = applyIntStatEffects(world, housingTile, buildingDef, 'unit:hp', unitDef.health);
	const baseDrFlat = applyIntStatEffects(world, housingTile, buildingDef, 'unit:drflat', unitDef.drFlat);
	const baseDrPercent = applyIntStatEffects(world, housingTile, buildingDef, 'unit:drpercent', unitDef.drPercent);
	const baseActionPoints = applyIntStatEffects(world, housingTile, buildingDef, 'unit:ap', unitDef.actionPoints);
	const baseInitiative = applyIntStatEffects(world, housingTile, buildingDef, 'unit:initiative', unitDef.initiative);

	const damageEffects = accumulateEffectsForTargetStat({
		targetTile: housingTile,
		targetBuildingDef: buildingDef,
		targetStat: 'unit:damage',
		resolveBuildingDef: getBuildingDef,
		getNeighbors: (q, r) => getNeighborsFromWorld(world, q, r)
	});

	housedUnit.unitDefId = unitDef.id;
	housedUnit.initiative = baseInitiative;
	housedUnit.health = Math.max(0, baseHp);
	housedUnit.drFlat = Math.max(0, baseDrFlat);
	housedUnit.drPercent = Math.max(0, baseDrPercent);
	housedUnit.actionPoints = Math.max(0, baseActionPoints);
	housedUnit.bonusDamage = damageEffects.add;
	housedUnit.damageMultiplier = damageEffects.mult;
}

export function getHousingBuildingForUnit(world: WorldStore, unitEntityId: string): KingdomTileState | undefined {
	for (const tile of world.getKingdomTilesWithBuildings()) {
		if (tile.building?.housedUnitId === unitEntityId) return tile;
	}
	return undefined;
}

export function recomputeAllHousedArmyUnits(world: WorldStore): void {
	for (const tile of world.getKingdomTilesWithBuildings()) {
		if (tile.building?.status !== 'active') continue;
		if (!tile.building.housedUnitId) continue;
		recomputeHousedArmyUnit(world, tile.tileId);
	}
}

function applyIntStatEffects(
	world: WorldStore,
	targetTile: KingdomTileState,
	targetBuildingDef: NonNullable<ReturnType<typeof getBuildingDef>>,
	stat: UnitEffectStat,
	baseValue: number
): number {
	const effects = accumulateEffectsForTargetStat({
		targetTile,
		targetBuildingDef,
		targetStat: stat,
		resolveBuildingDef: getBuildingDef,
		getNeighbors: (q, r) => getNeighborsFromWorld(world, q, r)
	});
	return Math.max(0, Math.floor((baseValue + effects.add) * (1 + effects.mult)));
}
