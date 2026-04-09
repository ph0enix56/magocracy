export const configuration = {
	loop: {
		tickIntervalMs: 1000
	},

	shop: {
		size: 6,
		buyCostByTier: [10, 20, 40, 100],
		rerollCost: 10
	},

	economy: {
		startingResources: {
			stone: 100000,
			wood: 100000,
			food: 100000,
			mana: 100000,
			renown: 0,
			expansion: 5
		},
		starterBlueprintInventory: {
			// [WIP] Starter blueprints for testing
			logging_camp: 2,
			mana_pump: 2,
			ghost_camp: 1,
			prototype_marksman_camp: 1,
			dolmen: 1,
			granary: 1,
			academy: 1,
			deep_mine: 1,
			berserker_camp: 1,
			fire_elemental_grounds: 1,
			holy_oak: 1,
			blacksmith: 1,
			factory: 1,
			tinkers_guild: 1,
			fire_mage_tower: 1,
			the_apex_construct_portal: 1
		}
	},

	fightPhase: {
		secondsPerRound: 5,
		finalResultsSeconds: 10,
		renownPerWin: 1
	},

	buildPhase: {
		durationSeconds: 1000,
		secondsPerTick: 1
	},

	gameLifecycle: {
		targetRenown: 10
	},

	advancePhase: {
		secondsPerPick: 20,
		revealSecondsAfterDraft: 8,
		charterCountBonus: 1,
		levelByAdvanceIndex: [1, 1, 2, 2, 3, 3, 4]
	},

	kingdomView: {
		hexSize: 64,
		hexStroke: 4,
		gridOriginYOffset: -20,
		backgroundColor: 0xcacaca
	},

	render: {
		building: {
			hexSize: 64,
			spriteFillScaleMultiplier: 1.15,
				textureOversample: 2,
			alpha: {
				initial: 0.5,
				constructing: 0.6,
				upgrading: 0.8
			},
			badge: {
				offsetX: 0,
				offsetY: 0,
				radius: 16,
				ringRadius: 19,
				ringWidth: 4,
				fontSize: 18,
				depth: 30,
				color: '#ffffff',
				strokeColor: '#000000',
				strokeThickness: 4,
				fillColor: 0x101318,
				fillAlpha: 0.9,
				borderColor: 0xffffff,
				borderAlpha: 0.14,
				borderWidth: 2,
				trackColor: 0x000000,
				trackAlpha: 0.35,
				ringAlpha: 1,
				ringColor: {
					constructing: 0xffa500,
					upgrading: 0x00bfff
				}
			}
		}
	}
} as const;

export type GameConfiguration = typeof configuration;
