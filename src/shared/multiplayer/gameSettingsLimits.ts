/**
 * Min/max bounds for user-configurable game settings.
 */
export const GAME_SETTINGS_LIMITS = {
	fightPhase: {
		secondsPerRound: { min: 10, max: 120 },
		finalResultsSeconds: { min: 10, max: 120 }
	},
	buildPhase: {
		durationSeconds: { min: 10, max: 3600 },
		secondsPerTick: { min: 1, max: 60 }
	},
	gameLifecycle: {
		targetRenown: { min: 1, max: 50 }
	},
	advancePhase: {
		secondsPerPick: { min: 5, max: 120 },
		revealSecondsAfterDraft: { min: 5, max: 120 }
	}
} as const;
