import { eventBus } from '../../../../eventBus';
import type { ArmyUnitComponent, BuildingComponent, PositionComponent, RenderComponent } from './components';

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
	shopOffers: Array<string | null> = Array.from({ length: 4 }, () => null);
	private nextArmyUnitSeq = 1;

	constructor() {
		// [WIP] Global resource initialization
		this.resources.set('stone', 1000);
		this.resources.set('wood', 1000);
		this.resources.set('food', 1000);
		this.resources.set('mana', 1000);
		this.resources.set('gold', 1000);

		// [WIP] Starter blueprints for testing
		this.blueprintInventory.set('mine', 2);
		this.blueprintInventory.set('lumber_camp', 1);
		this.blueprintInventory.set('farm', 1);
		this.blueprintInventory.set('house', 1);
		this.blueprintInventory.set('sword_barracks', 1);
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
		return entity;
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
		const units = this.getEntities()
			.filter(e => !!e.armyUnit)
			.map(e => {
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
