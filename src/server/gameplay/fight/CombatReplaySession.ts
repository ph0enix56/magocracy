import type { CombatSnapshot } from '../../../shared/domain/combatTypes';
import { CombatSession } from './combatEngine';
import { toCombatUnit } from '../services/CombatService';
import type { ArmyUnitState } from '../model';

/**
 * Manages a step-by-step replay of a previously resolved combat match.
 * Each call to {@link step} advances the simulation by one action, building up
 * the combat log incrementally for client-side replay playback.
 */
export class CombatReplaySession {
	private session: CombatSession | null = null;

	/**
	 * Initialises the replay with two armies from a completed fight round.
	 * Damage bonuses from building effects are included, matching the original resolved combat.
	 */
	start(armyA: ArmyUnitState[], armyB: ArmyUnitState[]): void {
		this.session = new CombatSession(armyA.map(toCombatUnit), armyB.map(toCombatUnit));
	}

	/**
	 * Advances the replay by the given number of steps (default: 1).
	 * Stops early if combat has finished. Throws if no replay is active.
	 */
	step(steps = 1): void {
		if (!this.session) throw new Error('No active combat replay.');
		const count = Math.max(1, Math.floor(steps));
		for (let index = 0; index < count; index += 1) {
			const entry = this.session.step();
			if (!entry) break;
		}
	}

	/** Returns the current replay snapshot, or an idle snapshot if no replay is active. */
	getSnapshot(): CombatSnapshot {
		if (!this.session) {
			return { status: 'idle', round: 0, armyA: [], armyB: [], log: [] };
		}
		return this.session.getSnapshot();
	}
}
