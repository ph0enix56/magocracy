import { configuration } from '../../game/configuration';
import { CHARTER_TEMPLATES } from './config/charters';
import { getAllBuildingDefs, getBlockingBuildingDefs, getBuildingDef, getUnitDef } from './config/buildings';
import { kingdomCoordKey } from '../../shared/kingdom/kingdomGrid';
import type { CombatSnapshot } from '../../shared/domain/combatTypes';
import type { GameActionCommand } from '../../shared/multiplayer/contracts/commands';
import type {
	AdvanceSnapshot,
	FightPlayerRoundSnapshot,
	GamePhase,
	GameSnapshot,
	PlayerGameView
} from '../../shared/multiplayer/contracts/snapshots';
import { ServerGameState } from './gameplay/ServerGameState';
import { BuildService } from './gameplay/services/BuildService';
import { ArmyService } from './gameplay/services/ArmyService';
import { ProductionService } from './gameplay/services/ProductionService';
import { ShopService } from './gameplay/services/ShopService';
import type { ArmyUnitState } from './gameplay/model';
import {
	advancePhaseTimers,
	createActiveAdvanceState,
	createEmptyAdvanceState as createEmptyAdvanceStateData,
	pickRandomAvailableCharterId,
	selectAdvanceCharterInState,
	skipAdvancePick,
	type AdvancePhaseStateData
} from './gameplay/advance/advancePhase';
import type { CharterOption as CharterDraftOption } from '../../shared/domain/charter';
import { resolveAdvanceLevel, pickCharterTemplatesForDraft, materializeCharter } from './gameplay/advance/charterDraft';
import { initializeKingdomGrid, revealNeighborTiles } from './gameplay/board/kingdomBoard';
import {
	createFightPhaseState,
	type FightPhaseStateData,
	openFightReplayForPlayer,
	resolveFightRound as resolveFightRoundState
} from './gameplay/fight/fightPhase';
import { buildFightSnapshotForPlayer } from './gameplay/fight/fightSnapshots';
import { buildRoundRobinCycle } from './gameplay/fight/roundRobin';
import { CombatReplaySession } from './gameplay/fight/CombatReplaySession';
import { serializeArmy, serializeInventory, serializeKingdom, serializeResources } from './gameplay/snapshots/playerSnapshot';
import { routeGameAction } from './gameplay/actions/gameActionRouter';

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

type FightRuntimeState = FightPhaseStateData;
type AdvanceRuntimeState = AdvancePhaseStateData;

export class RoomGameRuntime {
	private readonly players = new Map<string, PlayerRuntime>();
	private readonly playerIds: string[];
	private readonly onSnapshot: (snapshot: GameSnapshot) => void;
	private interval: ReturnType<typeof setInterval> | null = null;
	private tick = 0;
	private phase: GamePhase = 'build';
	private matchSeq = 1;
	private roundRobinCycleIndex = 0;
	private roundRobinRoundCursor = 0;
	private roundRobinRounds: Array<Array<[string, string?]>> = [];
	private firstCycleOpeningSignature: string | null = null;
	private fightState!: FightRuntimeState;
	private advanceState!: AdvanceRuntimeState;
	private readonly combatReplayByPlayerId = new Map<string, CombatReplaySession>();
	private advancePhaseIndex = 0;

	constructor(playerIds: string[], options: RuntimeOptions) {
		this.playerIds = [...playerIds];
		this.onSnapshot = options.onSnapshot;
		for (const playerId of playerIds) {
			this.players.set(playerId, this.createPlayerRuntime());
		}
		this.fightState = this.createEmptyFightState();
		this.advanceState = this.createEmptyAdvanceState();
	}

