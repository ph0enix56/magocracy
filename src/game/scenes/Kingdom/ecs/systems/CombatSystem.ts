import type { ECSManager, System } from '../ECSBase';
import type { ArmyUnitComponent } from '../components';
import { getUnitDef } from '../../data/buildings';
import { eventBus } from '../../../../../eventBus';
import {
	CombatSession,
	resolveCombat,
	type CombatOptions,
	type CombatResult,
	type CombatSnapshot,
	type CombatUnit
} from '../../../../../shared/combat/combatCore';

function clampInt(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.floor(n);
}

function toCombatUnit(unit: ArmyUnitComponent): CombatUnit {
	const def = getUnitDef(unit.unitId);
	if (!def) throw new Error(`Missing unit def for unitId '${unit.unitId}'`);

	return {
		unitId: unit.unitId,
		name: unit.name,
		assetPath: unit.assetPath,
		maxHealth: unit.health,
		health: unit.health,
		drFlat: unit.drFlat,
		drPercent: unit.drPercent,
		actionsPerTurn: unit.actionsPerTurn,
		actions: def.actions,
		trainingLevel: unit.trainingLevel,
		trainingAttackDamagePerLevel: unit.training?.def?.attackDamage ?? 0
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
		this.session = new CombatSession(armyA.map(toCombatUnit), armyB.map(toCombatUnit));
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
		return resolveCombat(armyA.map(toCombatUnit), armyB.map(toCombatUnit), options);
	}
}
