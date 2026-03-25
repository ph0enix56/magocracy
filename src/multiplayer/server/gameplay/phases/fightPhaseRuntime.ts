import type { CombatSnapshot } from '../../../../shared/domain/combatTypes';
import type { GameActionCommand } from '../../../../shared/multiplayer/contracts/commands';
import type { FightPlayerRoundSnapshot } from '../../../../shared/multiplayer/contracts/snapshots';
import { configuration } from '../../../../game/configuration';
import { getUnitDef } from '../../config/buildings';
import type { ArmyUnitState } from '../model';
import type { PhaseActionResult, PhaseTickResult, RuntimePhase, RuntimePhaseContext } from './runtimePhase';
import {
	createFightPhaseState,
	type FightPhaseStateData,
	openFightReplayForPlayer,
	resolveFightRound as resolveFightRoundState
} from '../fight/fightPhase';
import { buildFightSnapshotForPlayer } from '../fight/fightSnapshots';
import { buildRoundRobinCycle } from '../fight/roundRobin';
import { CombatReplaySession } from '../fight/CombatReplaySession';

export type FightRuntimeActionResult = { ok: true } | { ok: false; reason: string };

export class FightPhaseRuntime implements RuntimePhase {
	readonly key = 'combat' as const;
	private readonly playerIds: string[];
	private context: RuntimePhaseContext | null = null;
	private state: FightPhaseStateData;
	private matchSeq = 1;
	private finalResultsSeconds = Math.max(0, Math.floor(configuration.fightPhase.finalResultsSeconds));
	private roundRobinCycleIndex = 0;
	private roundRobinRoundCursor = 0;
	private roundRobinRounds: Array<Array<[string, string?]>> = [];
	private firstCycleOpeningSignature: string | null = null;
	private readonly combatReplayByPlayerId = new Map<string, CombatReplaySession>();

	constructor() {
		this.playerIds = [];
		this.state = this.createEmptyState();
	}

	onEnter(ctx: RuntimePhaseContext): void {
		this.context = ctx;
		this.playerIds.splice(0, this.playerIds.length, ...ctx.playerIds);
		this.start();
	}

	onExit(ctx: RuntimePhaseContext): void {
		this.context = ctx;
	}

	start(): void {
		const encountersPerPhase = clampIntInRange(configuration.fightPhase.encountersPerPhase, 1, 3);
		const secondsPerRound = Math.max(1, Math.floor(configuration.fightPhase.secondsPerRound));
		this.finalResultsSeconds = Math.max(0, Math.floor(configuration.fightPhase.finalResultsSeconds));

		this.combatReplayByPlayerId.clear();
		this.state = createFightPhaseState({
			playerIds: this.playerIds,
			encountersPerPhase,
			secondsPerRound,
			nextRoundPairs: () => this.nextRoundRobinPairs(),
			nextMatchId: () => `fight-${this.matchSeq++}`
		});
	}

	tick(ctx: RuntimePhaseContext): PhaseTickResult {
		this.context = ctx;
		if (!this.state.isActive) return { kind: 'continue' };
		if (this.state.secondsToNextRound > 0) {
			this.state.secondsToNextRound -= 1;
		}
		if (this.state.secondsToNextRound > 0) return { kind: 'continue' };
		if (this.state.currentRoundIndex >= this.state.encountersPerPhase) {
			this.state.isActive = false;
			this.state.secondsToNextRound = 0;
			return { kind: 'transition', transition: { nextPhase: 'advance' } };
		}

		this.resolveFightRound(ctx, this.state.currentRoundIndex);
		this.state.currentRoundIndex += 1;
		if (this.state.currentRoundIndex >= this.state.encountersPerPhase) {
			if (this.finalResultsSeconds <= 0) {
				this.state.isActive = false;
				this.state.secondsToNextRound = 0;
				return { kind: 'transition', transition: { nextPhase: 'advance' } };
			}
			this.state.secondsToNextRound = this.finalResultsSeconds;
			return { kind: 'continue' };
		}

		this.state.secondsToNextRound = this.state.secondsPerRound;
		return { kind: 'continue' };
	}

	tryHandleAction(_ctx: RuntimePhaseContext, playerId: string, action: GameActionCommand): PhaseActionResult {
		switch (action.type) {
			case 'combat/step': {
				const result = this.stepCombatReplay(playerId, action.steps);
				if (!result.ok) return { handled: true, ok: false, reason: result.reason };
				return { handled: true, ok: true, emitSnapshot: true };
			}
			case 'fight/replay-open': {
				const result = this.openReplay(playerId, action.matchId);
				if (!result.ok) return { handled: true, ok: false, reason: result.reason };
				return { handled: true, ok: true, emitSnapshot: true };
			}
			default:
				return { handled: false };
		}
	}

