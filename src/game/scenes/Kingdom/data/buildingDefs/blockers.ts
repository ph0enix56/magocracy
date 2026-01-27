import type { BuildingDef } from "../buildings";

export const BUILDING_DEFS: BuildingDef[] = [
	{
		id: 'blocker_trees',
		type: 'blocking',
		name: 'Trees',
		description: 'A cluster of trees blocking construction.',
		textureId: 'blocker_trees',
		assetPath: 'board_icons/token.png',
		cost: { wood: 20, stone: 10 },
		buildTime: 10
	},
	{
		id: 'blocker_rocks',
		type: 'blocking',
		name: 'Rock Pile',
		description: 'A pile of rocks blocking construction.',
		textureId: 'blocker_rocks',
		assetPath: 'board_icons/token.png',
		cost: { wood: 10, stone: 30 },
		buildTime: 15
	},
	{
		id: 'blocker_stump',
		type: 'blocking',
		name: 'Tree Stump',
		description: 'A large tree stump blocking construction.',
		textureId: 'blocker_stump',
		assetPath: 'board_icons/token.png',
		cost: { wood: 15 },
		buildTime: 25
	},
	{
		id: 'blocker_pond',
		type: 'blocking',
		name: 'Pond',
		description: 'A small pond blocking construction.',
		textureId: 'blocker_pond',
		assetPath: 'board_icons/token.png',
		cost: { wood: 20, stone: 20 },
		buildTime: 20
	}
];
