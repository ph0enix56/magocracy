import { configuration } from '../../game/configuration';
import { CHARTER_TEMPLATES } from './config/charters';
import { getAllBuildingDefs, getBlockingBuildingDefs, getBuildingDef } from './config/buildings';
import { kingdomCoordKey } from '../../shared/kingdom/kingdomGrid';
import type {
	AdvanceSnapshot,
	CharterSnapshot,
	FightPlayerRoundSnapshot,
	GameActionCommand,
	GamePhase,
	GameSnapshot,
	PlayerGameView
} from '../../shared/multiplayer/protocol';
import { ServerGameState } from './gameplay/ServerGameState';
import { BuildSystem } from './gameplay/systems/BuildSystem';
import { ArmySystem } from './gameplay/systems/ArmySystem';
import { ProductionSystem } from './gameplay/systems/ProductionSystem';
import { ShopSystem } from './gameplay/systems/ShopSystem';
import type { ArmyUnitComponent } from './gameplay/model';
import {
	advancePhaseTimers,
	createActiveAdvanceState,
	createEmptyAdvanceState as createEmptyAdvanceStateData,
	pickRandomAvailableCharterId,
	selectAdvanceCharterInState,
	skipAdvancePick,
	type AdvancePhaseStateData
} from './gameplay/advance/advancePhase';
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
import { serializeArmy, serializeInventory, serializeKingdom, serializeResources } from './gameplay/snapshots/playerSnapshot';

