import type { GameSettings } from '../../shared/multiplayer/snapshots';

/**
 * Game settings preset for solo sandbox lobbies.
 */
export const SOLO_GAME_SETTINGS: GameSettings = {
	advancePhase: { secondsPerPick: 600, revealSecondsAfterDraft: 5 },
	buildPhase: { durationSeconds: 1000, secondsPerTick: 1 },
	fightPhase: { secondsPerRound: 5, finalResultsSeconds: 60 },
	gameLifecycle: { targetRenown: 10 },
	economy: {
		startingResources: { stone: 100000, wood: 100000, food: 100000, mana: 100000, renown: 0, expansion: 100 },
		starterBlueprintInventory: {
			logging_camp: 2,
			mana_pump: 2,
			ghost_camp: 1,
			prototype_marksman_camp: 1,
			dolmen: 1,
			granary: 1,
			quarry: 1,
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
	}
};

/**
 * Default game settings preset for normal multiplayer lobbies.
 * The host may adjust the configurable fields before starting the match.
 */
export const DEFAULT_NORMAL_GAME_SETTINGS: GameSettings = {
	advancePhase: { secondsPerPick: 20, revealSecondsAfterDraft: 10 },
	buildPhase: { durationSeconds: 120, secondsPerTick: 10 },
	fightPhase: { secondsPerRound: 40, finalResultsSeconds: 40 },
	gameLifecycle: { targetRenown: 5 },
	economy: {
		startingResources: { stone: 100, wood: 100, food: 100, mana: 50, renown: 0, expansion: 0 },
		starterBlueprintInventory: {}
	}
};
