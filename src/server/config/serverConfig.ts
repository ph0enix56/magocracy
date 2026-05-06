/**
 * Server-side hardcoded configuration constants.
 * These values are internal to the server and are not user-configurable per session.
 */
export const serverConfig = {
	loop: {
		tickIntervalMs: 1000
	},

	shop: {
		size: 6,
		buyCostByTier: [10, 20, 40, 100] as readonly number[],
		rerollCost: 10,
		offerTierWeightsByPhaseLoop: [
			[70, 20, 8, 2],
			[50, 28, 16, 6],
			[28, 32, 24, 16],
			[0, 18, 34, 48]
		] as readonly (readonly number[])[]
	},

	fightPhase: {
		renownPerWin: 1
	},

	advancePhase: {
		charterCountBonus: 2,
		levelByAdvanceIndex: [1, 1, 2, 2, 3, 3, 4] as readonly number[]
	}
} as const;

export type ServerConfig = typeof serverConfig;
