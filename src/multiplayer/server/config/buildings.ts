import type { BuildingDef, UnitDef } from './buildingTypes';
import { ALL_BUILDING_DEFS, UNIT_DEFS } from './buildingDefs/index';

// Re-export all types so callers only need to import from this file.
export type {
	BuildingDef,
	UnitDef,
	UnitAttackDef,
	UnitTrainDef,
	ProductionComponent,
	ArmyComponent,
	BuffComponent,
	BuildingCompleteContext,
} from './buildingTypes';

/**
 * The single hardcoded blocker def.
 * All blocker tiles share this id; visual variation is stored on the tile snapshot.
 * Removal always costs one `expansion` resource and takes a fixed number of ticks.
 */
export const BLOCKER_DEF: BuildingDef & { isBlocker: true } = {
	id: 'blocker',
	name: 'Obstacle',
	description: 'A natural obstacle blocking construction. Costs one expansion to remove.',
	textureId: 'blocker',
	assetPath: 'board_icons/token.png',
	cost: { expansion: 1 },
	buildTime: 15,
	isBlocker: true,
};

function loadAllBuildings(): Record<string, BuildingDef> {
	const out: Record<string, BuildingDef> = {};
	for (const def of [BLOCKER_DEF, ...ALL_BUILDING_DEFS]) {
		if (!def?.id) throw new Error(`Building def missing id`);
		if (out[def.id]) throw new Error(`Duplicate building id '${def.id}'`);
		out[def.id] = def;
	}
	return out;
}

function loadAllUnits(): Record<string, UnitDef> {
	const out: Record<string, UnitDef> = {};
	for (const u of UNIT_DEFS) {
		if (!u?.id) throw new Error(`Unit def missing id`);
		if (out[u.id]) throw new Error(`Duplicate unit id '${u.id}'`);
		out[u.id] = u;
	}
	return out;
}

const BUILDINGS: Record<string, BuildingDef> = loadAllBuildings();
const UNITS: Record<string, UnitDef> = loadAllUnits();

export function getBuildingDef(id: string): BuildingDef | undefined {
	return BUILDINGS[id];
}

export function getUnitDef(unitId: string): UnitDef | undefined {
	return UNITS[unitId];
}

/** Returns the next upgrade def for the given building id, if one exists. */
export function getNextUpgradeDef(currentBuildingId: string): BuildingDef | undefined {
	return Object.values(BUILDINGS).find(b => b.parentId === currentBuildingId);
}

export function getAllBuildingDefs(): BuildingDef[] {
	return Object.values(BUILDINGS);
}

export function getAllUnitDefs(): UnitDef[] {
	return Object.values(UNITS);
}

/** Returns all root (non-upgrade, non-blocker) buildings available for purchase. */
export function getPurchasableBuildings(): BuildingDef[] {
	return Object.values(BUILDINGS).filter(b => !b.parentId && !b.isBlocker);
}
