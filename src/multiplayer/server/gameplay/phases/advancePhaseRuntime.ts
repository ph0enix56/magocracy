import { configuration } from '../../../../game/configuration';
import { CHARTER_TEMPLATES } from '../../config/charters';
import { getAllBuildingDefs } from '../../config/buildings';
import type { GameActionCommand } from '../../../../shared/multiplayer/contracts/commands';
import type { AdvanceSnapshot } from '../../../../shared/multiplayer/contracts/snapshots';
import type { CharterOption, CharterBlueprintGrant, CharterResourceGrant } from '../../../../shared/domain/charter';
import type { PhaseActionResult, PhaseTickResult, RuntimePhase, RuntimePhaseContext } from './runtimePhase';
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

export class AdvancePhaseRuntime implements RuntimePhase {
	readonly key = 'advance' as const;
	private state: AdvancePhaseStateData;
	private advancePhaseIndex = 0;

	constructor() {
		this.state = this.createEmptyState();
	}

	isActive(): boolean {
		return this.state.isActive;
	}

	onEnter(_ctx: RuntimePhaseContext): void {
		this.startPhase(_ctx);
	}

	onExit(_ctx: RuntimePhaseContext): void {}

	startPhase(ctx: RuntimePhaseContext): void {
		const level = resolveAdvanceLevel(this.advancePhaseIndex, configuration.advancePhase.levelByAdvanceIndex);
		const desiredCount = Math.min(9, Math.max(1, ctx.playerIds.length + configuration.advancePhase.charterCountBonus));
		const charterTemplates = pickCharterTemplatesForDraft(CHARTER_TEMPLATES, level, desiredCount);
		const allBuildings = getAllBuildingDefs();
		const charters = charterTemplates.map((template, index) => materializeCharter(template, index + 1, allBuildings));
		const pickOrderPlayerIds = [...ctx.playerIds].sort((a, b) => {
			const aRenown = this.getPlayerRenown(ctx, a);
			const bRenown = this.getPlayerRenown(ctx, b);
			if (aRenown !== bRenown) return aRenown - bRenown;
			return ctx.playerIds.indexOf(a) - ctx.playerIds.indexOf(b);
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

	tick(ctx: RuntimePhaseContext): PhaseTickResult {
		if (!this.state.isActive) return { kind: 'continue' };

		const timerResult = advancePhaseTimers(this.state);
		if (timerResult.phaseShouldEnd) {
			this.state = this.createEmptyState();
			return { kind: 'transition', transition: { nextPhase: 'build' } };
		}
		if (!timerResult.autoPickPlayerId) return { kind: 'continue' };

		this.autoPickAdvanceCharter(ctx, timerResult.autoPickPlayerId);
		return { kind: 'continue' };
	}

	tryHandleAction(_ctx: RuntimePhaseContext, playerId: string, action: GameActionCommand): PhaseActionResult {
		if (action.type !== 'advance/select-charter') return { handled: false };
		const result = this.selectCharter(_ctx, playerId, action.charterId);
		if (!result.ok) {
			return { handled: true, ok: false, reason: result.reason };
		}
		return { handled: true, ok: true, emitSnapshot: true };
	}

	selectCharter(ctx: RuntimePhaseContext, playerId: string, charterId: string): AdvanceRuntimeActionResult {
		if (!this.state.isActive) {
			return { ok: false, reason: 'Advance draft is not active.' };
		}

		const result = selectAdvanceCharterInState(this.state, playerId, charterId);
		if (!result.ok) return result;
		this.applyCharterRewards(ctx, playerId, result.selectedCharter);
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

	private autoPickAdvanceCharter(ctx: RuntimePhaseContext, playerId: string): void {
		const charterId = pickRandomAvailableCharterId(this.state);
		if (!charterId) {
			skipAdvancePick(this.state);
			return;
		}
		this.selectCharter(ctx, playerId, charterId);
	}

	private createEmptyState(): AdvancePhaseStateData {
		return createEmptyAdvanceState({
			secondsPerPick: configuration.advancePhase.secondsPerPick,
			revealDelaySeconds: configuration.advancePhase.revealSecondsAfterDraft
		});
	}

	private getPlayerRenown(ctx: RuntimePhaseContext, playerId: string): number {
		return ctx.getPlayerRuntime(playerId)?.run.world.resources.get('renown') ?? 0;
	}

	private applyCharterRewards(ctx: RuntimePhaseContext, playerId: string, charter: CharterOption): void {
		const runtime = ctx.getPlayerRuntime(playerId);
		if (!runtime) return;
		for (const grant of charter.resources) {
			this.applyResourceGrant(runtime.run.world.resources, grant);
		}
		for (const blueprint of charter.blueprints) {
			this.applyBlueprintGrant(runtime.run.world.blueprintInventory, blueprint);
		}
	}

	private applyResourceGrant(resources: Map<string, number>, grant: CharterResourceGrant): void {
		const current = resources.get(grant.resource) ?? 0;
		resources.set(grant.resource, current + Math.max(0, Math.floor(grant.amount)));
	}

	private applyBlueprintGrant(blueprints: Map<string, number>, grant: CharterBlueprintGrant): void {
		const current = blueprints.get(grant.buildingId) ?? 0;
		blueprints.set(grant.buildingId, current + Math.max(0, Math.floor(grant.count)));
	}
}
