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

export type PhaseActionResult =
	| { handled: true; ok: true; emitSnapshot: boolean }
	| { handled: true; ok: false; reason: string }
	| { handled: false };

export type RuntimePlayerState = {
	run: ServerGameState;
	buildService: BuildService;
	armyService: ArmyService;
	productionService: ProductionService;
	shopService: ShopService;
};

export type RuntimePhaseContext = {
	playerIds: string[];
	phaseLoopIndex: number;
	settings: GameSettings;
	getPlayerRuntime: (playerId: string) => RuntimePlayerState | undefined;
};

export interface RuntimePhase {
	readonly key: RuntimePhaseKey;
	onEnter(ctx: RuntimePhaseContext): void;
	onExit(ctx: RuntimePhaseContext): void;
	tick(ctx: RuntimePhaseContext): PhaseTickResult;
	tryHandleAction(ctx: RuntimePhaseContext, playerId: string, action: GameActionCommand): PhaseActionResult;
}
