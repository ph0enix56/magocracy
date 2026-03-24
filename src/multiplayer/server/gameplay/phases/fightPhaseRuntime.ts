import type { CombatSnapshot } from '../../../../shared/domain/combatTypes';
import type { FightPlayerRoundSnapshot } from '../../../../shared/multiplayer/contracts/snapshots';
import { configuration } from '../../../../game/configuration';
import type { ArmyUnitState } from '../model';
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

type FightPhaseDeps = {
	playerIds: string[];
	getArmyForPlayer: (playerId: string) => ArmyUnitState[] | undefined;
	grantRenown: (playerId: string) => void;
	resolveUnitName: (unitDefId: string) => string;
};

export class FightPhaseRuntime {
	private readonly playerIds: string[];
	private state: FightPhaseStateData;
	private matchSeq = 1;
	private roundRobinCycleIndex = 0;
	private roundRobinRoundCursor = 0;
	private roundRobinRounds: Array<Array<[string, string?]>> = [];
	private firstCycleOpeningSignature: string | null = null;
	private readonly combatReplayByPlayerId = new Map<string, CombatReplaySession>();

	constructor(private readonly deps: FightPhaseDeps) {
		this.playerIds = [...deps.playerIds];
		this.state = this.createEmptyState();
	}

	start(): void {
		const encountersPerPhase = clampIntInRange(configuration.fightPhase.encountersPerPhase, 1, 3);
		const secondsPerRound = Math.max(1, Math.floor(configuration.fightPhase.secondsPerRound));

		this.combatReplayByPlayerId.clear();
		this.state = createFightPhaseState({
			playerIds: this.playerIds,
			encountersPerPhase,
			secondsPerRound,
			nextRoundPairs: () => this.nextRoundRobinPairs(),
			nextMatchId: () => `fight-${this.matchSeq++}`
		});
	}

	advanceTick(): { phaseCompleted: boolean } {
		if (!this.state.isActive) return { phaseCompleted: false };
		if (this.state.secondsToNextRound > 0) {
			this.state.secondsToNextRound -= 1;
		}
		if (this.state.secondsToNextRound > 0) return { phaseCompleted: false };

		this.resolveFightRound(this.state.currentRoundIndex);
		this.state.currentRoundIndex += 1;
		if (this.state.currentRoundIndex >= this.state.encountersPerPhase) {
			this.state.isActive = false;
			this.state.secondsToNextRound = 0;
			return { phaseCompleted: true };
		}

		this.state.secondsToNextRound = this.state.secondsPerRound;
		return { phaseCompleted: false };
	}

	buildFightSnapshotForPlayer(playerId: string) {
		return buildFightSnapshotForPlayer({
			playerId,
			state: this.state,
			getArmyForPlayer: (targetPlayerId) => this.deps.getArmyForPlayer(targetPlayerId) ?? [],
			resolveUnitName: this.deps.resolveUnitName
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

	private resolveFightRound(roundIndex: number): void {
		resolveFightRoundState({
			roundIndex,
			state: this.state,
			getArmyForPlayer: this.deps.getArmyForPlayer,
			grantRenown: this.deps.grantRenown
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
}

function clampIntInRange(value: number, min: number, max: number): number {
	const int = Number.isFinite(value) ? Math.floor(value) : min;
	return Math.max(min, Math.min(max, int));
}
