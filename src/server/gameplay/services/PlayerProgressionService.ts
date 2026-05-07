import { serverConfig } from '../../config/serverConfig';
import type { CharterOption } from '../../../shared/domain/charter';
import type { GameSettings, GameStandingSnapshot } from '../../../shared/multiplayer/snapshots';
import type { WorldStore } from '../WorldStore';

type PlayerWorldResolver = (playerId: string) => WorldStore | undefined;

/**
 * Tracks player renown progression, determines win conditions, and applies charter rewards.
 * Operates on player worlds through a resolver to avoid direct coupling to the player map.
 */
export class PlayerProgressionService {
	constructor(
		private readonly getPlayerWorld: PlayerWorldResolver,
		private readonly settings: GameSettings
	) {}

	grantRenown(playerId: string): void {
		const world = this.getPlayerWorld(playerId);
		if (!world) return;
		const current = world.resources.get('renown') ?? 0;
		world.resources.set('renown', current + Math.max(0, Math.floor(serverConfig.fightPhase.renownPerWin)));
	}

	getPlayerRenown(playerId: string): number {
		return this.getPlayerWorld(playerId)?.resources.get('renown') ?? 0;
	}

	/**
	 * Applies all resource and blueprint grants from a selected charter to a player's world.
	 * Amounts are floored and negative grants are ignored.
	 */
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

	/**
	 * Checks whether any player has reached the target renown threshold.
	 * Returns the winner and final standings if the game is over, otherwise `{ finished: false }`.
	 */
	evaluateEndgame(playerIds: string[]): { finished: false } | { finished: true; winnerPlayerId: string; standings: GameStandingSnapshot[] } {
		const targetRenown = Math.max(1, Math.floor(this.settings.gameLifecycle.targetRenown));
		const standings = this.buildStandings(playerIds);
		const winner = standings.find((entry) => entry.renown >= targetRenown);
		if (!winner) return { finished: false };
		return { finished: true, winnerPlayerId: winner.playerId, standings };
	}

	/**
	 * Returns a sorted array of player standings, ordered by renown descending.
	 * Ties are broken by original player insertion order.
	 */
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
