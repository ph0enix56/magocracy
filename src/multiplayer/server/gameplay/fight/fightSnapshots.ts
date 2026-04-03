import type { FightSnapshot } from '../../../../shared/multiplayer/contracts/snapshots';
import type { FightArmyUnitSummary } from '../../../../shared/domain/gameViews';
import type { ArmyUnitState } from '../model';
import type { FightPhaseStateData } from './fightPhase';

export function buildFightSnapshotForPlayer(params: {
	playerId: string;
	state: FightPhaseStateData;
	getArmyForPlayer: (playerId: string) => ArmyUnitState[];
	resolveUnitName: (unitDefId: string) => string;
}): FightSnapshot {
	const { playerId, state, getArmyForPlayer, resolveUnitName } = params;
	const playerRounds = state.playerRoundsByPlayerId.get(playerId) ?? [];
	const enrichedPlayerRounds = playerRounds.map((round) => {
		const selfArmy = summarizeFightArmy(getArmyForPlayer(playerId), resolveUnitName);
		const opponentArmy = round.opponentPlayerId
			? summarizeFightArmy(getArmyForPlayer(round.opponentPlayerId), resolveUnitName)
			: [];
		return {
			...round,
			selfArmy,
			opponentArmy
		};
	});

	return {
		isActive: state.isActive,
		encountersPerPhase: state.encountersPerPhase,
		secondsPerRound: state.secondsPerRound,
		currentRoundIndex: state.currentRoundIndex,
		secondsToNextRound: state.secondsToNextRound,
		pairings: state.pairings,
		results: state.results,
		playerRounds: enrichedPlayerRounds
	};
}

export function summarizeFightArmy(
	units: ArmyUnitState[],
	resolveUnitName: (unitDefId: string) => string
): FightArmyUnitSummary[] {
	return units
		.slice()
		.sort((a, b) => resolveUnitName(a.unitDefId).localeCompare(resolveUnitName(b.unitDefId)))
		.map((unit) => ({
			unitDefId: unit.unitDefId,
			name: resolveUnitName(unit.unitDefId)
		}));
}
