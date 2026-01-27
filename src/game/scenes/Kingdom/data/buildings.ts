import type { Entity } from '../ecs/ECSBase';

export interface BaseBuildingDef {
	// Unique identifier for this building/upgrade.
	id: string;
	// If set, this building cannot be obtained directly; it is an upgrade of the parent building.
	parentId?: string;
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

export type BuildingDef = ProductionBuildingDef | BlockingBuildingDef;

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

export function getBuildingDef(id: string): BuildingDef | undefined {
	return BUILDINGS[id];
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

export function getPurchasableBuildings(): BuildingDef[] {
	return Object.values(BUILDINGS).filter(b => !b.parentId && b.type !== 'blocking');
}

export function getBlockingBuildings(): BuildingDef[] {
	return Object.values(BUILDINGS).filter(b => b.type === 'blocking');
}
