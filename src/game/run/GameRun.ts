import type { ArmyUnitComponent } from '../scenes/Kingdom/ecs/components';
import { ECSManager } from '../scenes/Kingdom/ecs/ECSBase';
import { getAllBuildingDefs, type UnitDef } from '../scenes/Kingdom/data/buildings';
import { eventBus } from '../../eventBus';
import { CombatSystem } from '../scenes/Kingdom/ecs/systems/CombatSystem';
import type { WorldMapTravelUiView } from '../../eventBus';
import type { CombatSnapshot } from '../scenes/Kingdom/ecs/systems/CombatSystem';

export type WorldPointOwner = 'player' | 'neutral' | 'enemy';
export type WorldPointKind = 'kingdom' | 'town' | 'ruins' | 'camp';

export type WorldPoint = {
	id: string;
	name: string;
	kind: WorldPointKind;
	x: number;
	y: number;
	owner: WorldPointOwner;
	defenders: ArmyUnitComponent[];
};

export type WorldMapState = {
	seed: number;
	points: WorldPoint[];
};

type TravelState =
	| { status: 'idle' }
	| {
		status: 'travelling';
		fromPointId: string;
		toPointId: string;
		distanceTotal: number;
		distanceRemaining: number;
		speedPerTick: number;
	}
	| {
		status: 'arrived';
		fromPointId: string;
		toPointId: string;
		distanceTotal: number;
		speedPerTick: number;
	};

type PendingEncounter = { kind: 'capture'; pointId: string };

const WORLD_DISTANCE_SCALE = 100;
const MIN_SPEED_PER_TICK = 1;

export class GameRun {
	ecs: ECSManager;
	combatSystem: CombatSystem;
	worldMap: WorldMapState;
	travel: TravelState = { status: 'idle' };
	pendingEncounter: PendingEncounter | null = null;
	revealedPointIds: Set<string> = new Set();

	constructor(seed: number) {
		this.ecs = new ECSManager();
		this.combatSystem = new CombatSystem(this.ecs);
		this.worldMap = { seed, points: [] };
	}

	ensureWorldMapGenerated(): void {
		if (this.worldMap.points.length > 0) return;
		this.worldMap.points = generateWorldPoints(this.worldMap.seed);
		this.revealedPointIds = new Set();
		// Ensure at least the kingdom (and nearby points) are revealed.
		this.updateRevealedPoints();
	}

	advanceTick(): void {
		this.ecs.advanceTick();
		this.tickTravel();
		this.updateRevealedPoints();
		this.ecs.broadcastResources();
	}

	getPlayerArmy(): ArmyUnitComponent[] {
		return this.ecs
			.getEntities()
			.filter((e) => !!e.armyUnit)
			.map((e) => e.armyUnit!);
	}

	startTravel(targetPointId: string): void {
		this.ensureWorldMapGenerated();
		if (this.travel.status !== 'idle') throw new Error('Army is already travelling.');
		if (this.pendingEncounter) throw new Error('Resolve the current encounter first.');

		const from = this.findPlayerKingdomPoint();
		const to = this.findPointById(targetPointId);
		if (!from) throw new Error('Missing player kingdom point.');
		if (!to) throw new Error('Invalid target point.');
		if (to.id === from.id) throw new Error('Already at your kingdom.');
		if (to.owner === 'player') throw new Error('That point is already yours.');

		const army = this.getPlayerArmy();
		if (army.length === 0) throw new Error('You have no army units yet.');

		const slowest = Math.min(
			...army.map((u) => (Number.isFinite(u.speed) ? Math.max(MIN_SPEED_PER_TICK, Math.floor(u.speed)) : MIN_SPEED_PER_TICK))
		);
		const dist = Math.ceil(distanceUnits(from, to));
		this.travel = {
			status: 'travelling',
			fromPointId: from.id,
			toPointId: to.id,
			distanceTotal: dist,
			distanceRemaining: dist,
			speedPerTick: slowest
		};
		this.updateRevealedPoints();
		this.publishTravel();
	}

	clearEncounterAndTravel(): void {
		this.pendingEncounter = null;
		this.travel = { status: 'idle' };
		this.publishTravel();
	}

	startPendingEncounterCombat(targetPointId: string): void {
		this.ensureWorldMapGenerated();
		if (!this.pendingEncounter) throw new Error('No encounter available.');
		if (this.pendingEncounter.kind !== 'capture' || this.pendingEncounter.pointId !== targetPointId) {
			throw new Error('That encounter is no longer available.');
		}
		if (this.travel.status !== 'arrived' || this.travel.toPointId !== targetPointId) {
			throw new Error('You must arrive at the target before starting combat.');
		}

		const target = this.findPointById(targetPointId);
		if (!target) throw new Error('Invalid target point.');
		if (target.owner === 'player') throw new Error('That point is already yours.');

		const armyA = this.getPlayerArmy();
		if (armyA.length === 0) throw new Error('You have no army units.');
		const armyB = target.defenders;
		if (armyB.length === 0) throw new Error('There are no defenders to fight.');

		this.combatSystem.startCombat(armyA, armyB);
		eventBus.publishGameToUi({
			type: 'combat-ui-open',
			reason: 'worldmap-arrival',
			targetPointId: target.id,
			targetName: target.name
		});
	}

