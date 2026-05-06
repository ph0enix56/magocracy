import { GAME_SETTINGS_LIMITS } from '../../shared/multiplayer/gameSettingsLimits';
import type { GameSettings } from '../../shared/multiplayer/snapshots';

export { SOLO_GAME_SETTINGS, DEFAULT_NORMAL_GAME_SETTINGS } from '../config/gameSettingsPresets';

/**
 * Merges a partial settings patch on top of a base settings object.
 * Only top-level section objects are merged (not deep); to update individual fields
 * the patch must include the full section object.
 */
export function mergeSettings(base: GameSettings, patch: Partial<GameSettings>): GameSettings {
	return {
		fightPhase: patch.fightPhase ?? base.fightPhase,
		buildPhase: patch.buildPhase ?? base.buildPhase,
		gameLifecycle: patch.gameLifecycle ?? base.gameLifecycle,
		advancePhase: patch.advancePhase ?? base.advancePhase,
		economy: patch.economy ?? base.economy
	};
}

/** Floors a number and clamps it to [min, max]. */
function clampInt(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, Math.floor(value)));
}

/**
 * Clamps and sanitizes user-submitted game settings against GAME_SETTINGS_LIMITS.
 * Always call this before storing or applying host-submitted settings.
 */
export function clampSettings(s: GameSettings): GameSettings {
	const L = GAME_SETTINGS_LIMITS;
	return {
		fightPhase: {
			secondsPerRound: clampInt(s.fightPhase.secondsPerRound, L.fightPhase.secondsPerRound.min, L.fightPhase.secondsPerRound.max),
			finalResultsSeconds: clampInt(s.fightPhase.finalResultsSeconds, L.fightPhase.finalResultsSeconds.min, L.fightPhase.finalResultsSeconds.max)
		},
		buildPhase: {
			durationSeconds: clampInt(s.buildPhase.durationSeconds, L.buildPhase.durationSeconds.min, L.buildPhase.durationSeconds.max),
			secondsPerTick: clampInt(s.buildPhase.secondsPerTick, L.buildPhase.secondsPerTick.min, L.buildPhase.secondsPerTick.max)
		},
		gameLifecycle: {
			targetRenown: clampInt(s.gameLifecycle.targetRenown, L.gameLifecycle.targetRenown.min, L.gameLifecycle.targetRenown.max)
		},
		advancePhase: {
			secondsPerPick: clampInt(s.advancePhase.secondsPerPick, L.advancePhase.secondsPerPick.min, L.advancePhase.secondsPerPick.max),
			revealSecondsAfterDraft: clampInt(s.advancePhase.revealSecondsAfterDraft, L.advancePhase.revealSecondsAfterDraft.min, L.advancePhase.revealSecondsAfterDraft.max)
		},
		economy: s.economy
	};
}
