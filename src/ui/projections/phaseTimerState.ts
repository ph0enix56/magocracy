import { derived } from 'svelte/store';
import { gameSessionState } from '../../multiplayer/client/gameSessionStore';
import { configuration } from '../../game/configuration';

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
		return {
			visible: true,
			remainingSeconds: Math.max(0, Math.floor($state.game?.buildPhaseSecondsRemaining ?? 0)),
			totalSeconds: configuration.buildPhase.durationSeconds,
			isInactive: false,
			phase: 'build'
		};
	}

	if (phase === 'combat') {
		const totalSeconds = $state.fight.currentRoundIndex >= $state.fight.totalRounds
			? configuration.fightPhase.finalResultsSeconds
			: Math.max(1, Math.floor($state.fight.secondsPerRound || configuration.fightPhase.secondsPerRound));
		return {
			visible: true,
			remainingSeconds: Math.max(0, Math.floor($state.fight.secondsToNextRound)),
			totalSeconds,
			isInactive: false,
			phase: 'combat'
		};
	}

	if (phase === 'advance') {
		const pickerId = $state.advance.currentPickerPlayerId;
		const selfPlayerId = $state.playerId;
		const isInactive = !pickerId || pickerId !== selfPlayerId;
		const totalSeconds = pickerId
			? Math.max(1, Math.floor($state.advance.secondsPerPick || configuration.advancePhase.secondsPerPick))
			: Math.max(1, Math.floor($state.advance.revealDelaySeconds || configuration.advancePhase.revealSecondsAfterDraft));
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
