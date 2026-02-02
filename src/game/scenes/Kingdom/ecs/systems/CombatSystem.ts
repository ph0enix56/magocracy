import type { ECSManager, System } from '../ECSBase';
import type { ArmyUnitComponent } from '../components';
import type { UnitAttackDef } from '../../data/buildings';
import { getUnitDef } from '../../data/buildings';
import { eventBus } from '../../../../../eventBus';

export type CombatWinner = 'armyA' | 'armyB' | 'draw';

export type CombatResultUnit = {
	unitId: string;
	name: string;
	assetPath: string;
	health: number;
	maxHealth: number;
};

export type CombatResult = {
	winner: CombatWinner;
	rounds: number;
	armyA: CombatResultUnit[];
	armyB: CombatResultUnit[];
};

type CombatUnitState = {
	unitId: string;
	name: string;
	assetPath: string;
	maxHealth: number;
	health: number;
	drFlat: number;
	drPercent: number;
	actionsPerTurn: number;
	actions: UnitAttackDef[];
	actionCursor: number;
	trainingLevel: number;
	trainingAttackDamagePerLevel: number;
};

function clampInt(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.floor(n);
}

function clampNonNegInt(n: number): number {
	return Math.max(0, clampInt(n));
}

function effectiveDamage(attacker: CombatUnitState, action: UnitAttackDef): number {
	const base = clampInt(action.damage);
	if (!action.canUpgrade) return base;
	return base + clampInt(attacker.trainingLevel) * clampInt(attacker.trainingAttackDamagePerLevel);
}

function computeDamageTaken(rawDamage: number, target: CombatUnitState): number {
	const afterFlat = Math.max(0, clampInt(rawDamage) - clampInt(target.drFlat));
	const percent = Math.min(100, Math.max(0, clampInt(target.drPercent)));
	const afterPercent = Math.floor(afterFlat * (1 - percent / 100));
	return Math.max(0, afterPercent);
}

function pickTargetsInRange(enemyArmy: CombatUnitState[], maxEnemiesInRange: number, targeting: UnitAttackDef['targeting']): CombatUnitState[] {
	if (maxEnemiesInRange <= 0) return [];
	const candidates = enemyArmy.slice(0, maxEnemiesInRange);
	if (candidates.length === 0) return [];

	switch (targeting) {
		case 'first':
			return candidates[0] ? [candidates[0]] : [];
		case 'last':
			{
				const last = candidates[candidates.length - 1];
				return last ? [last] : [];
			}
		case 'all':
			return candidates;
		case 'weak': {
			const first = candidates[0];
			if (!first) return [];
			let best = first;
			for (const c of candidates) {
				if (c.health < best.health) best = c;
			}
			return [best];
		}
		default:
			return candidates[0] ? [candidates[0]] : [];
	}
}

function removeDefeated(army: CombatUnitState[]): void {
	for (let i = army.length - 1; i >= 0; i--) {
		const u = army[i];
		if (!u) continue;
		if (u.health <= 0) army.splice(i, 1);
	}
}

function takeTurn(attacker: CombatUnitState, attackerIndex: number, enemyArmy: CombatUnitState[]): void {
	let actionPoints = clampInt(attacker.actionsPerTurn);
	if (actionPoints <= 0) return;
	if (attacker.actions.length === 0) return;

	let guard = 0;
	while (actionPoints > 0 && enemyArmy.length > 0) {
		guard++;
		if (guard > 1_000) {
			// Hard stop in case of malformed data (e.g. 0-cost actions).
			return;
		}

		const action = attacker.actions[attacker.actionCursor];
		if (!action) return;
		const cost = Math.max(1, clampInt(action.actionPointCost));
		if (cost > actionPoints) return;

		actionPoints -= cost;
		attacker.actionCursor = (attacker.actionCursor + 1) % attacker.actions.length;

		const maxEnemiesInRange = clampInt(action.range) - attackerIndex;
		const targets = pickTargetsInRange(enemyArmy, maxEnemiesInRange, action.targeting);
		if (targets.length === 0) continue;

		const raw = effectiveDamage(attacker, action);
		for (const t of targets) {
			const taken = computeDamageTaken(raw, t);
			t.health -= taken;
		}

		removeDefeated(enemyArmy);
	}
}

export type CombatLogEntry = {
	seq: number;
	text: string;
};

export type CombatSnapshot = {
	status: 'idle' | 'running' | 'finished';
	winner?: CombatWinner;
	round: number;
	activeSide: 'armyA' | 'armyB';
	armyA: CombatResultUnit[];
	armyB: CombatResultUnit[];
	log: CombatLogEntry[];
};

type CombatPhase = {
	side: 'armyA' | 'armyB';
	unitIndex: number;
	remainingAp: number;
};

