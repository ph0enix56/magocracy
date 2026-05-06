import { derived } from 'svelte/store';
import { gameSessionState } from '../../client/gameSessionStore';

export type PhaseTimerViewState = {
	visible: boolean;
	remainingSeconds: number;
	totalSeconds: number;
	isInactive: boolean;
	phase: 'build' | 'combat' | 'advance' | 'none';
};

export const phaseTimerState = derived(gameSessionState, ($state): PhaseTimerViewState => {
	const phase = $state.currentPhase;

	if (phase === 'build') {
		const lobby = $state.lobby;
		const buildTotalSeconds = lobby?.settings.buildPhase.durationSeconds ?? 180;
		return {
			visible: true,
			remainingSeconds: Math.max(0, Math.floor($state.game?.buildPhaseSecondsRemaining ?? 0)),
			totalSeconds: buildTotalSeconds,
			isInactive: false,
			phase: 'build'
		};
	}

	if (phase === 'combat') {
		const lobby = $state.lobby;
		const fightSettings = lobby?.settings.fightPhase;
		const totalSeconds = $state.fight.currentRoundIndex >= $state.fight.totalRounds
			? (fightSettings?.finalResultsSeconds ?? 10)
			: Math.max(1, Math.floor($state.fight.secondsPerRound || fightSettings?.secondsPerRound || 5));
		return {
			visible: true,
			remainingSeconds: Math.max(0, Math.floor($state.fight.secondsToNextRound)),
			totalSeconds,
			isInactive: false,
			phase: 'combat'
		};
	}

	if (phase === 'advance') {
		const lobby = $state.lobby;
		const advanceSettings = lobby?.settings.advancePhase;
		const pickerId = $state.advance.currentPickerPlayerId;
		const selfPlayerId = $state.playerId;
		const isInactive = !pickerId || pickerId !== selfPlayerId;
		const totalSeconds = pickerId
			? Math.max(1, Math.floor($state.advance.secondsPerPick || advanceSettings?.secondsPerPick || 20))
			: Math.max(1, Math.floor($state.advance.revealDelaySeconds || advanceSettings?.revealSecondsAfterDraft || 8));
		const remainingSeconds = pickerId
			? Math.max(0, Math.floor($state.advance.secondsRemaining))
			: Math.max(0, Math.floor($state.advance.secondsToPhaseEnd));

		return {
			visible: true,
			remainingSeconds,
			totalSeconds,
			isInactive,
			phase: 'advance'
		};
	}

	return {
		visible: false,
		remainingSeconds: 0,
		totalSeconds: 1,
		isInactive: false,
		phase: 'none'
	};
});