	tryResolvePendingEncounter(): boolean {
		if (!this.pendingEncounter) return false;
		const snap = this.getCombatSnapshot();
		if (snap.status !== 'finished') return false;

		const encounter = this.pendingEncounter;
		this.pendingEncounter = null;
		let changed = false;

		if (encounter.kind === 'capture') {
			const point = this.findPointById(encounter.pointId);
			if (!point) return false;
			if (snap.winner === 'armyA') {
				if (point.owner !== 'player' || point.defenders.length > 0) changed = true;
				point.owner = 'player';
				point.defenders = [];
			}

			// Encounter is done either way; allow new travel.
			if (this.travel.status === 'arrived' && this.travel.toPointId === encounter.pointId) {
				this.travel = { status: 'idle' };
				this.publishTravel();
			}
		}

		// Captures expand vision.
		if (this.updateRevealedPoints()) changed = true;

		return changed;
	}

	getRevealedWorldPoints(): WorldPoint[] {
		this.ensureWorldMapGenerated();
		// Always show owned POIs even if somehow not in the set.
		return this.worldMap.points.filter((p) => p.owner === 'player' || this.revealedPointIds.has(p.id));
	}

	getArmyWorldPositionNormalized(): { x: number; y: number } {
		return this.getArmyWorldPosition();
	}

	getCombatSnapshot(): CombatSnapshot {
		return this.combatSystem.getSnapshot();
	}

	private tickTravel(): void {
		if (this.travel.status !== 'travelling') return;
		const nextRemaining = Math.max(0, this.travel.distanceRemaining - this.travel.speedPerTick);
		this.travel = { ...this.travel, distanceRemaining: nextRemaining };
		this.publishTravel();
		this.updateRevealedPoints();
		if (nextRemaining > 0) return;

		// Arrived (combat is started manually from the UI).
		const toPointId = this.travel.toPointId;
		const fromPointId = this.travel.fromPointId;
		const distanceTotal = this.travel.distanceTotal;
		const speedPerTick = this.travel.speedPerTick;
		this.travel = { status: 'arrived', fromPointId, toPointId, distanceTotal, speedPerTick };
		this.pendingEncounter = { kind: 'capture', pointId: toPointId };
		this.updateRevealedPoints();
		this.publishTravel();
	}

	private publishTravel(): void {
		eventBus.publishGameToUi({ type: 'worldmap-travel-updated', travel: this.getTravelUi() });
	}

	private getTravelUi(): WorldMapTravelUiView {
		if (this.travel.status === 'idle') return { status: 'idle' };
		if (this.travel.status === 'arrived') {
			return {
				status: 'arrived',
				fromPointId: this.travel.fromPointId,
				toPointId: this.travel.toPointId,
				distanceTotal: this.travel.distanceTotal,
				speedPerTick: this.travel.speedPerTick
			};
		}
		const eta = this.travel.speedPerTick > 0 ? Math.ceil(this.travel.distanceRemaining / this.travel.speedPerTick) : 0;
		return {
			status: 'travelling',
			fromPointId: this.travel.fromPointId,
			toPointId: this.travel.toPointId,
			distanceTotal: this.travel.distanceTotal,
			distanceRemaining: this.travel.distanceRemaining,
			speedPerTick: this.travel.speedPerTick,
			etaTicks: eta
		};
	}

	private findPointById(id: string): WorldPoint | undefined {
		return this.worldMap.points.find((p) => p.id === id);
	}

	private findPlayerKingdomPoint(): WorldPoint | undefined {
		return this.worldMap.points.find((p) => p.kind === 'kingdom' && p.owner === 'player');
	}

	private updateRevealedPoints(): boolean {
		this.ensureWorldMapGenerated();
		const before = this.revealedPointIds.size;

		// Owned POIs are always revealed.
		for (const p of this.worldMap.points) {
			if (p.owner === 'player') this.revealedPointIds.add(p.id);
		}

		const sources: Array<{ x: number; y: number; radiusUnits: number }> = [];

		const armyPos = this.getArmyWorldPosition();
		const armySight = this.getArmySightRadiusUnits();
		sources.push({ x: armyPos.x, y: armyPos.y, radiusUnits: armySight });

		for (const p of this.worldMap.points) {
			if (p.owner !== 'player') continue;
			sources.push({ x: p.x, y: p.y, radiusUnits: poiSightRadiusUnits(p.kind) });
		}

		for (const p of this.worldMap.points) {
			if (this.revealedPointIds.has(p.id)) continue;
			for (const s of sources) {
				const d = Math.hypot(p.x - s.x, p.y - s.y) * WORLD_DISTANCE_SCALE;
				if (d <= s.radiusUnits) {
					this.revealedPointIds.add(p.id);
					break;
				}
			}
		}

		return this.revealedPointIds.size !== before;
	}

