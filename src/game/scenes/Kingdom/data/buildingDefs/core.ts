import type { Entity } from '../../ecs/ECSBase';
import type { BuildingDef } from '../buildings';

export const BUILDING_DEFS: BuildingDef[] = [
	{
		id: 'mine',
		type: 'production',
		name: 'Stone Mine',
		description: 'Extracts stone from the earth.',
		textureId: 'building_mine',
		assetPath: 'game_icons/stone-crafting.png',
		cost: { wood: 35 },
		buildTime: 5,
		productions: { stone: 5 },
		getSelfProdModifier: (_self: Entity, _neighbors: Entity[]) => {
			return 0;
		}
	},
	{
		id: 'mine_2',
		parentId: 'mine',
		type: 'production',
		name: 'Stone Mine II',
		description: 'Upgraded mine with better tools and throughput.',
		textureId: 'building_mine',
		assetPath: 'game_icons/stone-crafting.png',
		cost: { wood: 60, stone: 30 },
		buildTime: 8,
		productions: { stone: 8 },
		getSelfProdModifier: (_self: Entity, _neighbors: Entity[]) => 0
	},
	{
		id: 'mine_3',
		parentId: 'mine_2',
		type: 'production',
		name: 'Stone Mine III',
		description: 'Deep shafts and reinforced supports.',
		textureId: 'building_mine',
		assetPath: 'game_icons/stone-crafting.png',
		cost: { wood: 90, stone: 70 },
		buildTime: 12,
		productions: { stone: 12 },
		getSelfProdModifier: (_self: Entity, _neighbors: Entity[]) => 0
	},
	{
		id: 'lumber_camp',
		type: 'production',
		name: 'Lumber Camp',
		description: 'Cuts wood. Lumber Camps near each other work more efficiently.',
		textureId: 'building_lumber_camp',
		assetPath: 'game_icons/axe-in-stump.png',
		cost: { stone: 60 },
		buildTime: 10,
		productions: { wood: 10 },
		getSelfProdModifier: (_self: Entity, neighbors: Entity[]) => {
			let bonus = 0;
			for (const n of neighbors) {
				if (n.building?.status === 'active' && n.building.buildingId === 'lumber_camp') {
					bonus += 0.1;
				}
			}
			return bonus;
		}
	},
	{
		id: 'lumber_camp_2',
		parentId: 'lumber_camp',
		type: 'production',
		name: 'Lumber Camp II',
		description: 'Sharper saws and better logistics.',
		textureId: 'building_lumber_camp',
		assetPath: 'game_icons/axe-in-stump.png',
		cost: { stone: 80, wood: 30 },
		buildTime: 12,
		productions: { wood: 14 },
		getSelfProdModifier: (_self: Entity, neighbors: Entity[]) => {
			let bonus = 0;
			for (const n of neighbors) {
				if (
					n.building?.status === 'active' &&
					(n.building.buildingId === 'lumber_camp' || n.building.buildingId === 'lumber_camp_2')
				) {
					bonus += 0.1;
				}
			}
			return bonus;
		}
	},
	{
		id: 'farm',
		type: 'production',
		name: 'Farm',
		description: 'Produces food. Farms work faster the more empty tiles are surrounding them.',
		textureId: 'building_farm',
		assetPath: 'game_icons/windmill.png',
		cost: { wood: 40, stone: 40 },
		buildTime: 15,
		productions: { food: 15 },
		getSelfProdModifier: (_self: Entity, neighbors: Entity[]) => {
			let emptyCount = 0;
			for (const n of neighbors) {
				if (!n.building) {
					emptyCount++;
				}
			}
			return emptyCount * 0.05;
		}
	},
	{
		id: 'farm_2',
		parentId: 'farm',
		type: 'production',
		name: 'Farm II',
		description: 'Crop rotation and irrigation improve yields.',
		textureId: 'building_farm',
		assetPath: 'game_icons/windmill.png',
		cost: { wood: 60, stone: 60, food: 50 },
		buildTime: 18,
		productions: { food: 22 },
		getSelfProdModifier: (_self: Entity, neighbors: Entity[]) => {
			let emptyCount = 0;
			for (const n of neighbors) {
				if (!n.building) emptyCount++;
			}
			return emptyCount * 0.05;
		}
	},
	{
		id: 'house',
		type: 'production',
		name: 'House',
		description: 'Grants an additive +10% production bonus to neighbors.',
		textureId: 'building_house',
		assetPath: 'game_icons/house.png',
		cost: { wood: 40, stone: 40, food: 50 },
		buildTime: 20,
		productions: {},
		getOutgoingProdModifier: (_self: Entity, _target: Entity) => {
			return 0.1;
		}
	}
];
