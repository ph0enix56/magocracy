import type { CharterOption as CharterDraftOption } from '../../../shared/domain/charter';

export type AdvancePhaseStateData = {
	isActive: boolean;
	level: number;
	pickOrderPlayerIds: string[];
	currentPickIndex: number;
	secondsPerPick: number;
	secondsRemaining: number;
	revealDelaySeconds: number;
	secondsToPhaseEnd: number;
	charters: CharterDraftOption[];
};

export function createEmptyAdvanceState(params: {
	secondsPerPick: number;
	revealDelaySeconds: number;
}): AdvancePhaseStateData {
	return {
		isActive: false,
		level: 1,
		pickOrderPlayerIds: [],
		currentPickIndex: 0,
		secondsPerPick: Math.max(1, Math.floor(params.secondsPerPick)),
		secondsRemaining: 0,
		revealDelaySeconds: Math.max(0, Math.floor(params.revealDelaySeconds)),
		secondsToPhaseEnd: 0,
		charters: []
	};
}

export function createActiveAdvanceState(params: {
	level: number;
	pickOrderPlayerIds: string[];
	charters: CharterDraftOption[];
	secondsPerPick: number;
	revealDelaySeconds: number;
}): AdvancePhaseStateData {
	const secondsPerPick = Math.max(1, Math.floor(params.secondsPerPick));
	const revealDelaySeconds = Math.max(0, Math.floor(params.revealDelaySeconds));
	return {
		isActive: true,
		level: params.level,
		pickOrderPlayerIds: params.pickOrderPlayerIds,
		currentPickIndex: 0,
		secondsPerPick,
		secondsRemaining: secondsPerPick,
		revealDelaySeconds,
		secondsToPhaseEnd: 0,
		charters: params.charters
	};
}

export function advancePhaseTimers(
	state: AdvancePhaseStateData
): { phaseShouldEnd: true } | { phaseShouldEnd: false; autoPickPlayerId?: string } {
	if (!state.isActive) return { phaseShouldEnd: false };

	if (state.secondsToPhaseEnd > 0) {
		state.secondsToPhaseEnd -= 1;
		if (state.secondsToPhaseEnd <= 0) {
			return { phaseShouldEnd: true };
		}
		return { phaseShouldEnd: false };
	}

	if (state.secondsRemaining > 0) {
		state.secondsRemaining -= 1;
	}
	if (state.secondsRemaining > 0) return { phaseShouldEnd: false };

	const currentPlayerId = state.pickOrderPlayerIds[state.currentPickIndex];
	if (!currentPlayerId) return { phaseShouldEnd: false };
	return { phaseShouldEnd: false, autoPickPlayerId: currentPlayerId };
}

export function selectAdvanceCharterInState(
	state: AdvancePhaseStateData,
	playerId: string,
	charterId: string
): { ok: true; selectedCharter: CharterDraftOption } | { ok: false; reason: string } {
	if (!state.isActive) {
		return { ok: false, reason: 'Advance draft is not active.' };
	}

	const expectedPlayerId = state.pickOrderPlayerIds[state.currentPickIndex];
	if (!expectedPlayerId || expectedPlayerId !== playerId) {
		return { ok: false, reason: 'It is not your turn to pick a charter.' };
	}

	const charter = state.charters.find((entry) => entry.charterId === charterId);
	if (!charter) return { ok: false, reason: 'Unknown charter.' };
	if (charter.selectedByPlayerId) return { ok: false, reason: 'This charter is already taken.' };

	charter.selectedByPlayerId = playerId;
	advanceAfterPick(state);
	return { ok: true, selectedCharter: charter };
}

export function pickRandomAvailableCharterId(state: AdvancePhaseStateData): string | null {
	const available = state.charters.filter((entry) => !entry.selectedByPlayerId);
	if (available.length === 0) return null;
	return available[Math.floor(Math.random() * available.length)]!.charterId;
}

export function skipAdvancePick(state: AdvancePhaseStateData): void {
	advanceAfterPick(state);
}

function advanceAfterPick(state: AdvancePhaseStateData): void {
	state.currentPickIndex += 1;
	if (state.currentPickIndex >= state.pickOrderPlayerIds.length) {
		state.secondsRemaining = 0;
		state.secondsToPhaseEnd = state.revealDelaySeconds;
		return;
	}

	state.secondsRemaining = state.secondsPerPick;
}
