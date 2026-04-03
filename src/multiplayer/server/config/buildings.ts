import { BUILDING_SCHOOLS, type BuildingDef, type UnitDef } from './buildingTypes';
import BUILDING_DEFS_JSON from './buildingDefs/buildings.json';
import UNIT_DEFS_JSON from './buildingDefs/units.json';
import type { ResourceMap } from '../../../shared/domain/types';

// Re-export all types so callers only need to import from this file.
export type {
	BuildingDef,
	UnitDef,
	BuildingSchool,
	EffectTarget,
	EffectApply,
	EffectStat,
	ProductionComponent,
	ArmyComponent,
	BUILDING_SCHOOLS
} from './buildingTypes';

const VALID_TARGETING = new Set<UnitDef['actions'][number]['targeting']>(['first', 'last', 'weak', 'all']);
const VALID_SCHOOLS = new Set(Object.keys(BUILDING_SCHOOLS));

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, path: string): string {
	if (typeof value !== 'string' || value.length === 0) {
		throw new Error(`${path} must be a non-empty string`);
	}
	return value;
}

function asNumber(value: unknown, path: string): number {
	if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
		throw new Error(`${path} must be a finite number`);
	}
	return value;
}

function asBoolean(value: unknown, path: string): boolean {
	if (typeof value !== 'boolean') {
		throw new Error(`${path} must be a boolean`);
	}
	return value;
}

function asStringArray(value: unknown, path: string): string[] {
	if (!Array.isArray(value)) {
		throw new Error(`${path} must be an array of strings`);
	}
	return value.map((entry, index) => asString(entry, `${path}[${index}]`));
}

function asNumberRecord(value: unknown, path: string): ResourceMap {
	if (!isObject(value)) {
		throw new Error(`${path} must be an object`);
	}
	const out: ResourceMap = {};
	for (const [key, raw] of Object.entries(value)) {
		if (key.length === 0) throw new Error(`${path} contains an empty key`);
		out[key] = asNumber(raw, `${path}.${key}`);
	}
	return out;
}

function parseUnitDef(raw: unknown, index: number): UnitDef {
	const path = `units[${index}]`;
	if (!isObject(raw)) throw new Error(`${path} must be an object`);

	const rawActions = raw['actions'];
	if (!Array.isArray(rawActions) || rawActions.length === 0) {
		throw new Error(`${path}.actions must be a non-empty array`);
	}

	const actions = rawActions.map((action, actionIndex) => {
		const actionPath = `${path}.actions[${actionIndex}]`;
		if (!isObject(action)) throw new Error(`${actionPath} must be an object`);

		const targetingRaw = asString(action['targeting'], `${actionPath}.targeting`);
		if (!VALID_TARGETING.has(targetingRaw as UnitDef['actions'][number]['targeting'])) {
			throw new Error(`${actionPath}.targeting must be one of: first, last, weak, all`);
		}
		const targeting = targetingRaw as UnitDef['actions'][number]['targeting'];

		return {
			damage: asNumber(action['damage'], `${actionPath}.damage`),
			canUpgrade: asBoolean(action['canUpgrade'], `${actionPath}.canUpgrade`),
			range: asNumber(action['range'], `${actionPath}.range`),
			targeting,
			actionPointCost: asNumber(action['actionPointCost'], `${actionPath}.actionPointCost`)
		};
	});

	return {
		id: asString(raw['id'], `${path}.id`),
		name: asString(raw['name'], `${path}.name`),
		health: asNumber(raw['health'], `${path}.health`),
		drFlat: asNumber(raw['drFlat'], `${path}.drFlat`),
		drPercent: asNumber(raw['drPercent'], `${path}.drPercent`),
		actions,
		actionPoints: asNumber(raw['actionPoints'], `${path}.actionPoints`),
		initiative: asNumber(raw['initiative'], `${path}.initiative`),
		textureId: asString(raw['textureId'], `${path}.textureId`),
		assetPath: asString(raw['assetPath'], `${path}.assetPath`)
	};
}

