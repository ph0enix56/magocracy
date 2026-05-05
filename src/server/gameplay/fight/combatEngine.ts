import type { AttackAction } from '../../../shared/domain/types';
import type {
	CombatSnapshot,
	CombatUnit as SharedCombatUnit,
	CombatLogEntry,
	CombatWinner,
	CombatStatus,
	CombatActiveSide
} from '../../../shared/domain/combatTypes';

export type CombatUnit = {
	unitDefId: string;
	name: string;
	assetPath: string;
	maxHealth: number;
	health: number;
	drFlat: number;
	drPercent: number;
	actionPoints: number;
	actions: AttackAction[];
};

type CombatResultUnit = SharedCombatUnit;

export type CombatResult = {
	winner: CombatWinner;
	rounds: number;
	armyA: CombatResultUnit[];
	armyB: CombatResultUnit[];
};

export type CombatOptions = {
	maxRounds?: number;
};

type CombatUnitState = CombatUnit & {
	actionCursor: number;
};

type CombatPhase = {
	side: CombatActiveSide;
	unitIndex: number;
	remainingAp: number;
};

function clampInt(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.floor(n);
}

function clampNonNegInt(n: number): number {
	return Math.max(0, clampInt(n));
}

function effectiveDamage(action: AttackAction): number {
	const base = clampInt(action.damage);
	return base;
}

function computeDamageTaken(rawDamage: number, target: CombatUnitState): number {
	const afterFlat = Math.max(0, clampInt(rawDamage) - clampInt(target.drFlat));
	const percent = Math.min(100, Math.max(0, clampInt(target.drPercent)));
	const afterPercent = Math.floor(afterFlat * (1 - percent / 100));
	return Math.max(0, afterPercent);
}

function pickTargetsInRange(enemyArmy: CombatUnitState[], maxEnemiesInRange: number, targeting: AttackAction['targeting']): CombatUnitState[] {
	if (maxEnemiesInRange <= 0) return [];
	const candidates = enemyArmy.slice(0, maxEnemiesInRange);
	if (candidates.length === 0) return [];

	switch (targeting) {
		case 'first':
			return candidates[0] ? [candidates[0]] : [];
		case 'last': {
			const last = candidates[candidates.length - 1];
			return last ? [last] : [];
		}
		case 'all':
			return candidates;
		case 'weak': {
			const first = candidates[0];
			if (!first) return [];
			let best = first;
			for (const candidate of candidates) {
				if (candidate.health < best.health) best = candidate;
			}
			return [best];
		}
		default:
			return candidates[0] ? [candidates[0]] : [];
	}
}

function removeDefeated(army: CombatUnitState[]): void {
	for (let i = army.length - 1; i >= 0; i--) {
		const unit = army[i];
		if (!unit) continue;
		if (unit.health <= 0) army.splice(i, 1);
	}
}

function takeTurn(attacker: CombatUnitState, attackerIndex: number, enemyArmy: CombatUnitState[]): void {
	let actionPoints = clampInt(attacker.actionPoints);
	if (actionPoints <= 0) return;
	if (attacker.actions.length === 0) return;

	let guard = 0;
	while (actionPoints > 0 && enemyArmy.length > 0) {
		guard += 1;
		if (guard > 1_000) return;

		const action = attacker.actions[attacker.actionCursor];
		if (!action) return;

		const cost = Math.max(1, clampInt(action.actionPointCost));
		if (cost > actionPoints) return;

		actionPoints -= cost;
		attacker.actionCursor = (attacker.actionCursor + 1) % attacker.actions.length;

		const maxEnemiesInRange = clampInt(action.range) - attackerIndex;
		const targets = pickTargetsInRange(enemyArmy, maxEnemiesInRange, action.targeting);
		if (targets.length === 0) continue;

		const raw = effectiveDamage(action);
		for (const target of targets) {
			const taken = computeDamageTaken(raw, target);
			target.health -= taken;
		}

		removeDefeated(enemyArmy);
	}
}

