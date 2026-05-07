import type { GameActionCommand } from '../../../shared/multiplayer/commands';
import type { GameSettings } from '../../../shared/multiplayer/snapshots';
import type { ServerGameState } from '../ServerGameState';
import type { ArmyService } from '../services/armyService';
import type { BuildService } from '../services/BuildService';
import type { ProductionService } from '../services/ProductionService';
import type { ShopService } from '../services/ShopService';

export type RuntimePhaseKey = 'advance' | 'build' | 'combat';

export type PhaseTransitionRequest = {
	nextPhase: RuntimePhaseKey;
};

export type PhaseTickResult =
	| { kind: 'continue' }
	| { kind: 'transition'; transition: PhaseTransitionRequest };

/**
 * Result of a phase action handler. `handled` indicates whether the phase recognized the action;
 * `ok` and `reason` convey success or failure; `emitSnapshot` triggers a state broadcast on success.
 */
export type PhaseActionResult =
	| { handled: true; ok: true; emitSnapshot: boolean }
	| { handled: true; ok: false; reason: string }
	| { handled: false };

/**
 * Shared result type for individual action handler methods within a phase.
 * Distinct from {@link PhaseActionResult} — this does not carry the `handled` flag.
 */
export type ActionResult = { ok: true } | { ok: false; reason: string };

/** The per-player state bundle exposed to phase runtimes via {@link RuntimePhaseContext}. */
export type RuntimePlayerState = {
	run: ServerGameState;
	buildService: BuildService;
	armyService: ArmyService;
	productionService: ProductionService;
	shopService: ShopService;
};

/**
 * Contextual data passed to every phase lifecycle method, giving the phase access
 * to player runtimes, current settings, and the current loop index.
 */
export type RuntimePhaseContext = {
	playerIds: string[];
	/** Zero-based count of how many full phase loops (advance→build→combat) have completed. */
	phaseLoopIndex: number;
	settings: GameSettings;
	getPlayerRuntime: (playerId: string) => RuntimePlayerState | undefined;
};

/**
 * Interface implemented by each of the three phase runtimes. Phases are driven by
 * {@link RoomGameRuntime} which calls these methods at the appropriate points in the game loop.
 */
export interface RuntimePhase {
	readonly key: RuntimePhaseKey;
	onEnter(ctx: RuntimePhaseContext): void;
	onExit(ctx: RuntimePhaseContext): void;
	tick(ctx: RuntimePhaseContext): PhaseTickResult;
	tryHandleAction(ctx: RuntimePhaseContext, playerId: string, action: GameActionCommand): PhaseActionResult;
}