function parseBuildingDef(raw: unknown, index: number): BuildingDef {
	const path = `buildings[${index}]`;
	if (!isObject(raw)) throw new Error(`${path} must be an object`);

	const school = asString(raw['school'], `${path}.school`);
	if (!VALID_SCHOOLS.has(school)) {
		throw new Error(`${path}.school must be one of: ${Object.keys(BUILDING_SCHOOLS).join(', ')}`);
	}

	const productionRaw = raw['production'];
	let production: BuildingDef['production'];
	if (productionRaw !== undefined) {
		if (!isObject(productionRaw)) throw new Error(`${path}.production must be an object`);
		production = { productions: asNumberRecord(productionRaw['productions'], `${path}.production.productions`) };
	}

	const armyRaw = raw['army'];
	let army: BuildingDef['army'];
	if (armyRaw !== undefined) {
		if (!isObject(armyRaw)) throw new Error(`${path}.army must be an object`);
		const trainDefRaw = armyRaw['trainDef'];
		if (!isObject(trainDefRaw)) throw new Error(`${path}.army.trainDef must be an object`);
		army = {
			unitDefId: asString(armyRaw['unitDefId'], `${path}.army.unitDefId`),
			trainCostBase: asNumberRecord(armyRaw['trainCostBase'], `${path}.army.trainCostBase`),
			trainCostMult: asNumber(armyRaw['trainCostMult'], `${path}.army.trainCostMult`),
			trainTime: asNumber(armyRaw['trainTime'], `${path}.army.trainTime`),
			trainDef: {
				health: asNumber(trainDefRaw['health'], `${path}.army.trainDef.health`),
				attackDamage: asNumber(trainDefRaw['attackDamage'], `${path}.army.trainDef.attackDamage`),
				drFlat: asNumber(trainDefRaw['drFlat'], `${path}.army.trainDef.drFlat`)
			}
		};
	}

	const parentIdRaw = raw['parentId'];

	return {
		id: asString(raw['id'], `${path}.id`),
		school: school as BuildingDef['school'],
		tier: asNumber(raw['tier'], `${path}.tier`),
		parentId: parentIdRaw === undefined ? undefined : asString(parentIdRaw, `${path}.parentId`),
		name: asString(raw['name'], `${path}.name`),
		description: asString(raw['description'], `${path}.description`),
		textureId: asString(raw['textureId'], `${path}.textureId`),
		assetPath: asString(raw['assetPath'], `${path}.assetPath`),
		cost: asNumberRecord(raw['cost'], `${path}.cost`),
		buildTime: asNumber(raw['buildTime'], `${path}.buildTime`),
		production,
		army,
		effects: raw['effects'] === undefined ? undefined : asStringArray(raw['effects'], `${path}.effects`),
		onCompleteGrants: raw['onCompleteGrants'] === undefined ? undefined : asNumberRecord(raw['onCompleteGrants'], `${path}.onCompleteGrants`)
	};
}

function parseUnitDefs(raw: unknown): UnitDef[] {
	if (!Array.isArray(raw)) throw new Error('units.json must contain an array');
	return raw.map((entry, index) => parseUnitDef(entry, index));
}

function parseBuildingDefs(raw: unknown): BuildingDef[] {
	if (!Array.isArray(raw)) throw new Error('buildings.json must contain an array');
	return raw.map((entry, index) => parseBuildingDef(entry, index));
}

const ALL_BUILDING_DEFS: BuildingDef[] = parseBuildingDefs(BUILDING_DEFS_JSON);
const UNIT_DEFS: UnitDef[] = parseUnitDefs(UNIT_DEFS_JSON);

function loadAllBuildings(): Record<string, BuildingDef> {
	const out: Record<string, BuildingDef> = {};
	for (const def of ALL_BUILDING_DEFS) {
		if (!def?.id) throw new Error(`Building def missing id`);
		if (out[def.id]) throw new Error(`Duplicate building id '${def.id}'`);
		out[def.id] = def;
	}
	for (const def of Object.values(out)) {
		if (def.parentId && !out[def.parentId]) {
			throw new Error(`Building '${def.id}' references unknown parentId '${def.parentId}'`);
		}
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

for (const building of Object.values(BUILDINGS)) {
	if (building.army && !UNITS[building.army.unitDefId]) {
		throw new Error(`Building '${building.id}' references unknown unitDefId '${building.army.unitDefId}'`);
	}
}

export function getBuildingDef(id: string): BuildingDef | undefined {
	return BUILDINGS[id];
}

export function getUnitDef(unitDefId: string): UnitDef | undefined {
	return UNITS[unitDefId];
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

/** Returns all root buildings available for purchase. */
export function getPurchasableBuildings(): BuildingDef[] {
	return Object.values(BUILDINGS).filter(b => !b.parentId);
}
