import { configuration } from '../../game/configuration';
import { getBlockingBuildingDefs, getUnitDef } from './config/buildings';
import type { CharterOption } from '../../shared/domain/charter';
import type { CombatSnapshot } from '../../shared/domain/combatTypes';
import type { GameActionCommand } from '../../shared/multiplayer/contracts/commands';
import type {
	AdvanceSnapshot,
	GamePhase,
	GameSnapshot,
	PlayerGameView
} from '../../shared/multiplayer/contracts/snapshots';
import { ServerGameState } from './gameplay/ServerGameState';
import type { ArmyUnitState } from './gameplay/model';
import { routeGameAction } from './gameplay/actions/gameActionRouter';
import { initializeKingdomGrid, revealNeighborTiles } from './gameplay/board/kingdomBoard';
import { AdvancePhaseRuntime } from './gameplay/phases/advancePhaseRuntime';
import { BuildPhaseRuntime } from './gameplay/phases/buildPhaseRuntime';
import { FightPhaseRuntime } from './gameplay/phases/fightPhaseRuntime';
import { ArmyService } from './gameplay/services/ArmyService';
import { BuildService } from './gameplay/services/BuildService';
import { ProductionService } from './gameplay/services/ProductionService';
import { ShopService } from './gameplay/services/ShopService';
import { serializeArmy, serializeInventory, serializeKingdom, serializeResources } from './gameplay/snapshots/playerSnapshot';

type PlayerRuntime = {
	run: ServerGameState;
	buildService: BuildService;
	armyService: ArmyService;
	productionService: ProductionService;
	shopService: ShopService;
};

type RuntimeOptions = {
	onSnapshot: (snapshot: GameSnapshot) => void;
};

export class RoomGameRuntime {
	private readonly players = new Map<string, PlayerRuntime>();
	private readonly playerIds: string[];
	private readonly onSnapshot: (snapshot: GameSnapshot) => void;
	private interval: ReturnType<typeof setInterval> | null = null;
	private tick = 0;
	private phase: GamePhase = 'build';
	private readonly buildPhaseRuntime: BuildPhaseRuntime;
	private readonly fightPhaseRuntime: FightPhaseRuntime;
	private readonly advancePhaseRuntime: AdvancePhaseRuntime;

	constructor(playerIds: string[], options: RuntimeOptions) {
		this.playerIds = [...playerIds];
		this.onSnapshot = options.onSnapshot;
		this.buildPhaseRuntime = new BuildPhaseRuntime({
			revealNeighbors: (runtime, q, r) => this.revealNeighbors(runtime as PlayerRuntime, q, r)
		});
		this.fightPhaseRuntime = new FightPhaseRuntime({
			playerIds: this.playerIds,
			getArmyForPlayer: (playerId) => {
				const runtime = this.players.get(playerId);
				if (!runtime) return undefined;
				return this.getArmyForPlayer(playerId);
			},
			grantRenown: (playerId) => this.grantRenown(playerId),
			resolveUnitName: (unitDefId) => getUnitDef(unitDefId)?.name ?? unitDefId
		});
		this.advancePhaseRuntime = new AdvancePhaseRuntime({
			playerIds: this.playerIds,
			getPlayerRenown: (playerId) => this.players.get(playerId)?.run.world.resources.get('renown') ?? 0,
			applyCharterRewards: (playerId, charter) => this.applyCharterRewards(playerId, charter)
		});
		for (const playerId of playerIds) {
			this.players.set(playerId, this.createPlayerRuntime());
		}
	}

