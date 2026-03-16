import { configuration } from '../../game/configuration';
import { CHARTER_TEMPLATES, type CharterTemplateDef } from './config/charters';
import { getAllBuildingDefs, getBlockingBuildings, getBuildingDef, type BuildingDef } from './config/buildings';
import { createInitialKingdomTiles, createRevealTilesAround, kingdomCoordKey } from '../../shared/kingdom/kingdomGrid';
import type {
	AdvanceSnapshot,
	ArmyUnitSnapshot,
	CharterBlueprintGrantSnapshot,
	CharterSnapshot,
	FightArmyUnitSummarySnapshot,
	FightPairingSnapshot,
	FightPlayerRoundSnapshot,
	FightRoundResultSnapshot,
	GameActionCommand,
	GamePhase,
	GameSnapshot,
	KingdomSnapshot,
	PlayerGameView,
	ResourceSnapshot
} from '../../shared/multiplayer/protocol';
import { ServerGameState } from './gameplay/ServerGameState';
import { BuildSystem } from './gameplay/systems/BuildSystem';
import { ArmySystem } from './gameplay/systems/ArmySystem';
import { ProductionSystem } from './gameplay/systems/ProductionSystem';
import { ShopSystem } from './gameplay/systems/ShopSystem';
import type { ArmyUnitComponent, Entity } from './gameplay/model';
import { CombatSystem } from './gameplay/systems/CombatSystem';

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

type FightReplayRecord = {
	matchId: string;
	playerAId: string;
	playerBId: string;
	armyA: ArmyUnitComponent[];
	armyB: ArmyUnitComponent[];
};

type FightRuntimeState = {
	isActive: boolean;
	encountersPerPhase: number;
	secondsPerRound: number;
	currentRoundIndex: number;
	secondsToNextRound: number;
	pairings: FightPairingSnapshot[];
	results: FightRoundResultSnapshot[];
	playerRoundsByPlayerId: Map<string, FightPlayerRoundSnapshot[]>;
	replaysByMatchId: Map<string, FightReplayRecord>;
};

type AdvanceRuntimeState = {
	isActive: boolean;
	level: number;
	pickOrderPlayerIds: string[];
	currentPickIndex: number;
	secondsPerPick: number;
	secondsRemaining: number;
	revealDelaySeconds: number;
	secondsToPhaseEnd: number;
	charters: CharterSnapshot[];
};

