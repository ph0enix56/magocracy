import { configuration } from '../../game/configuration';
import { getBlockingBuildings, getBuildingDef } from './config/buildings';
import { createInitialKingdomTiles, createRevealTilesAround, kingdomCoordKey } from '../../shared/kingdom/kingdomGrid';
import type {
	ArmyUnitSnapshot,
	GameActionCommand,
	GameSnapshot,
	KingdomSnapshot,
	PlayerGameView,
	ResourceSnapshot,
	ShopSnapshot
} from '../../shared/multiplayer/protocol';
import { ServerGameState } from './gameplay/ServerGameState';
import { BuildSystem } from './gameplay/systems/BuildSystem';
import { ArmySystem } from './gameplay/systems/ArmySystem';
import { ProductionSystem } from './gameplay/systems/ProductionSystem';
import { ShopSystem } from './gameplay/systems/ShopSystem';
import type { ArmyUnitComponent, Entity } from './gameplay/model';

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

export class RoomGameRuntime {
	private readonly players = new Map<string, PlayerRuntime>();
	private readonly onSnapshot: (snapshot: GameSnapshot) => void;
	private interval: Timer | null = null;
	private tick = 0;

	constructor(playerIds: string[], options: RuntimeOptions) {
		this.onSnapshot = options.onSnapshot;
		for (const playerId of playerIds) {
			this.players.set(playerId, this.createPlayerRuntime());
		}
	}

	start(): void {
		if (this.interval) return;
		this.interval = setInterval(() => {
			this.tick += 1;
			for (const runtime of this.players.values()) {
				runtime.run.advanceTick();
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

	handleAction(playerId: string, action: GameActionCommand): { ok: true } | { ok: false; reason: string } {
		const runtime = this.players.get(playerId);
		if (!runtime) return { ok: false, reason: 'Unknown player game state.' };

		try {
			switch (action.type) {
				case 'build/request': {
					const entity = runtime.run.ecs.getEntity(kingdomCoordKey(action.q, action.r));
					if (!entity) return { ok: false, reason: 'Unknown tile.' };
					runtime.buildSystem.startBuild(entity, action.buildingId);
					break;
				}
				case 'destroy/request': {
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
					const entity = runtime.run.ecs.getEntity(kingdomCoordKey(action.q, action.r));
					if (!entity) return { ok: false, reason: 'Unknown tile.' };
					runtime.buildSystem.startUpgrade(entity, action.upgradeBuildingId);
					break;
				}
				case 'shop/buy':
					runtime.shopSystem.buyWithThrow(action.slotIndex);
					break;
				case 'shop/reroll':
					runtime.shopSystem.rerollWithThrow();
					break;
				case 'army/train':
					runtime.armySystem.startTrainingWithThrow(action.unitEntityId);
					break;
				case 'army/reorder':
					runtime.run.ecs.reorderArmyUnitWithThrow(action.unitEntityId, action.direction);
					break;
				case 'combat/step':
					runtime.run.combatSystem.stepCombat(action.steps ?? 1);
					break;
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
			phase: 'build',
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
			combat: runtime.run.combatSystem.getSnapshot()
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