	start(): void {
		if (this.interval) return;
		this.interval = setInterval(() => {
			this.tick += 1;
			if (this.phase === 'build') {
				for (const runtime of this.players.values()) {
					this.buildPhaseRuntime.advanceTick(runtime);
				}
			} else if (this.phase === 'combat') {
				this.advanceFightPhaseTick();
			} else if (this.phase === 'advance') {
				this.advanceAdvancePhaseTick();
			}
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

	startFightPhase(startedByPlayerId: string): { ok: true } | { ok: false; reason: string } {
		if (!this.players.has(startedByPlayerId)) return { ok: false, reason: 'Unknown player game state.' };
		if (this.phase !== 'build') return { ok: false, reason: 'Fight phase can be started only from build phase.' };

		this.phase = 'combat';
		this.fightPhaseRuntime.start();
		this.emitSnapshot();
		return { ok: true };
	}

	startAdvancePhase(startedByPlayerId: string): { ok: true } | { ok: false; reason: string } {
		if (!this.players.has(startedByPlayerId)) return { ok: false, reason: 'Unknown player game state.' };
		if (this.phase !== 'build') return { ok: false, reason: 'Advance phase can be started only from build phase.' };
		if (this.advancePhaseRuntime.isActive()) return { ok: false, reason: 'Advance phase is already active.' };

		this.beginAdvancePhase();
		this.emitSnapshot();
		return { ok: true };
	}

	handleAction(playerId: string, action: GameActionCommand): { ok: true } | { ok: false; reason: string } {
		const runtime = this.players.get(playerId);
		if (!runtime) return { ok: false, reason: 'Unknown player game state.' };

		try {
			const routed = routeGameAction(action, {
				onBuildRequest: (command) => this.buildPhaseRuntime.handleBuildRequest(runtime, command, this.phase),
				onDestroyRequest: (command) => this.buildPhaseRuntime.handleDestroyRequest(runtime, command, this.phase),
				onUpgradeRequest: (command) => this.buildPhaseRuntime.handleUpgradeRequest(runtime, command, this.phase),
				onShopBuy: (command) => this.buildPhaseRuntime.handleShopBuy(runtime, command, this.phase),
				onShopReroll: () => this.buildPhaseRuntime.handleShopReroll(runtime, this.phase),
				onArmyTrain: (command) => this.buildPhaseRuntime.handleArmyTrain(runtime, command, this.phase),
				onArmyReorder: (command) => this.buildPhaseRuntime.handleArmyReorder(runtime, command),
				onCombatStep: (command) => this.handleCombatStep(playerId, command),
				onFightReplayOpen: (command) => this.openFightReplay(playerId, command.matchId),
				onAdvanceSelectCharter: (command) => this.selectAdvanceCharter(playerId, command.charterId)
			});

			if (!routed.ok) return routed;
			if (routed.emitSnapshot) {
				this.emitSnapshot();
			}
			return { ok: true };
		} catch (error) {
			return { ok: false, reason: error instanceof Error ? error.message : String(error) };
		}
	}

	private createPlayerRuntime(): PlayerRuntime {
		const run = new ServerGameState(Date.now() ^ Math.floor(Math.random() * 0xffffffff));
		const buildService = new BuildService(run.world);
		const productionService = new ProductionService(run.world);
		const shopService = new ShopService(run.world);
		const armyService = new ArmyService(run.world);

		shopService.rerollFree();
		initializeKingdomGrid(run.world, this.pickBlockerId);

		return { run, buildService, armyService, productionService, shopService };
	}

	private buildSnapshot(): GameSnapshot {
		return {
			tick: this.tick,
			phase: this.phase,
			players: [...this.players.entries()].map(([playerId, runtime]) => this.buildPlayerView(playerId, runtime))
		};
	}

	private handleCombatStep(
		playerId: string,
		action: Extract<GameActionCommand, { type: 'combat/step' }>
	): { ok: true } | { ok: false; reason: string } {
		return this.fightPhaseRuntime.stepCombatReplay(playerId, action.steps);
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

	private getArmyForPlayer(playerId: string): ArmyUnitState[] {
		const runtime = this.players.get(playerId);
		if (!runtime) return [];
		return runtime.run.world.getOrderedArmyUnits().slice();
	}

	private advanceFightPhaseTick(): void {
		const tickResult = this.fightPhaseRuntime.advanceTick();
		if (tickResult.phaseCompleted) {
			this.beginAdvancePhase();
		}
	}

	private advanceAdvancePhaseTick(): void {
		if (this.phase !== 'advance') return;
		const tickResult = this.advancePhaseRuntime.advanceTick();
		if (tickResult.phaseShouldEnd) {
			this.phase = 'build';
		}
	}

	private grantRenown(playerId: string): void {
		const runtime = this.players.get(playerId);
		if (!runtime) return;
		const current = runtime.run.world.resources.get('renown') ?? 0;
		runtime.run.world.resources.set('renown', current + Math.max(0, Math.floor(configuration.fightPhase.renownPerWin)));
	}

	private openFightReplay(playerId: string, matchId: string): { ok: true } | { ok: false; reason: string } {
		return this.fightPhaseRuntime.openReplay(playerId, matchId);
	}

	private beginAdvancePhase(): void {
		this.phase = 'advance';
		this.advancePhaseRuntime.startPhase();
	}

	private selectAdvanceCharter(playerId: string, charterId: string): { ok: true } | { ok: false; reason: string } {
		if (this.phase !== 'advance') {
			return { ok: false, reason: 'Advance draft is not active.' };
		}
		return this.advancePhaseRuntime.selectCharter(playerId, charterId);
	}

	private applyCharterRewards(playerId: string, charter: CharterOption): void {
		const runtime = this.players.get(playerId);
		if (!runtime) return;

		for (const grant of charter.resources) {
			const current = runtime.run.world.resources.get(grant.resource) ?? 0;
			runtime.run.world.resources.set(grant.resource, current + Math.max(0, Math.floor(grant.amount)));
		}

		for (const blueprint of charter.blueprints) {
			const current = runtime.run.world.blueprintInventory.get(blueprint.buildingId) ?? 0;
			runtime.run.world.blueprintInventory.set(blueprint.buildingId, current + Math.max(0, Math.floor(blueprint.count)));
		}
	}

	private revealNeighbors(runtime: PlayerRuntime, q: number, r: number): void {
		revealNeighborTiles(runtime.run.world, q, r, this.pickBlockerId);
	}

	private pickBlockerId = (): string => {
		const blockers = getBlockingBuildingDefs();
		if (blockers.length === 0) throw new Error('No blocker building defs configured.');
		const index = Math.floor(Math.random() * blockers.length);
		return blockers[index]!.id;
	};
}
