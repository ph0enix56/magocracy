export const configuration = {
	loop: {
		tickIntervalMs: 1000
	},

	shop: {
		size: 4,
		buyCost: 10,
		rerollCost: 10
	},

	economy: {
		startingResources: {
			stone: 1000,
			wood: 1000,
			food: 1000,
			mana: 1000,
			gold: 1000
		},
		starterBlueprintInventory: {
			// [WIP] Starter blueprints for testing
			mine: 2,
			lumber_camp: 1,
			farm: 1,
			house: 1,
			sword_barracks: 1
		}
	},

	kingdomView: {
		selectedTileUiTickMs: 250,
		hexSize: 64,
		hexStroke: 4,
		gridOriginYOffset: -20,
		backgroundColor: 0xcacaca
	},

	worldMapView: {
		padding: 80,
		backgroundColor: 0x0d1b2a,
		armyFlagScale: 0.3,
		dots: {
			radius: {
				kingdom: 20,
				other: 14
			},
			stroke: {
				width: 3,
				color: 0xe0e1dd,
				alpha: 0.8
			},
			colors: {
				arrived: 0xe63946,
				player: 0x2d6a4f,
				enemy: 0x9b2226,
				neutral: 0x3a86ff
			}
		},
		links: {
			width: 3,
			color: 0x74c69d,
			alpha: 0.55
		},
		armyPath: {
			width: 2,
			color: 0xe0e1dd,
			alpha: 0.65
		}
	},

	render: {
		building: {
			hexSize: 64,
			spriteFillScaleMultiplier: 1.15,
			alpha: {
				initial: 0.5,
				constructing: 0.6,
				upgrading: 0.8
			},
			progress: {
				radius: 20,
				lineWidth: 4,
				backgroundColor: 0x000000,
				backgroundAlpha: 0.5,
				arcColor: {
					upgrading: 0x00bfff,
					constructing: 0xffa500
				},
				arcAlpha: 1
			}
		}
	}
} as const;

export type GameConfiguration = typeof configuration;
