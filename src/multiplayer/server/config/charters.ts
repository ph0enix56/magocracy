export type CharterResourceRangeDef = {
	resource: string;
	min: number;
	max: number;
};

export type CharterBlueprintRuleDef = {
	tier: number;
	countMin: number;
	countMax: number;
	buildingType?: 'production' | 'army';
	magicSchool?: string;
};

export type CharterTemplateDef = {
	id: string;
	title: string;
	level: number;
	resources: CharterResourceRangeDef[];
	blueprints?: CharterBlueprintRuleDef[];
};

export const CHARTER_TEMPLATES: CharterTemplateDef[] = [
	{
		id: 'frontier-kit-l1',
		title: 'Frontier Kit',
		level: 1,
		resources: [
			{ resource: 'wood', min: 110, max: 160 },
			{ resource: 'stone', min: 70, max: 110 },
			{ resource: 'expansion', min: 1, max: 2 }
		]
	},
	{
		id: 'architect-charter-l1',
		title: 'Architect Charter',
		level: 1,
		resources: [
			{ resource: 'gold', min: 45, max: 80 },
			{ resource: 'expansion', min: 1, max: 1 }
		],
		blueprints: [
			{ tier: 1, countMin: 1, countMax: 1, buildingType: 'production' }
		]
	},
	{
		id: 'war-subsidy-l1',
		title: 'War Subsidy',
		level: 1,
		resources: [
			{ resource: 'food', min: 100, max: 140 },
			{ resource: 'wood', min: 60, max: 90 }
		],
		blueprints: [
			{ tier: 1, countMin: 1, countMax: 1, buildingType: 'army' }
		]
	},
	{
		id: 'royal-granary-l2',
		title: 'Royal Granary',
		level: 2,
		resources: [
			{ resource: 'food', min: 160, max: 220 },
			{ resource: 'gold', min: 70, max: 120 },
			{ resource: 'expansion', min: 1, max: 2 }
		]
	},
	{
		id: 'guild-license-l2',
		title: 'Guild License',
		level: 2,
		resources: [
			{ resource: 'stone', min: 90, max: 140 },
			{ resource: 'wood', min: 90, max: 140 }
		],
		blueprints: [
			{ tier: 2, countMin: 1, countMax: 2, buildingType: 'production' }
		]
	},
	{
		id: 'arcane-drill-l2',
		title: 'Arcane Drill',
		level: 2,
		resources: [
			{ resource: 'mana', min: 50, max: 90 },
			{ resource: 'gold', min: 60, max: 100 }
		],
		blueprints: [
			{ tier: 2, countMin: 1, countMax: 1, buildingType: 'army' }
		]
	},
	{
		id: 'imperial-roadworks-l3',
		title: 'Imperial Roadworks',
		level: 3,
		resources: [
			{ resource: 'stone', min: 180, max: 250 },
			{ resource: 'wood', min: 180, max: 250 },
			{ resource: 'expansion', min: 2, max: 3 }
		]
	},
	{
		id: 'high-magistry-l3',
		title: 'High Magistry',
		level: 3,
		resources: [
			{ resource: 'mana', min: 100, max: 160 },
			{ resource: 'gold', min: 120, max: 180 }
		],
		blueprints: [
			{ tier: 3, countMin: 1, countMax: 2, buildingType: 'army', magicSchool: 'arcane' }
		]
	},
	{
		id: 'expedition-warrant-l3',
		title: 'Expedition Warrant',
		level: 3,
		resources: [
			{ resource: 'food', min: 160, max: 220 },
			{ resource: 'expansion', min: 2, max: 3 }
		],
		blueprints: [
			{ tier: 2, countMin: 1, countMax: 1, buildingType: 'production' },
			{ tier: 3, countMin: 1, countMax: 1 }
		]
	},
	{
		id: 'dynasty-founding-l4',
		title: 'Dynasty Founding Grant',
		level: 4,
		resources: [
			{ resource: 'gold', min: 220, max: 300 },
			{ resource: 'mana', min: 160, max: 230 },
			{ resource: 'expansion', min: 3, max: 4 }
		],
		blueprints: [
			{ tier: 3, countMin: 2, countMax: 3 }
		]
	},
	{
		id: 'arsenal-of-kings-l4',
		title: 'Arsenal of Kings',
		level: 4,
		resources: [
			{ resource: 'food', min: 140, max: 220 },
			{ resource: 'wood', min: 140, max: 220 }
		],
		blueprints: [
			{ tier: 3, countMin: 2, countMax: 2, buildingType: 'army' }
		]
	},
	{
		id: 'civil-renaissance-l4',
		title: 'Civil Renaissance',
		level: 4,
		resources: [
			{ resource: 'stone', min: 190, max: 260 },
			{ resource: 'gold', min: 120, max: 180 },
			{ resource: 'expansion', min: 2, max: 4 }
		],
		blueprints: [
			{ tier: 2, countMin: 1, countMax: 1, buildingType: 'production' },
			{ tier: 3, countMin: 1, countMax: 2, buildingType: 'production' }
		]
	}
];