const BYE_PLAYER_ID = '__bye__';

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
		const pairings: FightPairingSnapshot[] = [];
		const results: FightRoundResultSnapshot[] = [];
		const playerRoundsByPlayerId = new Map<string, FightPlayerRoundSnapshot[]>();

		for (const playerId of this.playerIds) {
			playerRoundsByPlayerId.set(playerId, []);
			this.players.get(playerId)?.run.combatSystem.resetCombat();
		}

		for (let roundIndex = 0; roundIndex < encountersPerPhase; roundIndex += 1) {
			const pairs = this.nextRoundRobinPairs();
			for (const [playerAId, playerBId] of pairs) {
				const matchId = `fight-${this.matchSeq++}`;
				pairings.push({ matchId, roundIndex, playerAId, playerBId });
				results.push({ matchId, roundIndex, playerAId, playerBId, status: 'pending' });

				const listA = playerRoundsByPlayerId.get(playerAId);
				if (listA) {
					listA.push({
						matchId,
						roundIndex,
						opponentPlayerId: playerBId,
						status: playerBId ? 'pending' : 'bye',
						replayAvailable: false,
						selfArmy: [],
						opponentArmy: []
					});
				}

				if (playerBId) {
					const listB = playerRoundsByPlayerId.get(playerBId);
					if (listB) {
						listB.push({
							matchId,
							roundIndex,
							opponentPlayerId: playerAId,
							status: 'pending',
							replayAvailable: false,
							selfArmy: [],
							opponentArmy: []
						});
					}
				}
			}
		}

		this.phase = 'combat';
		this.fightState = {
			isActive: true,
			encountersPerPhase,
			secondsPerRound,
			currentRoundIndex: 0,
			secondsToNextRound: secondsPerRound,
			pairings,
			results,
			playerRoundsByPlayerId,
			replaysByMatchId: new Map()
		};

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
					const wasBlocker = buildingDef?.type === 'blocking';
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
		return {
			playerId,
			resources: serializeResources(runtime.run.ecs.resources),
			blueprints: serializeInventory(runtime.run.ecs.blueprintInventory),
			shop: runtime.shopSystem.getState(),
			kingdom: serializeKingdom(runtime.run.ecs.getEntitiesWith(['position']), runtime.productionSystem),
			army: serializeArmy(runtime.run.ecs.getOrderedArmyUnitEntities().map((entity) => ({ entityId: entity.id, unit: entity.armyUnit! }))),
			combat: runtime.run.combatSystem.getSnapshot(),
			fight: this.buildPlayerFightSnapshot(playerId),
			advance: this.buildPlayerAdvanceSnapshot()
		};
	}

	private buildPlayerFightSnapshot(playerId: string) {
		const playerRounds = this.fightState.playerRoundsByPlayerId.get(playerId) ?? [];
		const enrichedPlayerRounds = playerRounds.map((round) => {
			const selfArmy = this.serializeFightArmyForPlayer(playerId);
			const opponentArmy = round.opponentPlayerId
				? this.serializeFightArmyForPlayer(round.opponentPlayerId)
				: [];
			return {
				...round,
				selfArmy,
				opponentArmy
			};
		});
		return {
			isActive: this.fightState.isActive,
			encountersPerPhase: this.fightState.encountersPerPhase,
			secondsPerRound: this.fightState.secondsPerRound,
			currentRoundIndex: this.fightState.currentRoundIndex,
			secondsToNextRound: this.fightState.secondsToNextRound,
			pairings: this.fightState.pairings,
			results: this.fightState.results,
			playerRounds: enrichedPlayerRounds
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

	private serializeFightArmyForPlayer(playerId: string): FightArmyUnitSummarySnapshot[] {
		const runtime = this.players.get(playerId);
		if (!runtime) return [];
		return runtime.run.ecs
			.getOrderedArmyUnitEntities()
			.map((entity) => entity.armyUnit)
			.filter((unit): unit is ArmyUnitComponent => !!unit)
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

		if (this.advanceState.secondsToPhaseEnd > 0) {
			this.advanceState.secondsToPhaseEnd -= 1;
			if (this.advanceState.secondsToPhaseEnd <= 0) {
				this.phase = 'build';
				this.advanceState = this.createEmptyAdvanceState();
			}
			return;
		}

		if (this.advanceState.secondsRemaining > 0) {
			this.advanceState.secondsRemaining -= 1;
		}

		if (this.advanceState.secondsRemaining > 0) return;

		const currentPlayerId = this.advanceState.pickOrderPlayerIds[this.advanceState.currentPickIndex];
		if (!currentPlayerId) return;
		this.autoPickAdvanceCharter(currentPlayerId);
	}

	private resolveFightRound(roundIndex: number): void {
		const roundResults = this.fightState.results.filter(
			(entry) => entry.roundIndex === roundIndex && entry.status === 'pending'
		);

		for (const result of roundResults) {
			if (!result.playerBId) {
				result.status = 'finished';
				this.setPlayerRoundResult(result.playerAId, result.matchId, 'bye', false);
				continue;
			}

			const runtimeA = this.players.get(result.playerAId);
			const runtimeB = this.players.get(result.playerBId);
			if (!runtimeA || !runtimeB) {
				result.status = 'finished';
				continue;
			}

			const armyA = cloneArmy(runtimeA.run.ecs.getOrderedArmyUnitEntities().map((entity) => entity.armyUnit!).filter(Boolean));
			const armyB = cloneArmy(runtimeB.run.ecs.getOrderedArmyUnitEntities().map((entity) => entity.armyUnit!).filter(Boolean));
			const combat = CombatSystem.resolveCombat(armyA, armyB);

			result.status = 'finished';
			if (combat.winner === 'armyA') {
				result.winnerPlayerId = result.playerAId;
				this.grantRenown(result.playerAId);
				this.setPlayerRoundResult(result.playerAId, result.matchId, 'won', true);
				this.setPlayerRoundResult(result.playerBId, result.matchId, 'lost', true);
			} else if (combat.winner === 'armyB') {
				result.winnerPlayerId = result.playerBId;
				this.grantRenown(result.playerBId);
				this.setPlayerRoundResult(result.playerAId, result.matchId, 'lost', true);
				this.setPlayerRoundResult(result.playerBId, result.matchId, 'won', true);
			} else {
				this.setPlayerRoundResult(result.playerAId, result.matchId, 'draw', true);
				this.setPlayerRoundResult(result.playerBId, result.matchId, 'draw', true);
			}

			this.fightState.replaysByMatchId.set(result.matchId, {
				matchId: result.matchId,
				playerAId: result.playerAId,
				playerBId: result.playerBId,
				armyA,
				armyB
			});
		}
	}

	private setPlayerRoundResult(
		playerId: string,
		matchId: string,
		status: FightPlayerRoundSnapshot['status'],
		replayAvailable: boolean
	): void {
		const rounds = this.fightState.playerRoundsByPlayerId.get(playerId);
		if (!rounds) return;
		const row = rounds.find((entry) => entry.matchId === matchId);
		if (!row) return;
		row.status = status;
		row.replayAvailable = replayAvailable;
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
		const replay = this.fightState.replaysByMatchId.get(matchId);
		if (!replay) return { ok: false, reason: 'Replay not found for this match.' };
		if (replay.playerAId !== playerId && replay.playerBId !== playerId) {
			return { ok: false, reason: 'You can only open your own match replay.' };
		}

		if (replay.playerAId === playerId) {
			runtime.run.combatSystem.startCombat(cloneArmy(replay.armyA), cloneArmy(replay.armyB));
		} else {
			runtime.run.combatSystem.startCombat(cloneArmy(replay.armyB), cloneArmy(replay.armyA));
		}

		return { ok: true };
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
		const playerIds = [...this.playerIds];
		if (playerIds.length <= 1) return [];

		for (let attempt = 0; attempt < 8; attempt += 1) {
			const shuffled = shuffleDeterministic(playerIds, (cycleIndex + 1) * 10_007 + attempt * 313 + playerIds.length * 17);
			const rounds = buildRoundRobinRounds(shuffled);
			const openingSignature = serializeRound(rounds[0] ?? []);

			if (cycleIndex === 0) {
				this.firstCycleOpeningSignature = openingSignature;
				return rounds;
			}

			if (!this.firstCycleOpeningSignature || openingSignature !== this.firstCycleOpeningSignature) {
				return rounds;
			}
		}

		return buildRoundRobinRounds(playerIds);
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
		return {
			isActive: false,
			level: 1,
			pickOrderPlayerIds: [],
			currentPickIndex: 0,
			secondsPerPick: Math.max(1, Math.floor(configuration.advancePhase.secondsPerPick)),
			secondsRemaining: 0,
			revealDelaySeconds: Math.max(0, Math.floor(configuration.advancePhase.revealSecondsAfterDraft)),
			secondsToPhaseEnd: 0,
			charters: []
		};
	}

	private revealNeighbors(runtime: PlayerRuntime, q: number, r: number): void {
		const known = new Set(runtime.run.ecs.getEntitiesWith(['position']).map((entity) => kingdomCoordKey(entity.position!.q, entity.position!.r)));
		const revealed = createRevealTilesAround(
			q,
			r,
			(coord) => known.has(kingdomCoordKey(coord.q, coord.r)),
			this.pickBlockerId
		);
		for (const tile of revealed) {
			const entity: Entity = {
				id: kingdomCoordKey(tile.q, tile.r),
				position: { q: tile.q, r: tile.r },
				building: tile.blockerId
					? {
						buildingId: tile.blockerId,
						status: 'active',
						progress: 0
					}
					: undefined
			};
			runtime.run.ecs.addEntity(entity);
		}
	}

	private beginAdvancePhase(): void {
		const level = this.resolveAdvanceLevel();
		const desiredCount = Math.min(9, Math.max(1, this.playerIds.length + configuration.advancePhase.charterCountBonus));
		const charterTemplates = this.pickCharterTemplatesForDraft(level, desiredCount);
		const charters = charterTemplates.map((template, index) => this.materializeCharter(template, index + 1));
		const pickOrderPlayerIds = [...this.playerIds].sort((a, b) => {
			const aRenown = this.players.get(a)?.run.ecs.resources.get('renown') ?? 0;
			const bRenown = this.players.get(b)?.run.ecs.resources.get('renown') ?? 0;
			if (aRenown !== bRenown) return aRenown - bRenown;
			return this.playerIds.indexOf(a) - this.playerIds.indexOf(b);
		});

		this.phase = 'advance';
		this.advanceState = {
			isActive: true,
			level,
			pickOrderPlayerIds,
			currentPickIndex: 0,
			secondsPerPick: Math.max(1, Math.floor(configuration.advancePhase.secondsPerPick)),
			secondsRemaining: Math.max(1, Math.floor(configuration.advancePhase.secondsPerPick)),
			revealDelaySeconds: Math.max(0, Math.floor(configuration.advancePhase.revealSecondsAfterDraft)),
			secondsToPhaseEnd: 0,
			charters
		};
		this.advancePhaseIndex += 1;
	}

	private resolveAdvanceLevel(): number {
		const levels = configuration.advancePhase.levelByAdvanceIndex;
		const level = levels[Math.min(this.advancePhaseIndex, levels.length - 1)] ?? levels[levels.length - 1] ?? 1;
		return Math.max(1, Math.floor(level));
	}

	private pickCharterTemplatesForDraft(level: number, count: number): CharterTemplateDef[] {
		let candidates = CHARTER_TEMPLATES.filter((entry) => entry.level === level);
		if (candidates.length === 0) {
			candidates = CHARTER_TEMPLATES.filter((entry) => entry.level <= level);
		}
		if (candidates.length === 0) candidates = [...CHARTER_TEMPLATES];

		const byFocus = new Map<string, CharterTemplateDef[]>();
		for (const candidate of candidates) {
			const focus = this.getCharterFocus(candidate);
			const list = byFocus.get(focus) ?? [];
			list.push(candidate);
			byFocus.set(focus, list);
		}

		for (const [focus, list] of byFocus.entries()) {
			byFocus.set(focus, shuffleWithMathRandom(list));
		}

		const focusOrder = shuffleWithMathRandom([...byFocus.keys()]);
		const selected: CharterTemplateDef[] = [];
		let cursor = 0;

		while (selected.length < count) {
			const focus = focusOrder[cursor % Math.max(1, focusOrder.length)] ?? 'resources';
			cursor += 1;
			const list = byFocus.get(focus);
			if (!list || list.length === 0) {
				if ([...byFocus.values()].every((group) => group.length === 0)) {
					const fallback = shuffleWithMathRandom(candidates);
					selected.push(fallback[selected.length % Math.max(1, fallback.length)]!);
				}
				continue;
			}
			selected.push(list.shift()!);
		}

		return selected;
	}

	private getCharterFocus(template: CharterTemplateDef): 'resources' | 'blueprints' | 'expansion' {
		if ((template.blueprints?.length ?? 0) > 0) return 'blueprints';
		if (template.resources.some((resourceDef) => resourceDef.resource === 'expansion')) return 'expansion';
		return 'resources';
	}

	private materializeCharter(template: CharterTemplateDef, serial: number): CharterSnapshot {
		const resources = template.resources
			.map((resourceDef) => ({
				resource: resourceDef.resource,
				amount: randomIntInRange(resourceDef.min, resourceDef.max)
			}))
			.filter((entry) => entry.amount > 0);

		const blueprints = this.generateBlueprintRewards(template);
		return {
			charterId: `${template.id}-${serial}`,
			title: template.title,
			level: template.level,
			resources,
			blueprints
		};
	}

	private generateBlueprintRewards(template: CharterTemplateDef): CharterBlueprintGrantSnapshot[] {
		const blueprintRules = template.blueprints ?? [];
		if (blueprintRules.length === 0) return [];

		const allBuildings = getAllBuildingDefs();
		const tierByBuildingId = buildTierByBuildingId(allBuildings);
		const aggregated = new Map<string, CharterBlueprintGrantSnapshot>();

		for (const rule of blueprintRules) {
			const count = randomIntInRange(rule.countMin, rule.countMax);
			for (let i = 0; i < count; i += 1) {
				const picked = this.pickBlueprintBuildingForRule(allBuildings, tierByBuildingId, rule);
				if (!picked) continue;
				const existing = aggregated.get(picked.id);
				if (existing) {
					existing.count += 1;
					continue;
				}
				aggregated.set(picked.id, {
					buildingId: picked.id,
					count: 1,
					tier: tierByBuildingId.get(picked.id) ?? 1,
					type: picked.type,
					magicSchool: rule.magicSchool
				});
			}
		}

		return [...aggregated.values()];
	}

	private pickBlueprintBuildingForRule(
		allBuildings: BuildingDef[],
		tierByBuildingId: Map<string, number>,
		rule: NonNullable<CharterTemplateDef['blueprints']>[number]
	): BuildingDef | null {
		const filterByRule = (building: BuildingDef, strictTier: boolean): boolean => {
			if (building.type === 'blocking') return false;
			if (rule.buildingType && building.type !== rule.buildingType) return false;
			if (strictTier && (tierByBuildingId.get(building.id) ?? 1) !== Math.max(1, Math.floor(rule.tier))) return false;
			return true;
		};

		let candidates = allBuildings.filter((building) => filterByRule(building, true));
		if (candidates.length === 0) candidates = allBuildings.filter((building) => filterByRule(building, false));
		if (candidates.length === 0) candidates = allBuildings.filter((building) => building.type !== 'blocking');
		if (candidates.length === 0) return null;
		return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
	}

	private selectAdvanceCharter(playerId: string, charterId: string): { ok: true } | { ok: false; reason: string } {
		if (this.phase !== 'advance' || !this.advanceState.isActive) {
			return { ok: false, reason: 'Advance draft is not active.' };
		}

		const expectedPlayerId = this.advanceState.pickOrderPlayerIds[this.advanceState.currentPickIndex];
		if (!expectedPlayerId || expectedPlayerId !== playerId) {
			return { ok: false, reason: 'It is not your turn to pick a charter.' };
		}

		const charter = this.advanceState.charters.find((entry) => entry.charterId === charterId);
		if (!charter) return { ok: false, reason: 'Unknown charter.' };
		if (charter.selectedByPlayerId) return { ok: false, reason: 'This charter is already taken.' };

		charter.selectedByPlayerId = playerId;
		this.applyCharterRewards(playerId, charter);

		this.advanceState.currentPickIndex += 1;
		if (this.advanceState.currentPickIndex >= this.advanceState.pickOrderPlayerIds.length) {
			this.advanceState.secondsRemaining = 0;
			this.advanceState.secondsToPhaseEnd = this.advanceState.revealDelaySeconds;
			return { ok: true };
		}

		this.advanceState.secondsRemaining = this.advanceState.secondsPerPick;
		return { ok: true };
	}

	private autoPickAdvanceCharter(playerId: string): void {
		const available = this.advanceState.charters.filter((entry) => !entry.selectedByPlayerId);
		if (available.length === 0) {
			this.advanceState.currentPickIndex += 1;
			if (this.advanceState.currentPickIndex >= this.advanceState.pickOrderPlayerIds.length) {
				this.advanceState.secondsRemaining = 0;
				this.advanceState.secondsToPhaseEnd = this.advanceState.revealDelaySeconds;
			}
			return;
		}

		const randomCharter = available[Math.floor(Math.random() * available.length)]!;
		this.selectAdvanceCharter(playerId, randomCharter.charterId);
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
		const blockers = getBlockingBuildings();
		if (blockers.length === 0) throw new Error('No blocker building defs found.');
		return blockers[Math.floor(Math.random() * blockers.length)]!.id;
	};
}

function serializeResources(resources: Map<string, number>): ResourceSnapshot {
	const out: ResourceSnapshot = {};
	for (const [key, value] of resources.entries()) {
		out[key] = value;
	}
	return out;
}

function serializeInventory(inventory: Map<string, number>): Record<string, number> {
	const out: Record<string, number> = {};
	for (const [key, value] of inventory.entries()) {
		if (value > 0) out[key] = value;
	}
	return out;
}

function serializeKingdom(entities: Entity[], productionSystem: ProductionSystem): KingdomSnapshot {
	return {
		tiles: entities
			.filter((entity): entity is Entity & { position: NonNullable<Entity['position']> } => !!entity.position)
			.map((entity) => ({
				q: entity.position.q,
				r: entity.position.r,
				building: entity.building
					? {
						buildingId: entity.building.buildingId,
						status: entity.building.status,
						progress: entity.building.progress,
						upgradeNextId: entity.building.upgradeNextId,
						productionMultiplier: entity.building.status === 'active' ? productionSystem.calculateMultiplier(entity) : undefined
					}
					: undefined
			}))
	};
}

function serializeArmy(units: Array<{ entityId: string; unit: ArmyUnitComponent }>): ArmyUnitSnapshot[] {
	return units.map(({ entityId, unit }) => ({
		entityId,
		unitId: unit.unitId,
		name: unit.name,
		assetPath: unit.assetPath,
		speed: unit.speed,
		health: unit.health,
		drFlat: unit.drFlat,
		drPercent: unit.drPercent,
		actionsPerTurn: unit.actionsPerTurn,
		trainingLevel: unit.trainingLevel,
		trainingStatus: unit.training.status,
		trainingProgress: unit.training.time > 0 ? (unit.training.progress / unit.training.time) * 100 : 0,
		nextTrainCost: computeNextTrainCost(unit),
		trainTime: unit.training.time
	}));
}

function initializeKingdomGrid(
	ecs: ServerGameState['ecs'],
	pickBlockerId: () => string
): void {
	for (const tile of createInitialKingdomTiles(pickBlockerId)) {
		ecs.addEntity({
			id: kingdomCoordKey(tile.q, tile.r),
			position: { q: tile.q, r: tile.r },
			building: tile.blockerId
				? {
					buildingId: tile.blockerId,
					status: 'active',
					progress: 0
				}
				: undefined
		});
	}
}

function computeNextTrainCost(unit: ArmyUnitComponent): Record<string, number> {
	const levelMult = Math.pow(unit.training.costMult, unit.trainingLevel);
	const out: Record<string, number> = {};
	for (const [resource, base] of Object.entries(unit.training.costBase)) {
		out[resource] = Math.ceil(base * levelMult);
	}
	return out;
}

function cloneArmy(army: ArmyUnitComponent[]): ArmyUnitComponent[] {
	return army.map((unit) => ({
		...unit,
		training: { ...unit.training }
	}));
}

function clampIntInRange(value: number, min: number, max: number): number {
	const int = Number.isFinite(value) ? Math.floor(value) : min;
	return Math.max(min, Math.min(max, int));
}

function buildRoundRobinRounds(playerOrder: string[]): Array<Array<[string, string?]>> {
	const pool = [...playerOrder];
	if (pool.length % 2 !== 0) pool.push(BYE_PLAYER_ID);
	if (pool.length < 2) return [];

	const rounds: Array<Array<[string, string?]>> = [];
	const roundCount = pool.length - 1;
	for (let round = 0; round < roundCount; round += 1) {
		const pairs: Array<[string, string?]> = [];
		for (let i = 0; i < pool.length / 2; i += 1) {
			const a = pool[i]!;
			const b = pool[pool.length - 1 - i]!;
			if (a === BYE_PLAYER_ID && b === BYE_PLAYER_ID) continue;
			if (a === BYE_PLAYER_ID) {
				pairs.push([b, undefined]);
				continue;
			}
			if (b === BYE_PLAYER_ID) {
				pairs.push([a, undefined]);
				continue;
			}
			pairs.push([a, b]);
		}
		rounds.push(pairs);

		const fixed = pool[0]!;
		const rotated = [fixed, pool[pool.length - 1]!, ...pool.slice(1, pool.length - 1)];
		for (let i = 0; i < pool.length; i += 1) pool[i] = rotated[i]!;
	}

	return rounds;
}

function shuffleDeterministic(values: string[], seed: number): string[] {
	const out = [...values];
	let state = seed >>> 0;
	for (let i = out.length - 1; i > 0; i -= 1) {
		state = (state * 1664525 + 1013904223) >>> 0;
		const j = state % (i + 1);
		const tmp = out[i];
		out[i] = out[j]!;
		out[j] = tmp!;
	}
	return out;
}

function serializeRound(round: Array<[string, string?]>): string {
	return round
		.map(([a, b]) => (b ? [a, b].sort().join('-') : `${a}-bye`))
		.sort()
		.join('|');
}

function randomIntInRange(min: number, max: number): number {
	const floorMin = Math.floor(Math.min(min, max));
	const floorMax = Math.floor(Math.max(min, max));
	if (floorMin === floorMax) return floorMin;
	return floorMin + Math.floor(Math.random() * (floorMax - floorMin + 1));
}

function shuffleWithMathRandom<T>(items: T[]): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = out[i];
		out[i] = out[j]!;
		out[j] = tmp!;
	}
	return out;
}

function buildTierByBuildingId(buildings: BuildingDef[]): Map<string, number> {
	const byId = new Map<string, BuildingDef>(buildings.map((entry) => [entry.id, entry]));
	const memo = new Map<string, number>();

	const getTier = (buildingId: string): number => {
		const memoized = memo.get(buildingId);
		if (memoized) return memoized;
		const building = byId.get(buildingId);
		if (!building) return 1;
		if (!building.parentId) {
			memo.set(buildingId, 1);
			return 1;
		}
		const parentTier = getTier(building.parentId);
		const tier = parentTier + 1;
		memo.set(buildingId, tier);
		return tier;
	};

	for (const building of buildings) {
		getTier(building.id);
	}

	return memo;
}