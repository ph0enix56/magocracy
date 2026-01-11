import type { Entity } from '../ecs/components';

export interface BaseBuildingDef {
	id: string;
	// If set, this building is an upgrade of `parentId`.
	// This keeps upgrades flexible by letting them be full building defs.
	parentId?: string;
	// Optional ordering for multiple upgrades of the same parent.
	upgradeLevel?: number;
	name: string;
	description: string;
	textureId: string; // Phaser texture key
	assetPath: string; // Path relative to public/assets/
	cost: Record<string, number>;
	buildTime: number; // in seconds
	// Returns an additive modifier to the target's production multiplier (e.g. 0.1 for +10%)
	getNeighborModifier?: (self: Entity, target: Entity) => number;
}

export interface ProductionBuildingDef extends BaseBuildingDef {
	type: 'production';
	productions: Record<string, number>;
	// Returns an additive modifier to self production multiplier based on neighbors
	calculateSelfModifier?: (self: Entity, neighbors: Entity[]) => number;
}

export type BuildingDef = ProductionBuildingDef; // Add more types later

export const BUILDINGS: Record<string, BuildingDef> = {
	'mine': {
		id: 'mine',
		type: 'production',
		name: 'Stone Mine',
		description: 'Extracts stone from the earth.',
		textureId: 'building_mine',
		assetPath: 'game_icons/stone-crafting.png',
		cost: { 'wood': 35 },
		buildTime: 5,
		productions: { stone: 5 },
		calculateSelfModifier: (_self: Entity, _neighbors: Entity[]) => {
			return 0;
		}
	},
	'mine_2': {
		id: 'mine_2',
		parentId: 'mine',
		upgradeLevel: 2,
		type: 'production',
		name: 'Stone Mine II',
		description: 'Upgraded mine with better tools and throughput.',
		textureId: 'building_mine',
		assetPath: 'game_icons/stone-crafting.png',
		cost: { 'wood': 60, 'stone': 30 },
		buildTime: 8,
		productions: { stone: 8 },
		calculateSelfModifier: (_self: Entity, _neighbors: Entity[]) => 0
	},
	'mine_3': {
		id: 'mine_3',
		parentId: 'mine_2',
		upgradeLevel: 3,
		type: 'production',
		name: 'Stone Mine III',
		description: 'Deep shafts and reinforced supports.',
		textureId: 'building_mine',
		assetPath: 'game_icons/stone-crafting.png',
		cost: { 'wood': 90, 'stone': 70 },
		buildTime: 12,
		productions: { stone: 12 },
		calculateSelfModifier: (_self: Entity, _neighbors: Entity[]) => 0
	},
	'lumber_camp': {
		id: 'lumber_camp',
		type: 'production',
		name: 'Lumber Camp',
		description: 'Cuts wood. Lumber Camps near each other work more efficiently.',
		textureId: 'building_lumber_camp',
		assetPath: 'game_icons/axe-in-stump.png',
		cost: { 'stone': 60 },
		buildTime: 10,
		productions: { wood: 10 },
		calculateSelfModifier: (_self: Entity, neighbors: Entity[]) => {
			let bonus = 0;
			for (const n of neighbors) {
				if (n.building?.status === 'active' && n.building.buildingId === 'lumber_camp') {
					bonus += 0.1;
				}
			}
			return bonus;
		}
	},
	'lumber_camp_2': {
		id: 'lumber_camp_2',
		parentId: 'lumber_camp',
		upgradeLevel: 2,
		type: 'production',
		name: 'Lumber Camp II',
		description: 'Sharper saws and better logistics.',
		textureId: 'building_lumber_camp',
		assetPath: 'game_icons/axe-in-stump.png',
		cost: { 'stone': 80, 'wood': 30 },
		buildTime: 12,
		productions: { wood: 14 },
		calculateSelfModifier: (_self: Entity, neighbors: Entity[]) => {
			let bonus = 0;
			for (const n of neighbors) {
				if (n.building?.status === 'active' && (n.building.buildingId === 'lumber_camp' || n.building.buildingId === 'lumber_camp_2')) {
					bonus += 0.1;
				}
			}
			return bonus;
		}
	},
	'farm': {
		id: 'farm',
		type: 'production',
		name: 'Farm',
		description: 'Produces food. Farms work faster the more empty tiles are surrounding them.',
		textureId: 'building_farm',
		assetPath: 'game_icons/windmill.png',
		cost: { 'wood': 40, 'stone': 40 },
		buildTime: 15,
		productions: { food: 15 },
		calculateSelfModifier: (_self: Entity, neighbors: Entity[]) => {
			let emptyCount = 0;
			for (const n of neighbors) {
				if (!n.building) {
					emptyCount++;
				}
			}
			return emptyCount * 0.05; // +5% per empty neighbor
		}
	},
	'farm_2': {
		id: 'farm_2',
		parentId: 'farm',
		upgradeLevel: 2,
		type: 'production',
		name: 'Farm II',
		description: 'Crop rotation and irrigation improve yields.',
		textureId: 'building_farm',
		assetPath: 'game_icons/windmill.png',
		cost: { 'wood': 60, 'stone': 60, 'food': 50 },
		buildTime: 18,
		productions: { food: 22 },
		calculateSelfModifier: (_self: Entity, neighbors: Entity[]) => {
			let emptyCount = 0;
			for (const n of neighbors) {
				if (!n.building) emptyCount++;
			}
			return emptyCount * 0.05;
		}
	},
	'house': {
		id: 'house',
		type: 'production',
		name: 'House',
		description: 'Grants an additive +10% production bonus to neighbors.',
		textureId: 'building_house',
		assetPath: 'game_icons/house.png',
		cost: { 'wood': 40, 'stone': 40, 'food': 50 },
		buildTime: 20,
		productions: {},
		getNeighborModifier: (_self: Entity, _target: Entity) => {
			return 0.1; // +10% to neighbors
		}
	}
};

export function getBuildingDef(id: string): BuildingDef | undefined {
	return BUILDINGS[id];
}

export function getBuildableBuildings(): BuildingDef[] {
	return Object.values(BUILDINGS).filter(b => !b.parentId);
}

export function getNextUpgradeDef(currentBuildingId: string): BuildingDef | undefined {
	const candidates = Object.values(BUILDINGS).filter(b => b.parentId === currentBuildingId);
	if (candidates.length === 0) return undefined;
	// Prefer explicit ordering; otherwise keep deterministic by id.
	return candidates
		.slice()
		.sort((a, b) => (a.upgradeLevel ?? Number.MAX_SAFE_INTEGER) - (b.upgradeLevel ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id))[0];
}