function pickTargetIndicesInRange(enemyArmy: CombatUnitState[], maxEnemiesInRange: number, targeting: UnitAttackDef['targeting']): number[] {
	if (maxEnemiesInRange <= 0) return [];
	const count = Math.min(enemyArmy.length, maxEnemiesInRange);
	if (count <= 0) return [];

	switch (targeting) {
		case 'first':
			return [0];
		case 'last':
			return [count - 1];
		case 'all':
			return Array.from({ length: count }, (_, i) => i);
		case 'weak': {
			let bestIdx = 0;
			let bestHp = enemyArmy[0]!.health;
			for (let i = 1; i < count; i++) {
				const hp = enemyArmy[i]!.health;
				if (hp < bestHp) {
					bestHp = hp;
					bestIdx = i;
				}
			}
			return [bestIdx];
		}
		default:
			return [0];
	}
}

function fmtSide(side: 'armyA' | 'armyB'): string {
	return side === 'armyA' ? 'A' : 'B';
}

export class CombatSession {
	private a: CombatUnitState[];
	private b: CombatUnitState[];
	private round = 1;
	private phase: CombatPhase = { side: 'armyA', unitIndex: 0, remainingAp: 0 };
	private finishedWinner: CombatWinner | undefined;
	private logSeq = 1;
	private log: CombatLogEntry[] = [];

	constructor(armyA: ArmyUnitComponent[], armyB: ArmyUnitComponent[]) {
		this.a = armyA.map(toState);
		this.b = armyB.map(toState);
		if (this.a.length === 0 || this.b.length === 0) {
			this.finishedWinner = this.a.length > 0 ? 'armyA' : this.b.length > 0 ? 'armyB' : 'draw';
		}
	}

	getSnapshot(): CombatSnapshot {
		const status: CombatSnapshot['status'] = this.finishedWinner ? 'finished' : 'running';
		return {
			status,
			winner: this.finishedWinner,
			round: this.finishedWinner ? this.round - 1 : this.round,
			activeSide: this.phase.side,
			armyA: this.a.map(toResultUnit),
			armyB: this.b.map(toResultUnit),
			log: [...this.log]
		};
	}

	resetLog(): void {
		this.log = [];
		this.logSeq = 1;
	}

	step(): CombatLogEntry | null {
		if (this.finishedWinner) return null;
		if (this.a.length === 0 || this.b.length === 0) {
			this.finish();
			return null;
		}

		const myArmy = this.phase.side === 'armyA' ? this.a : this.b;
		const enemyArmy = this.phase.side === 'armyA' ? this.b : this.a;

		// Advance to next available unit in this phase.
		while (this.phase.unitIndex >= myArmy.length) {
			this.advanceSideOrRound();
			if (this.finishedWinner) return null;
			return this.step();
		}

		const attacker = myArmy[this.phase.unitIndex];
		if (!attacker) {
			this.phase.unitIndex += 1;
			this.phase.remainingAp = 0;
			return this.step();
		}

		if (this.phase.remainingAp <= 0) {
			this.phase.remainingAp = clampNonNegInt(attacker.actionsPerTurn);
		}
		if (this.phase.remainingAp <= 0 || attacker.actions.length === 0) {
			this.phase.unitIndex += 1;
			this.phase.remainingAp = 0;
			return this.step();
		}

		const action = attacker.actions[attacker.actionCursor];
		if (!action) {
			this.phase.unitIndex += 1;
			this.phase.remainingAp = 0;
			return this.step();
		}

		const cost = Math.max(1, clampInt(action.actionPointCost));
		if (cost > this.phase.remainingAp) {
			this.phase.unitIndex += 1;
			this.phase.remainingAp = 0;
			return this.step();
		}

		this.phase.remainingAp -= cost;
		attacker.actionCursor = (attacker.actionCursor + 1) % attacker.actions.length;

		const maxEnemiesInRange = clampInt(action.range) - this.phase.unitIndex;
		const targetIdxs = pickTargetIndicesInRange(enemyArmy, maxEnemiesInRange, action.targeting);

		const raw = effectiveDamage(attacker, action);
		let totalTaken = 0;
		const defeated: string[] = [];

		for (const idx of targetIdxs) {
			const t = enemyArmy[idx];
			if (!t) continue;
			const taken = computeDamageTaken(raw, t);
			t.health -= taken;
			totalTaken += taken;
			if (t.health <= 0) {
				defeated.push(`${t.name} (${fmtSide(this.otherSide())}[${idx + 1}])`);
			}
		}

		removeDefeated(enemyArmy);
		if (this.a.length === 0 || this.b.length === 0) this.finish();

		const pos = this.phase.unitIndex + 1;
		const actionText = `${attacker.name} (${fmtSide(this.phase.side)}[${pos}]) used ${action.targeting} (range ${clampInt(action.range)})`; 
		let targetText = '';
		if (targetIdxs.length === 0) {
			targetText = ' but could not reach any enemy.';
		} else if (targetIdxs.length === 1) {
			targetText = ` dealing ${totalTaken} damage.`;
		} else {
			targetText = ` dealing ${totalTaken} total damage.`;
		}
		const defeatedText = defeated.length > 0 ? ` Defeated: ${defeated.join(', ')}.` : '';

		const entry: CombatLogEntry = {
			seq: this.logSeq++,
			text: `R${this.round} ${fmtSide(this.phase.side)}: ${actionText}${targetText}${defeatedText}`
		};
		this.log.push(entry);

		// IMPORTANT: this session advances one *action* per step().
		// If the unit just ran out of action points, end its turn now so the
		// next step() continues with the next unit instead of "refreshing" AP.
		if (!this.finishedWinner && this.phase.remainingAp <= 0) {
			this.phase.unitIndex += 1;
			this.phase.remainingAp = 0;
		}

		return entry;
	}

