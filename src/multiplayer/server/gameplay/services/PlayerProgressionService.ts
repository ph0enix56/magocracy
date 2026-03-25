import { configuration } from '../../../../game/configuration';
import type { CharterOption } from '../../../../shared/domain/charter';
import type { GameStandingSnapshot } from '../../../../shared/multiplayer/contracts/snapshots';
import type { WorldStore } from '../ServerEcsWorld';

type PlayerWorldResolver = (playerId: string) => WorldStore | undefined;

export class PlayerProgressionService {
	constructor(private readonly getPlayerWorld: PlayerWorldResolver) {}

	grantRenown(playerId: string): void {
		const world = this.getPlayerWorld(playerId);
		if (!world) return;
		const current = world.resources.get('renown') ?? 0;
		world.resources.set('renown', current + Math.max(0, Math.floor(configuration.fightPhase.renownPerWin)));
	}

	getPlayerRenown(playerId: string): number {
		return this.getPlayerWorld(playerId)?.resources.get('renown') ?? 0;
	}

	applyCharterRewards(playerId: string, charter: CharterOption): void {
		const world = this.getPlayerWorld(playerId);
		if (!world) return;

		for (const grant of charter.resources) {
			const current = world.resources.get(grant.resource) ?? 0;
			world.resources.set(grant.resource, current + Math.max(0, Math.floor(grant.amount)));
		}

		for (const blueprint of charter.blueprints) {
			const current = world.blueprintInventory.get(blueprint.buildingId) ?? 0;
			world.blueprintInventory.set(blueprint.buildingId, current + Math.max(0, Math.floor(blueprint.count)));
		}
	}

	evaluateEndgame(playerIds: string[]): { finished: false } | { finished: true; winnerPlayerId: string; standings: GameStandingSnapshot[] } {
		const targetRenown = Math.max(1, Math.floor(configuration.gameLifecycle.targetRenown));
		const standings = this.buildStandings(playerIds);
		const winner = standings.find((entry) => entry.renown >= targetRenown);
		if (!winner) return { finished: false };
		return { finished: true, winnerPlayerId: winner.playerId, standings };
	}

	buildStandings(playerIds: string[]): GameStandingSnapshot[] {
		return playerIds
			.map((playerId) => ({
				playerId,
				renown: this.getPlayerRenown(playerId)
			}))
			.sort((a, b) => {
				if (b.renown !== a.renown) return b.renown - a.renown;
				return playerIds.indexOf(a.playerId) - playerIds.indexOf(b.playerId);
			})
			.map((entry, index) => ({
				...entry,
				rank: index + 1
			}));
	}
}
