import { configuration } from '../../game/configuration';
import { getBlockingBuildings, getBuildingDef } from './config/buildings';
import { createInitialKingdomTiles, createRevealTilesAround, kingdomCoordKey } from '../../shared/kingdom/kingdomGrid';
import type {
	ArmyUnitSnapshot,
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

	constructor(playerIds: string[], options: RuntimeOptions) {
		this.playerIds = [...playerIds];
		this.onSnapshot = options.onSnapshot;
		for (const playerId of playerIds) {
			this.players.set(playerId, this.createPlayerRuntime());
		}
		this.fightState = this.createEmptyFightState();
	}

	start(): void {
		if (this.interval) return;
		this.interval = setInterval(() => {
			this.tick += 1;
			if (this.phase === 'build') {
				for (const runtime of this.players.values()) {
					runtime.run.advanceTick();
				}
			} else {
				this.advanceFightPhaseTick();
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
		if (this.phase === 'combat' && this.fightState.isActive) return { ok: false, reason: 'Fight phase is already active.' };

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
						replayAvailable: false
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
							replayAvailable: false
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

	handleAction(playerId: string, action: GameActionCommand): { ok: true } | { ok: false; reason: string } {
		const runtime = this.players.get(playerId);
		if (!runtime) return { ok: false, reason: 'Unknown player game state.' };

		try {
			switch (action.type) {
				case 'build/request': {
					if (this.phase !== 'build') return { ok: false, reason: 'Build actions are disabled during fight phase.' };
					const entity = runtime.run.ecs.getEntity(kingdomCoordKey(action.q, action.r));
					if (!entity) return { ok: false, reason: 'Unknown tile.' };
					runtime.buildSystem.startBuild(entity, action.buildingId);
					break;
				}
				case 'destroy/request': {
					if (this.phase !== 'build') return { ok: false, reason: 'Destroy actions are disabled during fight phase.' };
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
					if (this.phase !== 'build') return { ok: false, reason: 'Upgrade actions are disabled during fight phase.' };
					const entity = runtime.run.ecs.getEntity(kingdomCoordKey(action.q, action.r));
					if (!entity) return { ok: false, reason: 'Unknown tile.' };
					runtime.buildSystem.startUpgrade(entity, action.upgradeBuildingId);
					break;
				}
				case 'shop/buy':
					if (this.phase !== 'build') return { ok: false, reason: 'Shop is disabled during fight phase.' };
					runtime.shopSystem.buyWithThrow(action.slotIndex);
					break;
				case 'shop/reroll':
					if (this.phase !== 'build') return { ok: false, reason: 'Shop is disabled during fight phase.' };
					runtime.shopSystem.rerollWithThrow();
					break;
				case 'army/train':
					if (this.phase !== 'build') return { ok: false, reason: 'Training is disabled during fight phase.' };
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
			fight: this.buildPlayerFightSnapshot(playerId)
		};
	}

	private buildPlayerFightSnapshot(playerId: string) {
		const playerRounds = this.fightState.playerRoundsByPlayerId.get(playerId) ?? [];
		return {
			isActive: this.fightState.isActive,
			encountersPerPhase: this.fightState.encountersPerPhase,
			secondsPerRound: this.fightState.secondsPerRound,
			currentRoundIndex: this.fightState.currentRoundIndex,
			secondsToNextRound: this.fightState.secondsToNextRound,
			pairings: this.fightState.pairings,
			results: this.fightState.results,
			playerRounds
		};
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
			this.phase = 'build';
			this.fightState.isActive = false;
			this.fightState.secondsToNextRound = 0;
			return;
		}

		this.fightState.secondsToNextRound = this.fightState.secondsPerRound;
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