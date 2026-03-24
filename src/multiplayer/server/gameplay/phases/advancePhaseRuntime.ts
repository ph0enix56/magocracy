import { configuration } from '../../../../game/configuration';
import { CHARTER_TEMPLATES } from '../../config/charters';
import { getAllBuildingDefs } from '../../config/buildings';
import type { AdvanceSnapshot } from '../../../../shared/multiplayer/contracts/snapshots';
import type { CharterOption } from '../../../../shared/domain/charter';
import {
	advancePhaseTimers,
	createActiveAdvanceState,
	createEmptyAdvanceState,
	pickRandomAvailableCharterId,
	selectAdvanceCharterInState,
	skipAdvancePick,
	type AdvancePhaseStateData
} from '../advance/advancePhase';
import { materializeCharter, pickCharterTemplatesForDraft, resolveAdvanceLevel } from '../advance/charterDraft';

export type AdvanceRuntimeActionResult = { ok: true } | { ok: false; reason: string };

type AdvancePhaseDeps = {
	playerIds: string[];
	getPlayerRenown: (playerId: string) => number;
	applyCharterRewards: (playerId: string, charter: CharterOption) => void;
};

export class AdvancePhaseRuntime {
	private readonly playerIds: string[];
	private state: AdvancePhaseStateData;
	private advancePhaseIndex = 0;

	constructor(private readonly deps: AdvancePhaseDeps) {
		this.playerIds = [...deps.playerIds];
		this.state = this.createEmptyState();
	}

	isActive(): boolean {
		return this.state.isActive;
	}

	startPhase(): void {
		const level = resolveAdvanceLevel(this.advancePhaseIndex, configuration.advancePhase.levelByAdvanceIndex);
		const desiredCount = Math.min(9, Math.max(1, this.playerIds.length + configuration.advancePhase.charterCountBonus));
		const charterTemplates = pickCharterTemplatesForDraft(CHARTER_TEMPLATES, level, desiredCount);
		const allBuildings = getAllBuildingDefs();
		const charters = charterTemplates.map((template, index) => materializeCharter(template, index + 1, allBuildings));
		const pickOrderPlayerIds = [...this.playerIds].sort((a, b) => {
			const aRenown = this.deps.getPlayerRenown(a);
			const bRenown = this.deps.getPlayerRenown(b);
			if (aRenown !== bRenown) return aRenown - bRenown;
			return this.playerIds.indexOf(a) - this.playerIds.indexOf(b);
		});

		this.state = createActiveAdvanceState({
			level,
			pickOrderPlayerIds,
			charters,
			secondsPerPick: configuration.advancePhase.secondsPerPick,
			revealDelaySeconds: configuration.advancePhase.revealSecondsAfterDraft
		});
		this.advancePhaseIndex += 1;
	}

	advanceTick(): { phaseShouldEnd: boolean } {
		if (!this.state.isActive) return { phaseShouldEnd: false };

		const timerResult = advancePhaseTimers(this.state);
		if (timerResult.phaseShouldEnd) {
			this.state = this.createEmptyState();
			return { phaseShouldEnd: true };
		}
		if (!timerResult.autoPickPlayerId) return { phaseShouldEnd: false };

		this.autoPickAdvanceCharter(timerResult.autoPickPlayerId);
		return { phaseShouldEnd: false };
	}

	selectCharter(playerId: string, charterId: string): AdvanceRuntimeActionResult {
		if (!this.state.isActive) {
			return { ok: false, reason: 'Advance draft is not active.' };
		}

		const result = selectAdvanceCharterInState(this.state, playerId, charterId);
		if (!result.ok) return result;
		this.deps.applyCharterRewards(playerId, result.selectedCharter);
		return { ok: true };
	}

	buildSnapshot(): AdvanceSnapshot {
		const currentPickerPlayerId = this.state.pickOrderPlayerIds[this.state.currentPickIndex];
		return {
			isActive: this.state.isActive,
			level: this.state.level,
			pickOrderPlayerIds: this.state.pickOrderPlayerIds,
			currentPickerPlayerId,
			secondsPerPick: this.state.secondsPerPick,
			secondsRemaining: this.state.secondsRemaining,
			revealDelaySeconds: this.state.revealDelaySeconds,
			secondsToPhaseEnd: this.state.secondsToPhaseEnd,
			charters: this.state.charters
		};
	}

	private autoPickAdvanceCharter(playerId: string): void {
		const charterId = pickRandomAvailableCharterId(this.state);
		if (!charterId) {
			skipAdvancePick(this.state);
			return;
		}
		this.selectCharter(playerId, charterId);
	}

	private createEmptyState(): AdvancePhaseStateData {
		return createEmptyAdvanceState({
			secondsPerPick: configuration.advancePhase.secondsPerPick,
			revealDelaySeconds: configuration.advancePhase.revealSecondsAfterDraft
		});
	}
}