function pickTargetIndicesInRange(enemyArmy: CombatUnitState[], maxEnemiesInRange: number, targeting: AttackAction['targeting']): number[] {
	if (maxEnemiesInRange <= 0) return [];
	const count = Math.min(enemyArmy.length, maxEnemiesInRange);
	if (count <= 0) return [];

	switch (targeting) {
		case 'first':
			return [0];
		case 'last':
			return [count - 1];
		case 'all':
			return Array.from({ length: count }, (_, index) => index);
		case 'weak': {
			let bestIndex = 0;
			let bestHp = enemyArmy[0]!.health;
			for (let i = 1; i < count; i++) {
				const hp = enemyArmy[i]!.health;
				if (hp < bestHp) {
					bestHp = hp;
					bestIndex = i;
				}
			}
			return [bestIndex];
		}
		default:
			return [0];
	}
}

function fmtSide(side: CombatActiveSide): string {
	return side === 'armyA' ? 'A' : 'B';
}

function toState(unit: CombatUnit): CombatUnitState {
	return {
		...unit,
		maxHealth: clampInt(unit.maxHealth),
		health: clampInt(unit.health),
		drFlat: clampInt(unit.drFlat),
		drPercent: clampInt(unit.drPercent),
		actionPoints: clampInt(unit.actionPoints),
		actionCursor: 0
	};
}

function toResultUnit(unit: CombatUnitState): CombatResultUnit {
	return {
		unitDefId: unit.unitDefId,
		name: unit.name,
		assetPath: unit.assetPath,
		health: Math.max(0, unit.health),
		maxHealth: Math.max(0, unit.maxHealth)
	};
}

export class CombatSession {
	private a: CombatUnitState[];
	private b: CombatUnitState[];
	private round = 1;
	private phase: CombatPhase = { side: 'armyA', unitIndex: 0, remainingAp: 0 };
	private finishedWinner: CombatWinner | undefined;
	private logSeq = 1;
	private log: CombatLogEntry[] = [];

	constructor(armyA: CombatUnit[], armyB: CombatUnit[]) {
		this.a = armyA.map(toState);
		this.b = armyB.map(toState);
		if (this.a.length === 0 || this.b.length === 0) {
			this.finishedWinner = this.a.length > 0 ? 'armyA' : this.b.length > 0 ? 'armyB' : 'draw';
		}
	}

	getSnapshot(): CombatSnapshot {
		const status: CombatStatus = this.finishedWinner ? 'finished' : 'running';
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

	step(): CombatLogEntry | null {
		if (this.finishedWinner) return null;
		if (this.a.length === 0 || this.b.length === 0) {
			this.finish();
			return null;
		}

		const myArmy = this.phase.side === 'armyA' ? this.a : this.b;
		const enemyArmy = this.phase.side === 'armyA' ? this.b : this.a;

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
			this.phase.remainingAp = clampNonNegInt(attacker.actionPoints);
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
		const targetIndexes = pickTargetIndicesInRange(enemyArmy, maxEnemiesInRange, action.targeting);
		const raw = effectiveDamage(action);
		let totalTaken = 0;
		const defeated: string[] = [];

		for (const index of targetIndexes) {
			const target = enemyArmy[index];
			if (!target) continue;
			const taken = computeDamageTaken(raw, target);
			target.health -= taken;
			totalTaken += taken;
			if (target.health <= 0) {
				defeated.push(`${target.name} (${fmtSide(this.otherSide())}[${index + 1}])`);
			}
		}

		removeDefeated(enemyArmy);
		if (this.a.length === 0 || this.b.length === 0) this.finish();

		const position = this.phase.unitIndex + 1;
		const actionText = `${attacker.name} (${fmtSide(this.phase.side)}[${position}]) used ${action.targeting} (range ${clampInt(action.range)})`;
		let targetText = '';
		if (targetIndexes.length === 0) {
			targetText = ' but could not reach any enemy.';
		} else if (targetIndexes.length === 1) {
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
		this.advanceSideOrRound();
	}
}

export function resolveCombat(armyA: CombatUnit[], armyB: CombatUnit[], options?: CombatOptions): CombatResult {
	const maxRounds = options?.maxRounds ?? 10_000;
	const a = armyA.map(toState);
	const b = armyB.map(toState);

	let rounds = 0;
	while (a.length > 0 && b.length > 0 && rounds < maxRounds) {
		rounds += 1;

		for (let i = 0; i < a.length && b.length > 0; i++) {
			const attacker = a[i];
			if (!attacker || attacker.health <= 0) continue;
			takeTurn(attacker, i, b);
		}

		if (b.length === 0) break;

		for (let i = 0; i < b.length && a.length > 0; i++) {
			const attacker = b[i];
			if (!attacker || attacker.health <= 0) continue;
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