	private otherSide(): 'armyA' | 'armyB' {
		return this.phase.side === 'armyA' ? 'armyB' : 'armyA';
	}

	private advanceSideOrRound(): void {
		if (this.phase.side === 'armyA') {
			this.phase = { side: 'armyB', unitIndex: 0, remainingAp: 0 };
			return;
		}
		this.round += 1;
		this.phase = { side: 'armyA', unitIndex: 0, remainingAp: 0 };
	}

	private finish(): void {
		if (this.a.length > 0 && this.b.length === 0) this.finishedWinner = 'armyA';
		else if (this.b.length > 0 && this.a.length === 0) this.finishedWinner = 'armyB';
		else this.finishedWinner = 'draw';
		// Move round cursor forward for final snapshot calculation consistency.
		this.advanceSideOrRound();
	}
}

function toState(u: ArmyUnitComponent): CombatUnitState {
	const def = getUnitDef(u.unitId);
	if (!def) throw new Error(`Missing unit def for unitId '${u.unitId}'`);

	return {
		unitId: u.unitId,
		name: u.name,
		assetPath: u.assetPath,
		maxHealth: clampInt(u.health),
		health: clampInt(u.health),
		drFlat: clampInt(u.drFlat),
		drPercent: clampInt(u.drPercent),
		actionsPerTurn: clampInt(u.actionsPerTurn),
		actions: def.actions,
		actionCursor: 0,
		trainingLevel: clampInt(u.trainingLevel),
		trainingAttackDamagePerLevel: clampInt(u.training?.def?.attackDamage ?? 0)
	};
}

function toResultUnit(u: CombatUnitState): CombatResultUnit {
	return {
		unitId: u.unitId,
		name: u.name,
		assetPath: u.assetPath,
		health: Math.max(0, u.health),
		maxHealth: Math.max(0, u.maxHealth)
	};
}

export type CombatOptions = {
	maxRounds?: number;
};

export function resolveCombat(armyA: ArmyUnitComponent[], armyB: ArmyUnitComponent[], options?: CombatOptions): CombatResult {
	const maxRounds = options?.maxRounds ?? 10_000;

	const a = armyA.map(toState);
	const b = armyB.map(toState);

	let rounds = 0;
	while (a.length > 0 && b.length > 0 && rounds < maxRounds) {
		rounds += 1;

		for (let i = 0; i < a.length && b.length > 0; i++) {
			const attacker = a[i];
			if (!attacker) continue;
			if (attacker.health <= 0) continue;
			takeTurn(attacker, i, b);
		}

		if (b.length === 0) break;

		for (let i = 0; i < b.length && a.length > 0; i++) {
			const attacker = b[i];
			if (!attacker) continue;
			if (attacker.health <= 0) continue;
			takeTurn(attacker, i, a);
		}
	}

	let winner: CombatWinner = 'draw';
	if (a.length > 0 && b.length === 0) winner = 'armyA';
	else if (b.length > 0 && a.length === 0) winner = 'armyB';

	return {
		winner,
		rounds,
		armyA: a.map(toResultUnit),
		armyB: b.map(toResultUnit)
	};
}

export class CombatSystem implements System {
	private session: CombatSession | null = null;

	constructor(_world: ECSManager) {
		this.broadcastIdle();
	}

	update(_delta: number, _time: number): void {}
	advanceTick(): void {}

	startCombat(armyA: ArmyUnitComponent[], armyB: ArmyUnitComponent[]): void {
		this.session = new CombatSession(armyA, armyB);
		this.broadcast();
	}

	getSnapshot(): CombatSnapshot {
		if (!this.session) {
			return { status: 'idle', round: 0, activeSide: 'armyA', armyA: [], armyB: [], log: [] };
		}
		return this.session.getSnapshot();
	}

	stepCombat(steps = 1): void {
		if (!this.session) throw new Error('No active combat.');
		const n = Math.max(1, clampInt(steps));
		for (let i = 0; i < n; i++) {
			const entry = this.session.step();
			if (!entry) break;
		}
		this.broadcast();
	}

	resetCombat(): void {
		this.session = null;
		this.broadcastIdle();
	}

	broadcast(): void {
		if (!this.session) return this.broadcastIdle();
		eventBus.publishGameToUi({ type: 'combat-state-updated', state: this.session.getSnapshot() });
	}

	private broadcastIdle(): void {
		eventBus.publishGameToUi({
			type: 'combat-state-updated',
			state: { status: 'idle', round: 0, activeSide: 'armyA', armyA: [], armyB: [], log: [] }
		});
	}

	static resolveCombat(armyA: ArmyUnitComponent[], armyB: ArmyUnitComponent[], options?: CombatOptions): CombatResult {
		return resolveCombat(armyA, armyB, options);
	}
}