	buildFightSnapshotForPlayer(playerId: string) {
		const ctx = this.context;
		return buildFightSnapshotForPlayer({
			playerId,
			state: this.state,
			getArmyForPlayer: (targetPlayerId) => this.getArmyForPlayer(ctx, targetPlayerId),
			resolveUnitName: (unitDefId) => getUnitDef(unitDefId)?.name ?? unitDefId
		});
	}

	getCombatSnapshotForPlayer(playerId: string): CombatSnapshot {
		const replay = this.combatReplayByPlayerId.get(playerId);
		if (!replay) {
			return { status: 'idle', round: 0, activeSide: 'armyA', armyA: [], armyB: [], log: [] };
		}
		return replay.getSnapshot();
	}

	openReplay(playerId: string, matchId: string): FightRuntimeActionResult {
		return openFightReplayForPlayer({
			playerId,
			matchId,
			state: this.state,
			startCombat: (selfArmy, opponentArmy) => {
				const replay = new CombatReplaySession();
				replay.start(selfArmy, opponentArmy);
				this.combatReplayByPlayerId.set(playerId, replay);
			}
		});
	}

	stepCombatReplay(playerId: string, steps?: number): FightRuntimeActionResult {
		const replay = this.combatReplayByPlayerId.get(playerId);
		if (!replay) return { ok: false, reason: 'No active combat replay.' };
		replay.step(steps ?? 1);
		return { ok: true };
	}

	private resolveFightRound(ctx: RuntimePhaseContext, roundIndex: number): void {
		resolveFightRoundState({
			roundIndex,
			state: this.state,
			getArmyForPlayer: (playerId) => this.getArmyForPlayer(ctx, playerId),
			grantRenown: (playerId) => this.grantRenown(ctx, playerId)
		});
	}

	private nextRoundRobinPairs(): Array<[string, string?]> {
		if (this.roundRobinRounds.length === 0 || this.roundRobinRoundCursor >= this.roundRobinRounds.length) {
			this.roundRobinRounds = this.buildRoundRobinRoundsForCycle(this.roundRobinCycleIndex);
			this.roundRobinRoundCursor = 0;
			this.roundRobinCycleIndex += 1;
		}
		const round = this.roundRobinRounds[this.roundRobinRoundCursor] ?? [];
		this.roundRobinRoundCursor += 1;
		return round;
	}

	private buildRoundRobinRoundsForCycle(cycleIndex: number): Array<Array<[string, string?]>> {
		const cycle = buildRoundRobinCycle({
			playerIds: this.playerIds,
			cycleIndex,
			firstCycleOpeningSignature: this.firstCycleOpeningSignature
		});
		this.firstCycleOpeningSignature = cycle.firstCycleOpeningSignature;
		return cycle.rounds;
	}

	private createEmptyState(): FightPhaseStateData {
		const playerRoundsByPlayerId = new Map<string, FightPlayerRoundSnapshot[]>();
		for (const playerId of this.playerIds) {
			playerRoundsByPlayerId.set(playerId, []);
		}
		return {
			isActive: false,
			encountersPerPhase: clampIntInRange(configuration.fightPhase.encountersPerPhase, 1, 3),
			secondsPerRound: Math.max(1, Math.floor(configuration.fightPhase.secondsPerRound)),
			currentRoundIndex: 0,
			secondsToNextRound: 0,
			pairings: [],
			results: [],
			playerRoundsByPlayerId,
			replaysByMatchId: new Map()
		};
	}

	private getArmyForPlayer(ctx: RuntimePhaseContext | null, playerId: string): ArmyUnitState[] {
		if (!ctx) return [];
		const runtime = ctx.getPlayerRuntime(playerId);
		if (!runtime) return [];
		return runtime.run.world.getOrderedArmyUnits().slice();
	}

	private grantRenown(ctx: RuntimePhaseContext, playerId: string): void {
		const runtime = ctx.getPlayerRuntime(playerId);
		if (!runtime) return;
		const current = runtime.run.world.resources.get('renown') ?? 0;
		runtime.run.world.resources.set('renown', current + Math.max(0, Math.floor(configuration.fightPhase.renownPerWin)));
	}
}

function clampIntInRange(value: number, min: number, max: number): number {
	const int = Number.isFinite(value) ? Math.floor(value) : min;
	return Math.max(min, Math.min(max, int));
}
