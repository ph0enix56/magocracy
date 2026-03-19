import type { FightArmyUnitSummarySnapshot, FightSnapshot } from '../../../../shared/multiplayer/protocol';
import type { ArmyUnitComponent } from '../model';
import type { FightPhaseStateData } from './fightPhase';

export function buildFightSnapshotForPlayer(params: {
	playerId: string;
	state: FightPhaseStateData;
	getArmyForPlayer: (playerId: string) => ArmyUnitComponent[];
}): FightSnapshot {
	const { playerId, state, getArmyForPlayer } = params;
	const playerRounds = state.playerRoundsByPlayerId.get(playerId) ?? [];
	const enrichedPlayerRounds = playerRounds.map((round) => {
		const selfArmy = summarizeFightArmy(getArmyForPlayer(playerId));
		const opponentArmy = round.opponentPlayerId
			? summarizeFightArmy(getArmyForPlayer(round.opponentPlayerId))
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

export function summarizeFightArmy(units: ArmyUnitComponent[]): FightArmyUnitSummarySnapshot[] {
	return units
		.slice()
		.sort((a, b) => {
			if (b.trainingLevel !== a.trainingLevel) return b.trainingLevel - a.trainingLevel;
			return a.name.localeCompare(b.name);
		})
		.map((unit) => ({
			unitId: unit.unitId,
			name: unit.name,
			trainingLevel: unit.trainingLevel
		}));
}
