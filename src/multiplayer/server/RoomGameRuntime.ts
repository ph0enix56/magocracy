import { configuration } from '../../game/configuration';
import type { CombatSnapshot } from '../../shared/domain/combatTypes';
import type { GameActionCommand } from '../../shared/multiplayer/contracts/commands';
import type {
	AdvanceSnapshot,
	GameStandingSnapshot,
	GameStatus,
	GamePhase,
	GameSnapshot,
	PlayerGameView
} from '../../shared/multiplayer/contracts/snapshots';
import { AdvancePhaseRuntime } from './gameplay/phases/advancePhaseRuntime';
import { BuildPhaseRuntime } from './gameplay/phases/buildPhaseRuntime';
import { FightPhaseRuntime } from './gameplay/phases/fightPhaseRuntime';
import type { PhaseActionResult, RuntimePhase, RuntimePhaseContext, RuntimePhaseKey } from './gameplay/phases/runtimePhase';
import { PlayerProgressionService } from './gameplay/services/PlayerProgressionService';
import { PlayerRuntimeFactory, type PlayerRuntimeBundle } from './gameplay/services/PlayerRuntimeFactory';
import { serializeArmy, serializeInventory, serializeKingdom, serializeResources } from './gameplay/snapshots/playerSnapshot';

type PlayerRuntime = PlayerRuntimeBundle;

export class RoomGameRuntime {
	private readonly players = new Map<string, PlayerRuntime>();
	private readonly playerIds: string[];
	private readonly onSnapshot: (snapshot: GameSnapshot) => void;
	private readonly playerRuntimeFactory: PlayerRuntimeFactory;
	private readonly progressionService: PlayerProgressionService;
	private interval: ReturnType<typeof setInterval> | null = null;
	private tick = 0;
	private phase: GamePhase = 'setup';
	private gameStatus: GameStatus = 'running';
	private winnerPlayerId: string | undefined;
	private finalStandings: GameStandingSnapshot[] = [];
	private readonly buildPhaseRuntime: BuildPhaseRuntime;
	private readonly fightPhaseRuntime: FightPhaseRuntime;
	private readonly advancePhaseRuntime: AdvancePhaseRuntime;
	private readonly phaseByKey: Record<RuntimePhaseKey, RuntimePhase>;
	private activePhase: RuntimePhase | null = null;

	constructor(playerIds: string[], onSnapshot: (snapshot: GameSnapshot) => void) {
		this.playerIds = [...playerIds];
		this.onSnapshot = onSnapshot;
		this.playerRuntimeFactory = new PlayerRuntimeFactory();
		this.progressionService = new PlayerProgressionService((playerId) => this.players.get(playerId)?.run.world);
		this.buildPhaseRuntime = new BuildPhaseRuntime();
		this.fightPhaseRuntime = new FightPhaseRuntime();
		this.advancePhaseRuntime = new AdvancePhaseRuntime();
		for (const playerId of playerIds) {
			this.players.set(playerId, this.playerRuntimeFactory.create());
		}
		this.phaseByKey = {
			advance: this.advancePhaseRuntime,
			build: this.buildPhaseRuntime,
			combat: this.fightPhaseRuntime
		};
	}

	start(): void {
		if (this.interval) return;
		this.transitionTo('advance');
		this.interval = setInterval(() => {
			if (this.gameStatus === 'finished') {
				this.emitSnapshot();
				return;
			}

			this.tick += 1;
			const activePhase = this.activePhase;
			if (activePhase) {
				const tickResult = activePhase.tick(this.buildPhaseContext());
				if (tickResult.kind === 'transition') {
					this.transitionTo(tickResult.transition.nextPhase);
				}
			}

			this.evaluateEndgame();
			this.emitSnapshot();
		}, configuration.loop.tickIntervalMs);
	}

	stop(): void {
		if (!this.interval) return;
		clearInterval(this.interval);
		this.interval = null;
	}

	emitSnapshot(): GameSnapshot {
		const snapshot = this.buildSnapshot();
		this.onSnapshot(snapshot);
		return snapshot;
	}

