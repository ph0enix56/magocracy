import { eventBus } from '../../../../eventBus';
import type { ArmyUnitComponent, BuildingComponent, PositionComponent, RenderComponent } from './components';
import { configuration } from '../../../configuration';

export interface Entity {
	id: string;
	kind: 'tile' | 'armyUnit';
	// [WIP] Half-assed ECS with components coupled to entities
	position: PositionComponent;
	building?: BuildingComponent;
	armyUnit?: ArmyUnitComponent;
	render?: RenderComponent;
}

export interface System {
	update(delta: number, time: number): void;
	advanceTick(): void;
}

export class ECSManager {
	entities: Map<string, Entity> = new Map();
	systems: System[] = [];

	// [WIP] Remaining global state
	resources: Map<string, number> = new Map();
	blueprintInventory: Map<string, number> = new Map();
	shopOffers: Array<string | null> = Array.from({ length: configuration.shop.size }, () => null);
	// Explicit, player-controlled ordering of army units (used for UI + combat).
	armyUnitOrder: string[] = [];
	private nextArmyUnitSeq = 1;

	constructor() {
		for (const [key, value] of Object.entries(configuration.economy.startingResources)) {
			this.resources.set(key, value);
		}

		for (const [buildingId, count] of Object.entries(configuration.economy.starterBlueprintInventory)) {
			this.blueprintInventory.set(buildingId, count);
		}
	}

	spawnArmyUnit(component: Omit<ArmyUnitComponent, 'training'> & { training: ArmyUnitComponent['training'] }): Entity {
		const id = `unit:${component.unitId}:${this.nextArmyUnitSeq++}`;
		const entity: Entity = {
			id,
			kind: 'armyUnit',
			// Keep army unit entities away from the board coordinate space.
			position: { q: 1_000_000 + this.nextArmyUnitSeq, r: 1_000_000 },
			armyUnit: component as ArmyUnitComponent
		};
		this.addEntity(entity);
		this.ensureArmyUnitOrderSynced();
		return entity;
	}

	private ensureArmyUnitOrderSynced(): void {
		const existingArmyUnitIds = new Set(
			this.getEntities()
				.filter((e) => e.kind === 'armyUnit' && !!e.armyUnit)
				.map((e) => e.id)
		);

		// Keep only still-existing units.
		this.armyUnitOrder = this.armyUnitOrder.filter((id) => existingArmyUnitIds.has(id));

		// Append any new units that weren't in the order yet.
		for (const id of existingArmyUnitIds) {
			if (!this.armyUnitOrder.includes(id)) this.armyUnitOrder.push(id);
		}
	}

	reorderArmyUnitWithThrow(unitEntityId: string, direction: 'up' | 'down'): void {
		this.ensureArmyUnitOrderSynced();
		const idx = this.armyUnitOrder.indexOf(unitEntityId);
		if (idx < 0) throw new Error('Invalid unit.');
		const delta = direction === 'up' ? -1 : 1;
		const next = idx + delta;
		if (next < 0 || next >= this.armyUnitOrder.length) return;
		const tmp = this.armyUnitOrder[next];
		this.armyUnitOrder[next] = this.armyUnitOrder[idx]!;
		this.armyUnitOrder[idx] = tmp!;
	}

	getOrderedArmyUnitEntities(): Entity[] {
		this.ensureArmyUnitOrderSynced();
		const out: Entity[] = [];
		for (const id of this.armyUnitOrder) {
			const e = this.getEntity(id);
			if (e?.armyUnit) out.push(e);
		}
		return out;
	}

	getOrderedArmyUnits(): ArmyUnitComponent[] {
		return this.getOrderedArmyUnitEntities().map((e) => e.armyUnit!);
	}

	private computeNextTrainCost(unit: ArmyUnitComponent): Record<string, number> {
		const levelMult = Math.pow(unit.training.costMult, unit.trainingLevel);
		const out: Record<string, number> = {};
		for (const [res, base] of Object.entries(unit.training.costBase)) {
			out[res] = Math.ceil(base * levelMult);
		}
		return out;
	}

	broadcastArmyState(): void {
		const units = this.getOrderedArmyUnitEntities().map((e) => {
			const u = e.armyUnit!;
			return {
				entityId: e.id,
					unitId: u.unitId,
					name: u.name,
					textureId: u.textureId,
					assetPath: u.assetPath,
					speed: u.speed,
					health: u.health,
					drFlat: u.drFlat,
					drPercent: u.drPercent,
					actionsPerTurn: u.actionsPerTurn,
					trainingLevel: u.trainingLevel,
					trainingStatus: u.training.status,
					trainingProgress: u.training.time > 0 ? (u.training.progress / u.training.time) * 100 : 0,
					nextTrainCost: this.computeNextTrainCost(u),
					trainTime: u.training.time
			};
		});
		eventBus.publishGameToUi({ type: 'army-state-updated', units });
	}

	addEntity(entity: Entity) {
		this.entities.set(entity.id, entity);
	}

	getEntity(id: string) {
		return this.entities.get(id);
	}

	getEntities() {
		return Array.from(this.entities.values());
	}

	// Registers a system to be updated through the Manager
	addSystem(system: System) {
		this.systems.push(system);
	}

	// Update loop method to be called from the controlling scene (as fast as possible)
	update(time: number, delta: number) {
		for (const system of this.systems) {
			system.update(delta, time);
		}
	}

	advanceTick() {
		for (const system of this.systems) {
			system.advanceTick();
		}
	}

	// [WIP] Broadcast current resources to UI
	broadcastResources() {
		for (const [key, value] of this.resources) {
			eventBus.publishGameToUi({
				type: 'resource-updated',
				key: key,
				value: value
			});
		}
	}

	// [WIP] Broadcast blueprint inventory to UI
	broadcastBlueprintInventory() {
		const inventory: Record<string, number> = {};
		for (const [buildingId, count] of this.blueprintInventory) {
			if (count > 0) inventory[buildingId] = count;
		}
		eventBus.publishGameToUi({
			type: 'blueprint-inventory-updated',
			inventory
		});
	}
}
