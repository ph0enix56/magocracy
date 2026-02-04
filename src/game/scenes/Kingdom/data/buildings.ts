import type { ECSManager, Entity } from '../ecs/ECSBase';

export type BuildingCompleteContext = {
	world: ECSManager;
	entity: Entity;
	buildingId: string;
	previousStatus: 'constructing' | 'upgrading';
};

export interface BaseBuildingDef {
	// Unique identifier for this building/upgrade.
	id: string;
	// If set, this building cannot be obtained directly; it is an upgrade of the parent building.
	parentId?: string;
	// Building type, set in the sub-interfaces.
	type: string;
	// In-game display name.
	name: string;
	// In-game building card description.
	description: string;
	// Phaser texture key (can be the same as id)
	textureId: string;
	// Path relative to public/assets/ for the building icon, loaded into Phaser under textureId
	assetPath: string;
	// Resource cost to build/upgrade into this. For blockers, this is the cost to remove instead.
	cost: Record<string, number>;
	// Time required to build/upgrade this building, in game ticks. For blockers, this is the time to remove instead.
	buildTime: number;
	// An additive bonus to the target's production multiplier (e.g. 0.1 for +10%).
	// TODO: for now evaluted only on neighboring production buildings; could be extended later.
	getOutgoingProdModifier?: (self: Entity, neighbors: Entity) => number;
	// Optional hook executed when this building finishes construction or upgrade.
	onComplete?: (ctx: BuildingCompleteContext) => void;
}

// Buildings that produce resources over time.
export interface ProductionBuildingDef extends BaseBuildingDef {
	type: 'production';
	// Resource productions per game tick.
	productions: Record<string, number>;
	// Returns an additive bonus to self production multiplier.
	// TODO: for now evaluted only on neighbors; could be extended later.
	getSelfProdModifier?: (self: Entity, neighbors: Entity[]) => number;
}

// Pre-placed pseudo-buildings that block placement of other buildings until removed.
export interface BlockingBuildingDef extends BaseBuildingDef {
	type: 'blocking';
}

export interface ArmyBuildingDef extends BaseBuildingDef {
	type: 'army';
	unit: UnitDef;
	trainCostBase: Record<string, number>;
	trainCostMult: number;
	trainTime: number;
	trainDef: UnitTrainDef;
}

export interface UnitDef {
	// Unique identifier for this unit.
	id: string;
	// In-game display name.
	name: string;
	// Health points (damage capacity) before being defeated.
	health: number;
	// Flat damage reduction applied to each incoming attack.
	drFlat: number;
	// Percentual damage reduction applied to each incoming attack.
	drPercent: number;
	// Action queue/cycle of this unit.
	actions: UnitAttackDef[];
	// Actions taken per turn in combat.
	actionsPerTurn: number;
	// Travel speed on the world map.
	speed: number;
	// Phaser texture key (can be the same as id)
	textureId: string;
	// Path relative to public/assets/ for the unit icon, loaded into Phaser under textureId
	assetPath: string;
}

export interface UnitTrainDef {
	health: number;
	attackDamage: number;
	drFlat: number;
}

export interface UnitAttackDef {
	// Attack damage dealt to target(s).
	damage: number;
	// Whether this attack's damage can be upgraded.
	canUpgrade: boolean;
	// How many units across can be targeted by this attack.
	range: number;
	// Targeting logic among possible targets.
	targeting: 'first' | 'last' | 'weak' | 'all';
	// Action point cost to perform this attack (for multiple attacks or one per x turns).
	actionPointCost: number;
}

export type BuildingDef = ProductionBuildingDef | BlockingBuildingDef | ArmyBuildingDef;

type BuildingDefsModule = { BUILDING_DEFS?: BuildingDef[]; default?: BuildingDef[] };

const buildingDefModules = import.meta.glob('./buildingDefs/*.ts', { eager: true }) as Record<string, BuildingDefsModule>;

function loadAllBuildings(): Record<string, BuildingDef> {
	const rawBuildings: Record<string, BuildingDef> = {};

	for (const [modulePath, mod] of Object.entries(buildingDefModules)) {
		const defs = mod.BUILDING_DEFS ?? mod.default;
		if (!Array.isArray(defs)) {
			throw new Error(`Invalid building def module ${modulePath}: export BUILDING_DEFS (array) or default array`);
		}
		for (const def of defs) {
			if (!def?.id) {
				throw new Error(`Invalid building def in ${modulePath}: missing id`);
			}
			if (rawBuildings[def.id]) {
				throw new Error(`Duplicate building id '${def.id}' (from ${modulePath})`);
			}
			rawBuildings[def.id] = def;
		}
	}

	return rawBuildings;
}

const BUILDINGS: Record<string, BuildingDef> = loadAllBuildings();

function loadAllUnits(): Record<string, UnitDef> {
	const units: Record<string, UnitDef> = {};
	for (const b of Object.values(BUILDINGS)) {
		if (b.type !== 'army') continue;
		const u = b.unit;
		if (!u?.id) continue;
		if (units[u.id]) {
			throw new Error(`Duplicate unit id '${u.id}' (from building '${b.id}')`);
		}
		units[u.id] = u;
	}
	return units;
}

const UNITS: Record<string, UnitDef> = loadAllUnits();

export function getBuildingDef(id: string): BuildingDef | undefined {
	return BUILDINGS[id];
}

export function getUnitDef(unitId: string): UnitDef | undefined {
	return UNITS[unitId];
}

// currently, only one upgrade per building is defined
export function getNextUpgradeDef(currentBuildingId: string): BuildingDef | undefined {
	const candidates = Object.values(BUILDINGS).filter(b => b.parentId === currentBuildingId);
	if (candidates.length === 0) return undefined;
	return candidates[0];
}

export function getAllBuildingDefs(): BuildingDef[] {
	return Object.values(BUILDINGS);
}

export function getAllUnitDefs(): UnitDef[] {
	return Object.values(UNITS);
}

export function getPurchasableBuildings(): BuildingDef[] {
	return Object.values(BUILDINGS).filter(b => !b.parentId && b.type !== 'blocking');
}

export function getBlockingBuildings(): BuildingDef[] {
	return Object.values(BUILDINGS).filter(b => b.type === 'blocking');
}
