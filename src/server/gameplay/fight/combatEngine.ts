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
	initiative: number;
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

type TurnUnit = {
	side: CombatActiveSide;
	originalIndex: number;
	unit: CombatUnitState;
};

type CombatPhase = {
	turnIndex: number;
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

function getTurnOrder(a: CombatUnitState[], b: CombatUnitState[]): TurnUnit[] {
	const order: TurnUnit[] = [];
	for (let i = 0; i < a.length; i++) {
		order.push({ side: 'armyA', originalIndex: i, unit: a[i]! });
	}
	for (let i = 0; i < b.length; i++) {
		order.push({ side: 'armyB', originalIndex: i, unit: b[i]! });
	}

	order.sort((x, y) => {
		// 1. Initiative (Highest first)
		if (x.unit.initiative !== y.unit.initiative) {
			return y.unit.initiative - x.unit.initiative;
		}
		// 2. Position (Closest to front first)
		if (x.originalIndex !== y.originalIndex) {
			return x.originalIndex - y.originalIndex;
		}
		// 3. Dumb resolution (Unit ID alphabetical)
		if (x.unit.unitDefId !== y.unit.unitDefId) {
			return x.unit.unitDefId.localeCompare(y.unit.unitDefId);
		}
		// 4. Final tiebreaker: side (Army A first)
		return x.side === 'armyA' ? -1 : 1;
	});

	return order;
}

function toState(unit: CombatUnit): CombatUnitState {
	return {
		...unit,
		maxHealth: clampInt(unit.maxHealth),
		health: clampInt(unit.health),
		drFlat: clampInt(unit.drFlat),
		drPercent: clampInt(unit.drPercent),
		actionPoints: clampInt(unit.actionPoints),
		initiative: clampInt(unit.initiative),
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
	private turnOrder: TurnUnit[] = [];
	private phase: CombatPhase = { turnIndex: 0, remainingAp: 0 };
	private finishedWinner: CombatWinner | undefined;
	private logSeq = 1;
	private log: CombatLogEntry[] = [];

	constructor(armyA: CombatUnit[], armyB: CombatUnit[]) {
		this.a = armyA.map(toState);
		this.b = armyB.map(toState);
		this.turnOrder = getTurnOrder(this.a, this.b);

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

		while (this.phase.turnIndex >= this.turnOrder.length) {
			this.advanceRound();
			if (this.finishedWinner) return null;
			return this.step();
		}

		const currentTurn = this.turnOrder[this.phase.turnIndex]!;
		const attacker = currentTurn.unit;
		const myArmy = currentTurn.side === 'armyA' ? this.a : this.b;
		const enemyArmy = currentTurn.side === 'armyA' ? this.b : this.a;

		if (!attacker || attacker.health <= 0) {
			this.phase.turnIndex += 1;
			this.phase.remainingAp = 0;
			return this.step();
		}

		const currentIndex = myArmy.indexOf(attacker);
		if (currentIndex === -1) {
			// Unit was removed but health might be > 0? Should not happen if removeDefeated is consistent.
			this.phase.turnIndex += 1;
			this.phase.remainingAp = 0;
			return this.step();
		}

		if (this.phase.remainingAp <= 0) {
			this.phase.remainingAp = clampNonNegInt(attacker.actionPoints);
		}
		if (this.phase.remainingAp <= 0 || attacker.actions.length === 0) {
			this.phase.turnIndex += 1;
			this.phase.remainingAp = 0;
			return this.step();
		}

		const action = attacker.actions[attacker.actionCursor];
		if (!action) {
			this.phase.turnIndex += 1;
			this.phase.remainingAp = 0;
			return this.step();
		}

		const cost = Math.max(1, clampInt(action.actionPointCost));
		if (cost > this.phase.remainingAp) {
			this.phase.turnIndex += 1;
			this.phase.remainingAp = 0;
			return this.step();
		}

		this.phase.remainingAp -= cost;
		attacker.actionCursor = (attacker.actionCursor + 1) % attacker.actions.length;

		const maxEnemiesInRange = clampInt(action.range) - currentIndex;
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
				defeated.push(`${target.name} (${fmtSide(this.otherSide(currentTurn.side))}[${index + 1}])`);
			}
		}

		removeDefeated(enemyArmy);
		if (this.a.length === 0 || this.b.length === 0) this.finish();

		const position = currentIndex + 1;
		let targetText = '';
		if (targetIndexes.length === 0) {
			targetText = ' but could not reach any enemy.';
		} else if (targetIndexes.length === 1) {
			targetText = `, dealing ${totalTaken} damage.`;
		} else {
			targetText = `, dealing ${totalTaken} total damage.`;
		}
		const defeatedText = defeated.length > 0 ? ` Defeated: ${defeated.join(', ')}.` : '';

		const entry: CombatLogEntry = {
			seq: this.logSeq++,
			text: `R${this.round}: ${attacker.name} [${position}] used ${action.name} (range ${clampInt(action.range)})${targetText}${defeatedText}`
		};
		this.log.push(entry);

		if (!this.finishedWinner && this.phase.remainingAp <= 0) {
			this.phase.turnIndex += 1;
			this.phase.remainingAp = 0;
		}

		return entry;
	}

	private otherSide(side: CombatActiveSide): CombatActiveSide {
		return side === 'armyA' ? 'armyB' : 'armyA';
	}

	private advanceRound(): void {
		this.round += 1;
		this.phase = { turnIndex: 0, remainingAp: 0 };
	}

	private finish(): void {
		if (this.a.length > 0 && this.b.length === 0) this.finishedWinner = 'armyA';
		else if (this.b.length > 0 && this.a.length === 0) this.finishedWinner = 'armyB';
		else this.finishedWinner = 'draw';
	}
}

export function resolveCombat(armyA: CombatUnit[], armyB: CombatUnit[], options?: CombatOptions): CombatResult {
	const maxRounds = options?.maxRounds ?? 10_000;
	const a = armyA.map(toState);
	const b = armyB.map(toState);
	const turnOrder = getTurnOrder(a, b);

	let rounds = 0;
	while (a.length > 0 && b.length > 0 && rounds < maxRounds) {
		rounds += 1;

		for (const turn of turnOrder) {
			const attacker = turn.unit;
			const myArmy = turn.side === 'armyA' ? a : b;
			const enemyArmy = turn.side === 'armyA' ? b : a;

			if (!attacker || attacker.health <= 0 || enemyArmy.length === 0) continue;

			const currentIndex = myArmy.indexOf(attacker);
			if (currentIndex === -1) continue;

			takeTurn(attacker, currentIndex, enemyArmy);
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
