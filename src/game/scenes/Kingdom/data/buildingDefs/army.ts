import type { BuildingDef } from "../buildings";

export const BUILDING_DEFS: BuildingDef[] = [
	{
		id: 'sword_barracks',
		type: 'army',
		name: 'Swordsman Barracks',
		description: 'Trains basic swordsman units for your army.',
		textureId: 'building_sword_barracks',
		assetPath: 'game_icons/sword-brandish.png',
		cost: { wood: 50, stone: 100 },
		buildTime: 2,
		unit: {
			id: 'swordsman',
			name: 'Swordsman',
			health: 100,
			drFlat: 5,
			drPercent: 0,
			actions: [
				{ damage: 25, canUpgrade: true, range: 1, targeting: 'first', actionPointCost: 1 }
			],
			actionsPerTurn: 1,
			speed: 2,
			textureId: 'unit_swordsman',
			assetPath: 'game_icons/sword-brandish.png',
		},
		trainCostBase: { wood: 50, stone: 25 },
		trainCostMult: 1.5,
		trainTime: 5,
		trainDef: {
			health: 20,
			attackDamage: 5,
			drFlat: 1,
		}
	},
	{
		id: 'archer_range',
		type: 'army',
		name: 'Archer Range',
		description: 'Trains ranged archer units for your army.',
		textureId: 'building_archer_range',
		assetPath: 'game_icons/high-shot.png',
		cost: { wood: 120, stone: 40 },
		buildTime: 3,
		unit: {
			id: 'archer',
			name: 'Archer',
			health: 50,
			drFlat: 0,
			drPercent: 0,
			actions: [
				{ damage: 15, canUpgrade: true, range: 5, targeting: 'last', actionPointCost: 1 }
			],
			actionsPerTurn: 1,
			speed: 3,
			textureId: 'unit_archer',
			assetPath: 'game_icons/high-shot.png',
		},
		trainCostBase: { wood: 30, stone: 10 },
		trainCostMult: 1.25,
		trainTime: 4,
		trainDef: {
			health: 5,
			attackDamage: 5,
			drFlat: 0,
		}
	},
	{
		id: 'defender_hideout',
		type: 'army',
		name: 'Defender Hideout',
		description: 'Trains sturdy defender units for your army.',
		textureId: 'building_defender_hideout',
		assetPath: 'game_icons/vibrating-shield.png',
		cost: { wood: 50, stone: 50 },
		buildTime: 4,
		unit: {
			id: 'defender',
			name: 'Defender',
			health: 150,
			drFlat: 10,
			drPercent: 10,
			actions: [
				{ damage: 10, canUpgrade: true, range: 1, targeting: 'first', actionPointCost: 1 },
				{ damage: 0, canUpgrade: false, range: 0, targeting: 'first', actionPointCost: 1 }
			],
			actionsPerTurn: 1,
			speed: 1,
			textureId: 'unit_defender',
			assetPath: 'game_icons/vibrating-shield.png',
		},
		trainCostBase: { wood: 40, stone: 60 },
		trainCostMult: 1.4,
		trainTime: 6,
		trainDef: {
			health: 50,
			attackDamage: 1,
			drFlat: 5,
		}
	},
	{
		id: 'earth_mage_tower',
		type: 'army',
		name: 'Earth Mage Tower',
		description: 'Trains earth mage units for your army.',
		textureId: 'building_earth_mage_tower',
		assetPath: 'game_icons/earth-crack.png',
		cost: { wood: 80, stone: 150, mana: 10 },
		buildTime: 5,
		unit: {
			id: 'earth_mage',
			name: 'Earth Mage',
			health: 80,
			drFlat: 0,
			drPercent: 0,
			actions: [
				{ damage: 30, canUpgrade: true, range: 100, targeting: 'all', actionPointCost: 2 }
			],
			actionsPerTurn: 2,
			speed: 2,
			textureId: 'unit_earth_mage',
			assetPath: 'game_icons/earth-crack.png',
		},
		trainCostBase: { wood: 70, stone: 80, mana: 5 },
		trainCostMult: 1.6,
		trainTime: 8,
		trainDef: {
			health: 10,
			attackDamage: 10,
			drFlat: 0,
		}
	},
	{
		id: 'magic_archer_training_ground',
		type: 'army',
		name: 'Magic Archer Training Ground',
		description: 'Trains magic archer units for your army.',
		textureId: 'building_magic_archer_training_ground',
		assetPath: 'game_icons/double-shot.png',
		cost: { wood: 150, stone: 100, mana: 20 },
		buildTime: 6,
		unit: {
			id: 'magic_archer',
			name: 'Magic Archer',
			health: 60,
			drFlat: 10,
			drPercent: 0,
			actions: [
				{ damage: 20, canUpgrade: true, range: 15, targeting: 'first', actionPointCost: 1 },
				{ damage: 20, canUpgrade: true, range: 30, targeting: 'last', actionPointCost: 1 }
			],
			actionsPerTurn: 2,
			speed: 3,
			textureId: 'unit_magic_archer',
			assetPath: 'game_icons/double-shot.png',
		},
		trainCostBase: { wood: 100, stone: 50, mana: 10 },
		trainCostMult: 1.7,
		trainTime: 7,
		trainDef: {
			health: 15,
			attackDamage: 7,
			drFlat: 2,
		}
	}
];