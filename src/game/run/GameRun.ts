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
	neighbors: Array<{ pointId: string; distance: number }>;
	// Number of edges from the player kingdom (for future difficulty scaling).
	hopsFromKingdom: number;
	// Layout hints for outward placement (purely visual).
	layoutAngleRad: number;
	layoutRadius: number;
};

export type WorldMapState = {
	seed: number;
	points: WorldPoint[];
	nextPoiSeq: number;
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
		pathPointIds: string[];
		pathSegmentDistances: number[];
	}
	| {
		status: 'arrived';
		fromPointId: string;
		toPointId: string;
		distanceTotal: number;
		speedPerTick: number;
	};

type PendingEncounter = { kind: 'capture'; pointId: string };

const MIN_SPEED_PER_TICK = 1;

export class GameRun {
	ecs: ECSManager;
	combatSystem: CombatSystem;
	worldMap: WorldMapState;
	travel: TravelState = { status: 'idle' };
	pendingEncounter: PendingEncounter | null = null;
	private readonly worldRng: () => number;
	private readonly unitDefs: UnitDef[];
	private armyLocationPointId: string = 'player-kingdom';

	constructor(seed: number) {
		this.ecs = new ECSManager();
		this.combatSystem = new CombatSystem(this.ecs);
		this.worldMap = { seed, points: [], nextPoiSeq: 1 };
		this.worldRng = mulberry32(seed);
		this.unitDefs = getAllBuildingDefs()
			.filter((b) => b.type === 'army')
			.map((b) => b.unit);
		if (this.unitDefs.length === 0) throw new Error('No unit defs available for world map defenders.');
	}

	ensureWorldMapGenerated(): void {
		if (this.worldMap.points.length > 0) return;

		const kingdom: WorldPoint = {
			id: 'player-kingdom',
			name: 'Your Kingdom',
			kind: 'kingdom',
			x: 0.5,
			y: 0.55,
			owner: 'player',
			defenders: [],
			neighbors: [],
			hopsFromKingdom: 0,
			layoutAngleRad: 0,
			layoutRadius: 0
		};
		this.worldMap.points.push(kingdom);
		this.armyLocationPointId = kingdom.id;

		// Start small: 3 neighboring POIs.
		this.expandFromWithNewPois(kingdom.id, 3);
	}

	advanceTick(): void {
		this.ecs.advanceTick();
		this.tickTravel();
		this.ecs.broadcastResources();
	}

	getPlayerArmy(): ArmyUnitComponent[] {
		return this.ecs.getOrderedArmyUnits();
	}

	startTravel(targetPointId: string): void {
		this.ensureWorldMapGenerated();
		if (this.travel.status !== 'idle') throw new Error('Army is already travelling.');
		if (this.pendingEncounter) throw new Error('Resolve the current encounter first.');

		const from = this.findPointById(this.armyLocationPointId);
		const to = this.findPointById(targetPointId);
		if (!from) throw new Error('Missing current army location.');
		if (!to) throw new Error('Invalid target point.');
		if (to.id === from.id) throw new Error('Already at that point.');

		const path = this.findShortestPath(from.id, to.id);
		if (!path) throw new Error('No path exists to that point.');

		const army = this.getPlayerArmy();
		if (army.length === 0) throw new Error('You have no army units yet.');

		const slowest = Math.min(
			...army.map((u) => (Number.isFinite(u.speed) ? Math.max(MIN_SPEED_PER_TICK, Math.floor(u.speed)) : MIN_SPEED_PER_TICK))
		);
		const dist = Math.ceil(path.distance);
		this.travel = {
			status: 'travelling',
			fromPointId: from.id,
			toPointId: to.id,
			distanceTotal: dist,
			distanceRemaining: dist,
			speedPerTick: slowest,
			pathPointIds: path.pathPointIds,
			pathSegmentDistances: path.pathSegmentDistances
		};
		this.publishTravel();
	}

	// For future difficulty scaling: how many neighbor-steps away from the kingdom is this POI?
	getHopsFromKingdom(pointId: string): number {
		this.ensureWorldMapGenerated();
		return this.findPointById(pointId)?.hopsFromKingdom ?? 0;
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

				// Expanding frontier: capturing a POI generates 2-3 new neighbors.
				this.expandFromWithNewPois(point.id, randInt(this.worldRng, 2, 3));
				changed = true;
			}

