import type { Entity } from '../ecs/components';

export interface BaseBuildingDef {
	id: string;
	// If set, this building is an upgrade of `parentId`.
	// This keeps upgrades flexible by letting them be full building defs.
	parentId?: string;
	// Whether this building can be purchased as a blueprint in the shop.
	// This is derived automatically (true when no parentId).
	purchasable: boolean;
	// Optional ordering for multiple upgrades of the same parent.
	upgradeLevel?: number;
	name: string;
	description: string;
	textureId: string; // Phaser texture key
	assetPath: string; // Path relative to public/assets/
	cost: Record<string, number>;
	buildTime: number; // in seconds
	// Returns an additive modifier to the target's production multiplier (e.g. 0.1 for +10%)
	getOutgoingProdModifier?: (self: Entity, target: Entity) => number;
}

export interface ProductionBuildingDef extends BaseBuildingDef {
	type: 'production';
	productions: Record<string, number>;
	// Returns an additive modifier to self production multiplier based on neighbors
	getSelfProdModifier?: (self: Entity, neighbors: Entity[]) => number;
}

export type BuildingDef = ProductionBuildingDef; // Add more types later

// Authoring type for building definition modules.
// Modules should export `BUILDING_DEFS: RawBuildingDef[]` (recommended) or a default array.
export type RawBuildingDef = Omit<BuildingDef, 'purchasable'>;

type BuildingDefsModule = { BUILDING_DEFS?: RawBuildingDef[]; default?: RawBuildingDef[] };

const buildingDefModules = import.meta.glob('./buildingDefs/*.ts', { eager: true }) as Record<string, BuildingDefsModule>;

function loadRawBuildings(): Record<string, RawBuildingDef> {
	const rawBuildings: Record<string, RawBuildingDef> = {};

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

const RAW_BUILDINGS = loadRawBuildings();

export const BUILDINGS: Record<string, BuildingDef> = Object.fromEntries(
	Object.entries(RAW_BUILDINGS).map(([id, def]) => [
		id,
		{
			...def,
			purchasable: !def.parentId
		}
	])
) as Record<string, BuildingDef>;

export function getBuildingDef(id: string): BuildingDef | undefined {
	return BUILDINGS[id];
}

export function getBuildableBuildings(): BuildingDef[] {
	return Object.values(BUILDINGS).filter(b => !b.parentId);
}

export function getPurchasableBuildings(): BuildingDef[] {
	return Object.values(BUILDINGS).filter(b => b.purchasable);
}

export function getNextUpgradeDef(currentBuildingId: string): BuildingDef | undefined {
	const candidates = Object.values(BUILDINGS).filter(b => b.parentId === currentBuildingId);
	if (candidates.length === 0) return undefined;
	// Prefer explicit ordering; otherwise keep deterministic by id.
	return candidates
		.slice()
		.sort((a, b) => (a.upgradeLevel ?? Number.MAX_SAFE_INTEGER) - (b.upgradeLevel ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id))[0];
}