	private getArmyWorldPosition(): { x: number; y: number } {
		this.ensureWorldMapGenerated();
		const home = this.findPlayerKingdomPoint();
		if (!home) return { x: 0.5, y: 0.55 };

		if (this.travel.status === 'idle') return { x: home.x, y: home.y };
		if (this.travel.status === 'arrived') {
			const to = this.findPointById(this.travel.toPointId);
			return to ? { x: to.x, y: to.y } : { x: home.x, y: home.y };
		}

		const from = this.findPointById(this.travel.fromPointId) ?? home;
		const to = this.findPointById(this.travel.toPointId) ?? home;
		const t = this.travel.distanceTotal > 0 ? 1 - this.travel.distanceRemaining / this.travel.distanceTotal : 1;
		const clamped = Math.max(0, Math.min(1, t));
		return {
			x: from.x + (to.x - from.x) * clamped,
			y: from.y + (to.y - from.y) * clamped
		};
	}

	private getArmySightRadiusUnits(): number {
		const units = this.getPlayerArmy();
		// Dynamic sight: increases with unit count.
		const base = 26;
		const perUnit = 2;
		return base + units.length * perUnit;
	}
}

function poiSightRadiusUnits(kind: WorldPointKind): number {
	// Static per-POI sight radius (owned POIs reveal nearby points).
	if (kind === 'kingdom') return 34;
	if (kind === 'town') return 28;
	return 24;
}

function mulberry32(seed: number): () => number {
	let t = seed >>> 0;
	return () => {
		t += 0x6d2b79f5;
		let x = Math.imul(t ^ (t >>> 15), 1 | t);
		x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
}

function randInt(rng: () => number, minInclusive: number, maxInclusive: number): number {
	const span = maxInclusive - minInclusive + 1;
	return minInclusive + Math.floor(rng() * span);
}

function pickOne<T>(rng: () => number, list: T[]): T {
	return list[Math.floor(rng() * list.length)]!;
}

function createArmyUnitFromDef(def: UnitDef): ArmyUnitComponent {
	return {
		unitId: def.id,
		name: def.name,
		textureId: def.textureId,
		assetPath: def.assetPath,
		speed: def.speed,
		health: def.health,
		drFlat: def.drFlat,
		drPercent: def.drPercent,
		actionsPerTurn: def.actionsPerTurn,
		trainingLevel: 0,
		training: {
			status: 'idle',
			progress: 0,
			costBase: {},
			costMult: 1,
			time: 0,
			def: { health: 0, attackDamage: 0, drFlat: 0 }
		}
	};
}

function distanceUnits(a: WorldPoint, b: WorldPoint): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return Math.hypot(dx, dy) * WORLD_DISTANCE_SCALE;
}

function generateWorldPoints(seed: number): WorldPoint[] {
	const rng = mulberry32(seed);
	const unitDefs = getAllBuildingDefs()
		.filter((b) => b.type === 'army')
		.map((b) => b.unit);
	if (unitDefs.length === 0) throw new Error('No unit defs available for world map defenders.');

	// Normalized world-map coordinates; the scene decides how to project them.
	const points: WorldPoint[] = [];

	points.push({
		id: 'player-kingdom',
		name: 'Your Kingdom',
		kind: 'kingdom',
		x: 0.5,
		y: 0.55,
		owner: 'player',
		defenders: []
	});

	const poiCount = 30;
	const minDist = 0.07;
	for (let i = 0; i < poiCount; i++) {
		const kind = pickOne(rng, ['town', 'ruins', 'camp'] as const);
		const defendersCount = randInt(rng, 2, 6);
		const defenders: ArmyUnitComponent[] = [];
		for (let j = 0; j < defendersCount; j++) {
			const u = pickOne(rng, unitDefs);
			defenders.push(createArmyUnitFromDef(u));
		}

		let x = 0.5;
		let y = 0.5;
		for (let attempt = 0; attempt < 60; attempt++) {
			x = rng() * 0.9 + 0.05;
			y = rng() * 0.8 + 0.1;
			const ok = points.every((p) => Math.hypot(p.x - x, p.y - y) >= minDist);
			if (ok) break;
		}

		points.push({
			id: `poi-${i + 1}`,
			name: kind === 'town' ? `Town ${i + 1}` : kind === 'ruins' ? `Ruins ${i + 1}` : `Camp ${i + 1}`,
			kind,
			x,
			y,
			owner: 'neutral',
			defenders
		});
	}

	return points;
}