	handleAction(playerId: string, action: GameActionCommand): { ok: true } | { ok: false; reason: string } {
		if (this.gameStatus === 'finished') {
			return { ok: false, reason: 'The match has already finished.' };
		}
		if (!this.players.has(playerId)) return { ok: false, reason: 'Unknown player game state.' };
		const activePhase = this.activePhase;
		if (!activePhase) return { ok: false, reason: 'No active gameplay phase.' };

		try {
			const phaseResult = activePhase.tryHandleAction(this.buildPhaseContext(), playerId, action);
			const handled = phaseResult.handled ? phaseResult : this.tryHandleGlobalAction(playerId, action);

			if (!handled.handled) {
				return { ok: false, reason: 'Action is unavailable in the current phase.' };
			}
			if (!handled.ok) {
				return { ok: false, reason: handled.reason };
			}

			this.evaluateEndgame();
			if (handled.emitSnapshot) {
				this.emitSnapshot();
			}
			return { ok: true };
		} catch (error) {
			return { ok: false, reason: error instanceof Error ? error.message : String(error) };
		}
	}

	private buildSnapshot(): GameSnapshot {
		return {
			tick: this.tick,
			phase: this.phase,
			status: this.gameStatus,
			targetRenown: Math.max(1, Math.floor(configuration.gameLifecycle.targetRenown)),
			winnerPlayerId: this.winnerPlayerId,
			finalStandings: this.finalStandings,
			buildPhaseSecondsRemaining: this.phase === 'build' ? this.buildPhaseRuntime.getSecondsRemaining() : 0,
			players: [...this.players.entries()].map(([playerId, runtime]) => this.buildPlayerView(playerId, runtime))
		};
	}

	private getCombatSnapshotForPlayer(playerId: string): CombatSnapshot {
		return this.fightPhaseRuntime.getCombatSnapshotForPlayer(playerId);
	}

	private buildPlayerView(playerId: string, runtime: PlayerRuntime): PlayerGameView {
		const tiles = runtime.run.world.getKingdomTiles();
		return {
			playerId,
			resources: serializeResources(runtime.run.world.resources),
			blueprints: serializeInventory(runtime.run.world.blueprintInventory),
			shop: runtime.shopService.getState(),
			kingdom: serializeKingdom(tiles, runtime.productionService),
			army: serializeArmy(runtime.run.world.getOrderedArmyUnits(), tiles),
			combat: this.getCombatSnapshotForPlayer(playerId),
			fight: this.fightPhaseRuntime.buildFightSnapshotForPlayer(playerId),
			advance: this.buildPlayerAdvanceSnapshot()
		};
	}

	private buildPlayerAdvanceSnapshot(): AdvanceSnapshot {
		return this.advancePhaseRuntime.buildSnapshot();
	}

	private evaluateEndgame(): void {
		if (this.gameStatus === 'finished') return;
		const evaluation = this.progressionService.evaluateEndgame(this.playerIds);
		if (!evaluation.finished) {
			this.finalStandings = [];
			return;
		}

		this.gameStatus = 'finished';
		this.winnerPlayerId = evaluation.winnerPlayerId;
		this.finalStandings = evaluation.standings;
		this.stop();
	}

	private transitionTo(nextPhase: RuntimePhaseKey): void {
		const context = this.buildPhaseContext();
		if (this.activePhase) {
			this.activePhase.onExit(context);
		}
		const next = this.phaseByKey[nextPhase];
		this.activePhase = next;
		this.phase = nextPhase;
		next.onEnter(context);
	}

	private buildPhaseContext(): RuntimePhaseContext {
		return {
			playerIds: this.playerIds,
			getPlayerRuntime: (playerId) => this.players.get(playerId),
			resolveBuildPhaseDurationSeconds: () => this.resolveBuildPhaseDurationSeconds(),
			resolveBuildTickIntervalSeconds: () => this.resolveBuildTickIntervalSeconds()
		};
	}

	private tryHandleGlobalAction(playerId: string, action: GameActionCommand): PhaseActionResult {
		if (action.type !== 'army/reorder') {
			return { handled: false };
		}
		const runtime = this.players.get(playerId);
		if (!runtime) {
			return { handled: true, ok: false, reason: 'Unknown player game state.' };
		}
		runtime.run.world.reorderArmyUnitWithThrow(action.unitEntityId, action.direction);
		return { handled: true, ok: true, emitSnapshot: true };
	}

	private resolveBuildPhaseDurationSeconds(): number {
		return Math.max(1, Math.floor(configuration.buildPhase.durationSeconds));
	}

	private resolveBuildTickIntervalSeconds(): number {
		return Math.max(1, Math.floor(configuration.buildPhase.secondsPerTick));
	}
}
