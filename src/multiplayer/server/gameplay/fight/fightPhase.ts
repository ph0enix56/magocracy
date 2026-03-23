import type { FightPairingSnapshot, FightPlayerRoundSnapshot, FightRoundResultSnapshot } from '../../../../shared/multiplayer/contracts/snapshots';
import type { ArmyUnitState } from '../model';
import { CombatService } from '../services/CombatService';

export type FightReplayRecord = {
	matchId: string;
	playerAId: string;
	playerBId: string;
	armyA: ArmyUnitState[];
	armyB: ArmyUnitState[];
};

export type FightPhaseStateData = {
	isActive: boolean;
	encountersPerPhase: number;
	secondsPerRound: number;
	currentRoundIndex: number;
	secondsToNextRound: number;
	pairings: FightPairingSnapshot[];
	results: FightRoundResultSnapshot[];
	playerRoundsByPlayerId: Map<string, FightPlayerRoundSnapshot[]>;
	replaysByMatchId: Map<string, FightReplayRecord>;
};

export function createFightPhaseState(params: {
	playerIds: string[];
	encountersPerPhase: number;
	secondsPerRound: number;
	nextRoundPairs: () => Array<[string, string?]>;
	nextMatchId: () => string;
}): FightPhaseStateData {
	const { playerIds, encountersPerPhase, secondsPerRound, nextRoundPairs, nextMatchId } = params;
	const pairings: FightPairingSnapshot[] = [];
	const results: FightRoundResultSnapshot[] = [];
	const playerRoundsByPlayerId = new Map<string, FightPlayerRoundSnapshot[]>();

	for (const playerId of playerIds) {
		playerRoundsByPlayerId.set(playerId, []);
	}

	for (let roundIndex = 0; roundIndex < encountersPerPhase; roundIndex += 1) {
		const pairs = nextRoundPairs();
		for (const [playerAId, playerBId] of pairs) {
			const matchId = nextMatchId();
			pairings.push({ matchId, roundIndex, playerAId, playerBId });
			results.push({ matchId, roundIndex, playerAId, playerBId, status: 'pending' });

			const listA = playerRoundsByPlayerId.get(playerAId);
			if (listA) {
				listA.push({
					matchId,
					roundIndex,
					opponentPlayerId: playerBId,
					status: playerBId ? 'pending' : 'bye',
					replayAvailable: false,
					selfArmy: [],
					opponentArmy: []
				});
			}

			if (playerBId) {
				const listB = playerRoundsByPlayerId.get(playerBId);
				if (listB) {
					listB.push({
						matchId,
						roundIndex,
						opponentPlayerId: playerAId,
						status: 'pending',
						replayAvailable: false,
						selfArmy: [],
						opponentArmy: []
					});
				}
			}
		}
	}

	return {
		isActive: true,
		encountersPerPhase,
		secondsPerRound,
		currentRoundIndex: 0,
		secondsToNextRound: secondsPerRound,
		pairings,
		results,
		playerRoundsByPlayerId,
		replaysByMatchId: new Map()
	};
}

export function resolveFightRound(params: {
	roundIndex: number;
	state: FightPhaseStateData;
	getArmyForPlayer: (playerId: string) => ArmyUnitState[] | undefined;
	grantRenown: (playerId: string) => void;
}): void {
	const { roundIndex, state, getArmyForPlayer, grantRenown } = params;
	const roundResults = state.results.filter(
		(entry) => entry.roundIndex === roundIndex && entry.status === 'pending'
	);

	for (const result of roundResults) {
		if (!result.playerBId) {
			result.status = 'finished';
			setPlayerRoundResult(state.playerRoundsByPlayerId, result.playerAId, result.matchId, 'bye', false);
			continue;
		}

		const armyAOriginal = getArmyForPlayer(result.playerAId);
		const armyBOriginal = getArmyForPlayer(result.playerBId);
		if (!armyAOriginal || !armyBOriginal) {
			result.status = 'finished';
			continue;
		}

		const armyA = cloneArmy(armyAOriginal);
		const armyB = cloneArmy(armyBOriginal);
		const combat = CombatService.resolveCombat(armyA, armyB);

		result.status = 'finished';
		if (combat.winner === 'armyA') {
			result.winnerPlayerId = result.playerAId;
			grantRenown(result.playerAId);
			setPlayerRoundResult(state.playerRoundsByPlayerId, result.playerAId, result.matchId, 'won', true);
			setPlayerRoundResult(state.playerRoundsByPlayerId, result.playerBId, result.matchId, 'lost', true);
		} else if (combat.winner === 'armyB') {
			result.winnerPlayerId = result.playerBId;
			grantRenown(result.playerBId);
			setPlayerRoundResult(state.playerRoundsByPlayerId, result.playerAId, result.matchId, 'lost', true);
			setPlayerRoundResult(state.playerRoundsByPlayerId, result.playerBId, result.matchId, 'won', true);
		} else {
			setPlayerRoundResult(state.playerRoundsByPlayerId, result.playerAId, result.matchId, 'draw', true);
			setPlayerRoundResult(state.playerRoundsByPlayerId, result.playerBId, result.matchId, 'draw', true);
		}

		state.replaysByMatchId.set(result.matchId, {
			matchId: result.matchId,
			playerAId: result.playerAId,
			playerBId: result.playerBId,
			armyA,
			armyB
		});
	}
}

export function openFightReplayForPlayer(params: {
	playerId: string;
	matchId: string;
	state: FightPhaseStateData;
	startCombat: (selfArmy: ArmyUnitState[], opponentArmy: ArmyUnitState[]) => void;
}): { ok: true } | { ok: false; reason: string } {
	const { playerId, matchId, state, startCombat } = params;
	const replay = state.replaysByMatchId.get(matchId);
	if (!replay) return { ok: false, reason: 'Replay not found for this match.' };
	if (replay.playerAId !== playerId && replay.playerBId !== playerId) {
		return { ok: false, reason: 'You can only open your own match replay.' };
	}

	if (replay.playerAId === playerId) {
		startCombat(cloneArmy(replay.armyA), cloneArmy(replay.armyB));
	} else {
		startCombat(cloneArmy(replay.armyB), cloneArmy(replay.armyA));
	}

	return { ok: true };
}

function setPlayerRoundResult(
	playerRoundsByPlayerId: Map<string, FightPlayerRoundSnapshot[]>,
	playerId: string,
	matchId: string,
	status: FightPlayerRoundSnapshot['status'],
	replayAvailable: boolean
): void {
	const rounds = playerRoundsByPlayerId.get(playerId);
	if (!rounds) return;
	const row = rounds.find((entry) => entry.matchId === matchId);
	if (!row) return;
	row.status = status;
	row.replayAvailable = replayAvailable;
}

function cloneArmy(army: ArmyUnitState[]): ArmyUnitState[] {
	return army.map((unit) => ({
		...unit,
		training: { ...unit.training }
	}));
}