type PlayerRuntime = {
	run: ServerGameState;
	buildSystem: BuildSystem;
	armySystem: ArmySystem;
	productionSystem: ProductionSystem;
	shopSystem: ShopSystem;
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
					runtime.run.advanceTick();
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

		for (const playerId of this.playerIds) {
			this.players.get(playerId)?.run.combatSystem.resetCombat();
		}

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
			switch (action.type) {
				case 'build/request': {
					if (this.phase !== 'build') return { ok: false, reason: 'Build actions are disabled outside build phase.' };
					const entity = runtime.run.ecs.getEntity(kingdomCoordKey(action.q, action.r));
					if (!entity) return { ok: false, reason: 'Unknown tile.' };
					runtime.buildSystem.startBuild(entity, action.buildingId);
					break;
				}
				case 'destroy/request': {
					if (this.phase !== 'build') return { ok: false, reason: 'Destroy actions are disabled outside build phase.' };
					const entity = runtime.run.ecs.getEntity(kingdomCoordKey(action.q, action.r));
					if (!entity?.building) return { ok: false, reason: 'No building on that tile.' };
					const buildingDef = getBuildingDef(entity.building.buildingId);
					const wasBlocker = buildingDef?.isBlocker === true;
					runtime.buildSystem.destroyBuilding(entity);
					if (wasBlocker) {
						this.revealNeighbors(runtime, action.q, action.r);
					}
					break;
				}
				case 'upgrade/request': {
					if (this.phase !== 'build') return { ok: false, reason: 'Upgrade actions are disabled outside build phase.' };
					const entity = runtime.run.ecs.getEntity(kingdomCoordKey(action.q, action.r));
					if (!entity) return { ok: false, reason: 'Unknown tile.' };
					runtime.buildSystem.startUpgrade(entity, action.upgradeBuildingId);
					break;
				}
				case 'shop/buy':
					if (this.phase !== 'build') return { ok: false, reason: 'Shop is disabled outside build phase.' };
					runtime.shopSystem.buyWithThrow(action.slotIndex);
					break;
				case 'shop/reroll':
					if (this.phase !== 'build') return { ok: false, reason: 'Shop is disabled outside build phase.' };
					runtime.shopSystem.rerollWithThrow();
					break;
				case 'army/train':
					if (this.phase !== 'build') return { ok: false, reason: 'Training is disabled outside build phase.' };
					runtime.armySystem.startTrainingWithThrow(action.unitEntityId);
					break;
				case 'army/reorder':
					runtime.run.ecs.reorderArmyUnitWithThrow(action.unitEntityId, action.direction);
					break;
				case 'combat/step':
					runtime.run.combatSystem.stepCombat(action.steps ?? 1);
					break;
				case 'fight/replay-open':
					return this.openFightReplay(playerId, runtime, action.matchId);
				case 'advance/select-charter':
					return this.selectAdvanceCharter(playerId, action.charterId);
			}
		} catch (error) {
			return { ok: false, reason: error instanceof Error ? error.message : String(error) };
		}

		this.emitSnapshot();
		return { ok: true };
	}

	private createPlayerRuntime(): PlayerRuntime {
		const run = new ServerGameState(Date.now() ^ Math.floor(Math.random() * 0xffffffff));
		const buildSystem = new BuildSystem(run.ecs);
		const productionSystem = new ProductionSystem(run.ecs);
		const shopSystem = new ShopSystem(run.ecs);
		const armySystem = new ArmySystem(run.ecs);

		run.ecs.addSystem(buildSystem);
		run.ecs.addSystem(productionSystem);
		run.ecs.addSystem(shopSystem);
		run.ecs.addSystem(armySystem);
		shopSystem.rerollFree();
		initializeKingdomGrid(run.ecs, this.pickBlockerId);

		return { run, buildSystem, armySystem, productionSystem, shopSystem };
	}

	private buildSnapshot(): GameSnapshot {
		return {
			tick: this.tick,
			phase: this.phase,
			players: [...this.players.entries()].map(([playerId, runtime]) => this.buildPlayerView(playerId, runtime))
		};
	}

	private buildPlayerView(playerId: string, runtime: PlayerRuntime): PlayerGameView {
		const positionedEntities = runtime.run.ecs.getEntitiesWith(['position']);
		return {
			playerId,
			resources: serializeResources(runtime.run.ecs.resources),
			blueprints: serializeInventory(runtime.run.ecs.blueprintInventory),
			shop: runtime.shopSystem.getState(),
			kingdom: serializeKingdom(positionedEntities, runtime.productionSystem),
			army: serializeArmy(
				runtime.run.ecs.getOrderedArmyUnitEntities().map((entity) => ({ entityId: entity.id, unit: entity.armyUnit! })),
				positionedEntities
			),
			combat: runtime.run.combatSystem.getSnapshot(),
			fight: buildFightSnapshotForPlayer({
				playerId,
				state: this.fightState,
				getArmyForPlayer: (targetPlayerId) => this.getArmyForPlayer(targetPlayerId)
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

	private getArmyForPlayer(playerId: string): ArmyUnitComponent[] {
		const runtime = this.players.get(playerId);
		if (!runtime) return [];
		return runtime.run.ecs
			.getOrderedArmyUnitEntities()
			.map((entity) => entity.armyUnit)
			.filter((unit): unit is ArmyUnitComponent => !!unit)
			.slice();
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
		const current = runtime.run.ecs.resources.get('renown') ?? 0;
		runtime.run.ecs.resources.set('renown', current + Math.max(0, Math.floor(configuration.fightPhase.renownPerWin)));
	}

	private openFightReplay(
		playerId: string,
		runtime: PlayerRuntime,
		matchId: string
	): { ok: true } | { ok: false; reason: string } {
		return openFightReplayForPlayer({
			playerId,
			matchId,
			state: this.fightState,
			startCombat: (selfArmy, opponentArmy) => runtime.run.combatSystem.startCombat(selfArmy, opponentArmy)
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
		revealNeighborTiles(runtime.run.ecs, q, r, this.pickBlockerId);
	}

	private beginAdvancePhase(): void {
		const level = resolveAdvanceLevel(this.advancePhaseIndex, configuration.advancePhase.levelByAdvanceIndex);
		const desiredCount = Math.min(9, Math.max(1, this.playerIds.length + configuration.advancePhase.charterCountBonus));
		const charterTemplates = pickCharterTemplatesForDraft(CHARTER_TEMPLATES, level, desiredCount);
		const allBuildings = getAllBuildingDefs();
		const charters = charterTemplates.map((template, index) => materializeCharter(template, index + 1, allBuildings));
		const pickOrderPlayerIds = [...this.playerIds].sort((a, b) => {
			const aRenown = this.players.get(a)?.run.ecs.resources.get('renown') ?? 0;
			const bRenown = this.players.get(b)?.run.ecs.resources.get('renown') ?? 0;
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

	private applyCharterRewards(playerId: string, charter: CharterSnapshot): void {
		const runtime = this.players.get(playerId);
		if (!runtime) return;

		for (const grant of charter.resources) {
			const current = runtime.run.ecs.resources.get(grant.resource) ?? 0;
			runtime.run.ecs.resources.set(grant.resource, current + Math.max(0, Math.floor(grant.amount)));
		}

		for (const blueprint of charter.blueprints) {
			const current = runtime.run.ecs.blueprintInventory.get(blueprint.buildingId) ?? 0;
			runtime.run.ecs.blueprintInventory.set(blueprint.buildingId, current + Math.max(0, Math.floor(blueprint.count)));
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