			// Encounter is done either way; allow new travel.
			if (this.travel.status === 'arrived' && this.travel.toPointId === encounter.pointId) {
				// Win: stay at the captured POI. Loss: retreat to origin.
				this.armyLocationPointId = snap.winner === 'armyA' ? this.travel.toPointId : this.travel.fromPointId;
				this.travel = { status: 'idle' };
				this.publishTravel();
			}
		}

		return changed;
	}

	getWorldPoints(): WorldPoint[] {
		this.ensureWorldMapGenerated();
		return this.worldMap.points;
	}

	// Backwards-compatible name for the old fog-of-war API.
	getRevealedWorldPoints(): WorldPoint[] {
		return this.getWorldPoints();
	}

	getPathDistanceTo(pointId: string): number | null {
		this.ensureWorldMapGenerated();
		const fromId = this.armyLocationPointId;
		const target = this.findPointById(pointId);
		if (!target) return null;
		const path = this.findShortestPath(fromId, pointId);
		return path ? path.distance : null;
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
		if (nextRemaining > 0) return;

		// Arrived.
		const toPointId = this.travel.toPointId;
		const fromPointId = this.travel.fromPointId;
		const distanceTotal = this.travel.distanceTotal;
		const speedPerTick = this.travel.speedPerTick;
		this.armyLocationPointId = toPointId;

		const target = this.findPointById(toPointId);
		const needsEncounter = !!target && target.owner !== 'player';
		if (needsEncounter) {
			// Combat is started manually from the UI.
			this.travel = { status: 'arrived', fromPointId, toPointId, distanceTotal, speedPerTick };
			this.pendingEncounter = { kind: 'capture', pointId: toPointId };
			this.publishTravel();
			return;
		}

		// Friendly arrival: stop immediately.
		this.travel = { status: 'idle' };
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

	private getArmyWorldPosition(): { x: number; y: number } {
		this.ensureWorldMapGenerated();

		if (this.travel.status !== 'travelling') {
			const id = this.travel.status === 'arrived' ? this.travel.toPointId : this.armyLocationPointId;
			const p = this.findPointById(id) ?? this.findPointById('player-kingdom');
			return p ? { x: p.x, y: p.y } : { x: 0.5, y: 0.55 };
		}

		const traveled = Math.max(0, this.travel.distanceTotal - this.travel.distanceRemaining);
		let remaining = traveled;
		for (let i = 0; i < this.travel.pathSegmentDistances.length; i++) {
			const segDist = this.travel.pathSegmentDistances[i] ?? 0;
			const aId = this.travel.pathPointIds[i];
			const bId = this.travel.pathPointIds[i + 1];
			const a = aId ? this.findPointById(aId) : undefined;
			const b = bId ? this.findPointById(bId) : undefined;
			if (!a || !b) continue;

			if (remaining <= segDist || i === this.travel.pathSegmentDistances.length - 1) {
				const t = segDist > 0 ? Math.max(0, Math.min(1, remaining / segDist)) : 1;
				return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
			}
			remaining -= segDist;
		}

		const lastId = this.travel.pathPointIds[this.travel.pathPointIds.length - 1];
		const last = lastId ? this.findPointById(lastId) : undefined;
		return last ? { x: last.x, y: last.y } : { x: 0.5, y: 0.55 };
	}

	private addPoint(point: WorldPoint): void {
		this.worldMap.points.push(point);
	}

	private connectPoints(aId: string, bId: string, distance: number): void {
		const a = this.findPointById(aId);
		const b = this.findPointById(bId);
		if (!a || !b) throw new Error('Invalid graph edge.');
		const dist = Math.max(1, Math.floor(distance));
		if (!a.neighbors.some((n) => n.pointId === bId)) a.neighbors.push({ pointId: bId, distance: dist });
		if (!b.neighbors.some((n) => n.pointId === aId)) b.neighbors.push({ pointId: aId, distance: dist });
	}

	private expandFromWithNewPois(parentId: string, count: number): void {
		this.ensureWorldMapGenerated();
		const parent = this.findPointById(parentId);
		if (!parent) return;

		const n = Math.max(0, Math.floor(count));
		for (let i = 0; i < n; i++) {
			const poiId = `poi-${this.worldMap.nextPoiSeq++}`;
			const kind = pickOne(this.worldRng, ['town', 'ruins', 'camp'] as const);
			const hops = parent.hopsFromKingdom + 1;
			const pos = this.generateOutwardPosition(parent, i, n);
			const defenders = this.generateDefenders(hops);
			const point: WorldPoint = {
				id: poiId,
				name: kind === 'town' ? `Town ${this.worldMap.nextPoiSeq - 1}` : kind === 'ruins' ? `Ruins ${this.worldMap.nextPoiSeq - 1}` : `Camp ${this.worldMap.nextPoiSeq - 1}`,
				kind,
				x: pos.x,
				y: pos.y,
				owner: 'neutral',
				defenders,
				neighbors: [],
				hopsFromKingdom: hops,
				layoutAngleRad: pos.angleRad,
				layoutRadius: pos.radius
			};
			this.addPoint(point);

			const edgeDistance = this.generateEdgeDistance(hops);
			this.connectPoints(parent.id, point.id, edgeDistance);
		}

		this.recomputeHopsFromKingdom();
	}

	private generateDefenders(hopsFromKingdom: number): ArmyUnitComponent[] {
		// Keep it simple now; hooks are here for incremental difficulty scaling later.
		const baseMin = 2;
		const baseMax = 3;
		const bonus = Math.max(0, Math.min(3, Math.floor(hopsFromKingdom / 2)));
		const defendersCount = randInt(this.worldRng, baseMin + bonus, baseMax + bonus);
		const defenders: ArmyUnitComponent[] = [];
		for (let j = 0; j < defendersCount; j++) {
			const u = pickOne(this.worldRng, this.unitDefs);
			defenders.push(createArmyUnitFromDef(u));
		}
		return defenders;
	}

	private generateEdgeDistance(hopsFromKingdom: number): number {
		// Numeric, seeded distances; future scaling can use hopsFromKingdom.
		const base = randInt(this.worldRng, 8, 14);
		const depthBonus = Math.max(0, Math.min(10, hopsFromKingdom * 2));
		return base + depthBonus;
	}

	private generateOutwardPosition(parent: WorldPoint, childIndex: number, childCount: number): { x: number; y: number; angleRad: number; radius: number } {
		const centerX = 0.5;
		const centerY = 0.55;
		const baseRadiusStep = 0.12;
		const jitter = 0.03;
		const spread = Math.PI * 0.9;

		const parentAngle = Number.isFinite(parent.layoutAngleRad) ? parent.layoutAngleRad : 0;
		const parentRadius = Number.isFinite(parent.layoutRadius) ? parent.layoutRadius : 0;
		const slot = childCount <= 1 ? 0.5 : childIndex / (childCount - 1);
		const angle = parentAngle + (slot - 0.5) * spread + (this.worldRng() - 0.5) * 0.35;
		const radius = parentRadius + baseRadiusStep + this.worldRng() * jitter;

		let x = centerX + Math.cos(angle) * radius;
		let y = centerY + Math.sin(angle) * radius;
		// Clamp to screen-ish area (normalized space).
		x = Math.max(0.06, Math.min(0.94, x));
		y = Math.max(0.06, Math.min(0.94, y));
		return { x, y, angleRad: angle, radius };
	}

	private recomputeHopsFromKingdom(): void {
		this.ensureWorldMapGenerated();
		const startId = 'player-kingdom';
		const dist = new Map<string, number>();
		const q: string[] = [startId];
		dist.set(startId, 0);

		while (q.length > 0) {
			const id = q.shift()!;
			const p = this.findPointById(id);
			if (!p) continue;
			const d = dist.get(id) ?? 0;
			for (const n of p.neighbors) {
				if (dist.has(n.pointId)) continue;
				dist.set(n.pointId, d + 1);
				q.push(n.pointId);
			}
		}

		for (const p of this.worldMap.points) {
			p.hopsFromKingdom = dist.get(p.id) ?? p.hopsFromKingdom ?? 0;
		}
	}

	private findShortestPath(fromId: string, toId: string): { distance: number; pathPointIds: string[]; pathSegmentDistances: number[] } | null {
		this.ensureWorldMapGenerated();
		if (fromId === toId) return { distance: 0, pathPointIds: [fromId], pathSegmentDistances: [] };

		const dist = new Map<string, number>();
		const prev = new Map<string, string>();
		const visited = new Set<string>();
		const frontier = new Set<string>();
		frontier.add(fromId);
		dist.set(fromId, 0);

		while (frontier.size > 0) {
			// Pick the frontier node with the smallest distance (graph is small; keep it simple).
			let current: string | null = null;
			let best = Number.POSITIVE_INFINITY;
			for (const id of frontier) {
				const d = dist.get(id) ?? Number.POSITIVE_INFINITY;
				if (d < best) {
					best = d;
					current = id;
				}
			}
			if (!current) break;
			frontier.delete(current);
			if (visited.has(current)) continue;
			visited.add(current);
			if (current === toId) break;

			const p = this.findPointById(current);
			if (!p) continue;
			const base = dist.get(current) ?? 0;
			for (const n of p.neighbors) {
				const cand = base + Math.max(1, Math.floor(n.distance));
				const prevBest = dist.get(n.pointId);
				if (prevBest == null || cand < prevBest) {
					dist.set(n.pointId, cand);
					prev.set(n.pointId, current);
					frontier.add(n.pointId);
				}
			}
		}

		const total = dist.get(toId);
		if (total == null || !Number.isFinite(total)) return null;

		// Reconstruct path.
		const path: string[] = [];
		let cur: string | undefined = toId;
		while (cur) {
			path.push(cur);
			if (cur === fromId) break;
			cur = prev.get(cur);
		}
		path.reverse();
		if (path[0] !== fromId) return null;

		const segs: number[] = [];
		for (let i = 0; i < path.length - 1; i++) {
			const a = this.findPointById(path[i]!);
			const bId = path[i + 1]!;
			const edge = a?.neighbors.find((n) => n.pointId === bId);
			segs.push(edge ? Math.max(1, Math.floor(edge.distance)) : 1);
		}

		return { distance: total, pathPointIds: path, pathSegmentDistances: segs };
	}
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