	start(): void {
		if (this.interval) return;
		this.interval = setInterval(() => {
			this.tick += 1;
			if (this.phase === 'build') {
				for (const runtime of this.players.values()) {
					this.advanceBuildPhaseTick(runtime);
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

		const encountersPerPhase = clampIntInRange(configuration.fightPhase.encountersPerPhase, 1, 3);
		const secondsPerRound = Math.max(1, Math.floor(configuration.fightPhase.secondsPerRound));

		this.combatReplayByPlayerId.clear();

		this.phase = 'combat';
		this.fightState = createFightPhaseState({
			playerIds: this.playerIds,
			encountersPerPhase,
			secondsPerRound,
			nextRoundPairs: () => this.nextRoundRobinPairs(),
			nextMatchId: () => `fight-${this.matchSeq++}`
		});

		this.emitSnapshot();
		return { ok: true };
	}

	startAdvancePhase(startedByPlayerId: string): { ok: true } | { ok: false; reason: string } {
		if (!this.players.has(startedByPlayerId)) return { ok: false, reason: 'Unknown player game state.' };
		if (this.phase !== 'build') return { ok: false, reason: 'Advance phase can be started only from build phase.' };
		if (this.advanceState.isActive) return { ok: false, reason: 'Advance phase is already active.' };

		this.beginAdvancePhase();
		this.emitSnapshot();
		return { ok: true };
	}

	handleAction(playerId: string, action: GameActionCommand): { ok: true } | { ok: false; reason: string } {
		const runtime = this.players.get(playerId);
		if (!runtime) return { ok: false, reason: 'Unknown player game state.' };

		try {
			const routed = routeGameAction(action, {
				onBuildRequest: (command) => this.handleBuildRequest(runtime, command),
				onDestroyRequest: (command) => this.handleDestroyRequest(runtime, command),
				onUpgradeRequest: (command) => this.handleUpgradeRequest(runtime, command),
				onShopBuy: (command) => this.handleShopBuy(runtime, command),
				onShopReroll: () => this.handleShopReroll(runtime),
				onArmyTrain: (command) => this.handleArmyTrain(runtime, command),
				onArmyReorder: (command) => this.handleArmyReorder(runtime, command),
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

	private advanceBuildPhaseTick(runtime: PlayerRuntime): void {
		runtime.buildService.advanceTick();
		runtime.productionService.advanceTick();
		runtime.shopService.advanceTick();
		runtime.armyService.advanceTick();
	}

	private handleBuildRequest(
		runtime: PlayerRuntime,
		action: Extract<GameActionCommand, { type: 'build/request' }>
	): { ok: true } | { ok: false; reason: string } {
		if (this.phase !== 'build') return { ok: false, reason: 'Build actions are disabled outside build phase.' };
		const tileId = kingdomCoordKey(action.q, action.r);
		if (!runtime.run.world.getKingdomTile(tileId)) return { ok: false, reason: 'Unknown tile.' };
		runtime.buildService.startBuild(tileId, action.buildingId);
		return { ok: true };
	}

	private handleDestroyRequest(
		runtime: PlayerRuntime,
		action: Extract<GameActionCommand, { type: 'destroy/request' }>
	): { ok: true } | { ok: false; reason: string } {
		if (this.phase !== 'build') return { ok: false, reason: 'Destroy actions are disabled outside build phase.' };
		const tileId = kingdomCoordKey(action.q, action.r);
		const tile = runtime.run.world.getKingdomTile(tileId);
		if (!tile?.building) return { ok: false, reason: 'No building on that tile.' };
		const buildingDef = getBuildingDef(tile.building.buildingId);
		const wasBlocker = buildingDef?.isBlocker === true;
		runtime.buildService.destroyBuilding(tileId);
		if (wasBlocker) {
			this.revealNeighbors(runtime, action.q, action.r);
		}
		return { ok: true };
	}

	private handleUpgradeRequest(
		runtime: PlayerRuntime,
		action: Extract<GameActionCommand, { type: 'upgrade/request' }>
	): { ok: true } | { ok: false; reason: string } {
		if (this.phase !== 'build') return { ok: false, reason: 'Upgrade actions are disabled outside build phase.' };
		const tileId = kingdomCoordKey(action.q, action.r);
		if (!runtime.run.world.getKingdomTile(tileId)) return { ok: false, reason: 'Unknown tile.' };
		runtime.buildService.startUpgrade(tileId, action.upgradeBuildingId);
		return { ok: true };
	}

	private handleShopBuy(
		runtime: PlayerRuntime,
		action: Extract<GameActionCommand, { type: 'shop/buy' }>
	): { ok: true } | { ok: false; reason: string } {
		if (this.phase !== 'build') return { ok: false, reason: 'Shop is disabled outside build phase.' };
		runtime.shopService.buyWithThrow(action.slotIndex);
		return { ok: true };
	}

	private handleShopReroll(runtime: PlayerRuntime): { ok: true } | { ok: false; reason: string } {
		if (this.phase !== 'build') return { ok: false, reason: 'Shop is disabled outside build phase.' };
		runtime.shopService.rerollWithThrow();
		return { ok: true };
	}

	private handleArmyTrain(
		runtime: PlayerRuntime,
		action: Extract<GameActionCommand, { type: 'army/train' }>
	): { ok: true } | { ok: false; reason: string } {
		if (this.phase !== 'build') return { ok: false, reason: 'Training is disabled outside build phase.' };
		runtime.armyService.startTrainingWithThrow(action.unitEntityId);
		return { ok: true };
	}

	private handleArmyReorder(
		runtime: PlayerRuntime,
		action: Extract<GameActionCommand, { type: 'army/reorder' }>
	): { ok: true } | { ok: false; reason: string } {
		runtime.run.world.reorderArmyUnitWithThrow(action.unitEntityId, action.direction);
		return { ok: true };
	}

	private handleCombatStep(
		playerId: string,
		action: Extract<GameActionCommand, { type: 'combat/step' }>
	): { ok: true } | { ok: false; reason: string } {
		const replay = this.combatReplayByPlayerId.get(playerId);
		if (!replay) return { ok: false, reason: 'No active combat replay.' };
		replay.step(action.steps ?? 1);
		return { ok: true };
	}

	private getCombatSnapshotForPlayer(playerId: string): CombatSnapshot {
		const replay = this.combatReplayByPlayerId.get(playerId);
		if (!replay) {
			return { status: 'idle', round: 0, activeSide: 'armyA', armyA: [], armyB: [], log: [] };
		}
		return replay.getSnapshot();
	}

	private buildPlayerView(playerId: string, runtime: PlayerRuntime): PlayerGameView {
		const tiles = runtime.run.world.getKingdomTiles();
		return {
			playerId,
			resources: serializeResources(runtime.run.world.resources),
			blueprints: serializeInventory(runtime.run.world.blueprintInventory),
			shop: runtime.shopService.getState(),
			kingdom: serializeKingdom(tiles, runtime.productionService),
			army: serializeArmy(
				runtime.run.world.getOrderedArmyUnits(),
				tiles
			),
			combat: this.getCombatSnapshotForPlayer(playerId),
			fight: buildFightSnapshotForPlayer({
				playerId,
				state: this.fightState,
				getArmyForPlayer: (targetPlayerId) => this.getArmyForPlayer(targetPlayerId),
				resolveUnitName: (unitDefId) => getUnitDef(unitDefId)?.name ?? unitDefId
			}),
			advance: this.buildPlayerAdvanceSnapshot()
		};
	}

	private buildPlayerAdvanceSnapshot(): AdvanceSnapshot {
		const currentPickerPlayerId = this.advanceState.pickOrderPlayerIds[this.advanceState.currentPickIndex];
		return {
			isActive: this.advanceState.isActive,
			level: this.advanceState.level,
			pickOrderPlayerIds: this.advanceState.pickOrderPlayerIds,
			currentPickerPlayerId,
			secondsPerPick: this.advanceState.secondsPerPick,
			secondsRemaining: this.advanceState.secondsRemaining,
			revealDelaySeconds: this.advanceState.revealDelaySeconds,
			secondsToPhaseEnd: this.advanceState.secondsToPhaseEnd,
			charters: this.advanceState.charters
		};
	}

	private getArmyForPlayer(playerId: string): ArmyUnitState[] {
		const runtime = this.players.get(playerId);
		if (!runtime) return [];
		return runtime.run.world.getOrderedArmyUnits().slice();
	}

	private advanceFightPhaseTick(): void {
		if (!this.fightState.isActive) return;
		if (this.fightState.secondsToNextRound > 0) {
			this.fightState.secondsToNextRound -= 1;
		}
		if (this.fightState.secondsToNextRound > 0) return;

		this.resolveFightRound(this.fightState.currentRoundIndex);
		this.fightState.currentRoundIndex += 1;
		if (this.fightState.currentRoundIndex >= this.fightState.encountersPerPhase) {
			this.fightState.isActive = false;
			this.fightState.secondsToNextRound = 0;
			this.beginAdvancePhase();
			return;
		}

		this.fightState.secondsToNextRound = this.fightState.secondsPerRound;
	}

	private advanceAdvancePhaseTick(): void {
		if (!this.advanceState.isActive || this.phase !== 'advance') return;

		const timerResult = advancePhaseTimers(this.advanceState);
		if (timerResult.phaseShouldEnd) {
			this.phase = 'build';
			this.advanceState = this.createEmptyAdvanceState();
			return;
		}
		if (!timerResult.autoPickPlayerId) return;
		this.autoPickAdvanceCharter(timerResult.autoPickPlayerId);
	}

	private resolveFightRound(roundIndex: number): void {
		resolveFightRoundState({
			roundIndex,
			state: this.fightState,
			getArmyForPlayer: (playerId) => {
				const runtime = this.players.get(playerId);
				if (!runtime) return undefined;
				return this.getArmyForPlayer(playerId);
			},
			grantRenown: (playerId) => this.grantRenown(playerId)
		});
	}

	private grantRenown(playerId: string): void {
		const runtime = this.players.get(playerId);
		if (!runtime) return;
		const current = runtime.run.world.resources.get('renown') ?? 0;
		runtime.run.world.resources.set('renown', current + Math.max(0, Math.floor(configuration.fightPhase.renownPerWin)));
	}

	private openFightReplay(
		playerId: string,
		matchId: string
	): { ok: true } | { ok: false; reason: string } {
		return openFightReplayForPlayer({
			playerId,
			matchId,
			state: this.fightState,
			startCombat: (selfArmy, opponentArmy) => {
				const replay = new CombatReplaySession();
				replay.start(selfArmy, opponentArmy);
				this.combatReplayByPlayerId.set(playerId, replay);
			}
		});
	}

	private nextRoundRobinPairs(): Array<[string, string?]> {
		if (this.roundRobinRounds.length === 0 || this.roundRobinRoundCursor >= this.roundRobinRounds.length) {
			this.roundRobinRounds = this.buildRoundRobinRoundsForCycle(this.roundRobinCycleIndex);
			this.roundRobinRoundCursor = 0;
			this.roundRobinCycleIndex += 1;
		}
		const round = this.roundRobinRounds[this.roundRobinRoundCursor] ?? [];
		this.roundRobinRoundCursor += 1;
		return round;
	}

	private buildRoundRobinRoundsForCycle(cycleIndex: number): Array<Array<[string, string?]>> {
		const cycle = buildRoundRobinCycle({
			playerIds: this.playerIds,
			cycleIndex,
			firstCycleOpeningSignature: this.firstCycleOpeningSignature
		});
		this.firstCycleOpeningSignature = cycle.firstCycleOpeningSignature;
		return cycle.rounds;
	}

	private createEmptyFightState(): FightRuntimeState {
		const playerRoundsByPlayerId = new Map<string, FightPlayerRoundSnapshot[]>();
		for (const playerId of this.playerIds ?? []) {
			playerRoundsByPlayerId.set(playerId, []);
		}
		return {
			isActive: false,
			encountersPerPhase: clampIntInRange(configuration.fightPhase.encountersPerPhase, 1, 3),
			secondsPerRound: Math.max(1, Math.floor(configuration.fightPhase.secondsPerRound)),
			currentRoundIndex: 0,
			secondsToNextRound: 0,
			pairings: [],
			results: [],
			playerRoundsByPlayerId,
			replaysByMatchId: new Map()
		};
	}

	private createEmptyAdvanceState(): AdvanceRuntimeState {
		return createEmptyAdvanceStateData({
			secondsPerPick: configuration.advancePhase.secondsPerPick,
			revealDelaySeconds: configuration.advancePhase.revealSecondsAfterDraft
		});
	}

	private revealNeighbors(runtime: PlayerRuntime, q: number, r: number): void {
		revealNeighborTiles(runtime.run.world, q, r, this.pickBlockerId);
	}

	private beginAdvancePhase(): void {
		const level = resolveAdvanceLevel(this.advancePhaseIndex, configuration.advancePhase.levelByAdvanceIndex);
		const desiredCount = Math.min(9, Math.max(1, this.playerIds.length + configuration.advancePhase.charterCountBonus));
		const charterTemplates = pickCharterTemplatesForDraft(CHARTER_TEMPLATES, level, desiredCount);
		const allBuildings = getAllBuildingDefs();
		const charters = charterTemplates.map((template, index) => materializeCharter(template, index + 1, allBuildings));
		const pickOrderPlayerIds = [...this.playerIds].sort((a, b) => {
			const aRenown = this.players.get(a)?.run.world.resources.get('renown') ?? 0;
			const bRenown = this.players.get(b)?.run.world.resources.get('renown') ?? 0;
			if (aRenown !== bRenown) return aRenown - bRenown;
			return this.playerIds.indexOf(a) - this.playerIds.indexOf(b);
		});

		this.phase = 'advance';
		this.advanceState = createActiveAdvanceState({
			level,
			pickOrderPlayerIds,
			charters,
			secondsPerPick: configuration.advancePhase.secondsPerPick,
			revealDelaySeconds: configuration.advancePhase.revealSecondsAfterDraft
		});
		this.advancePhaseIndex += 1;
	}

	private selectAdvanceCharter(playerId: string, charterId: string): { ok: true } | { ok: false; reason: string } {
		if (this.phase !== 'advance' || !this.advanceState.isActive) {
			return { ok: false, reason: 'Advance draft is not active.' };
		}

		const result = selectAdvanceCharterInState(this.advanceState, playerId, charterId);
		if (!result.ok) return result;
		this.applyCharterRewards(playerId, result.selectedCharter);
		return { ok: true };
	}

	private autoPickAdvanceCharter(playerId: string): void {
		const charterId = pickRandomAvailableCharterId(this.advanceState);
		if (!charterId) {
			skipAdvancePick(this.advanceState);
			return;
		}
		this.selectAdvanceCharter(playerId, charterId);
	}

	private applyCharterRewards(playerId: string, charter: CharterDraftOption): void {
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

	private pickBlockerId = (): string => {
		const blockers = getBlockingBuildingDefs();
		if (blockers.length === 0) throw new Error('No blocker building defs configured.');
		const index = Math.floor(Math.random() * blockers.length);
		return blockers[index]!.id;
	};
}

function clampIntInRange(value: number, min: number, max: number): number {
	const int = Number.isFinite(value) ? Math.floor(value) : min;
	return Math.max(min, Math.min(max, int));
}
