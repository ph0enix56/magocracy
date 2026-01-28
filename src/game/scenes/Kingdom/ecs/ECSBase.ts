import { eventBus } from '../../../../eventBus';
import type { BuildingComponent, PositionComponent, RenderComponent } from './components';

export interface Entity {
	id: string;
	// [WIP] Half-assed ECS with components coupled to entities
	position: PositionComponent;
	building?: BuildingComponent;
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

	constructor() {
		// [WIP] Global resource initialization
		this.resources.set('stone', 100);
		this.resources.set('wood', 100);
		this.resources.set('food', 100);
		this.resources.set('mana', 50);
		this.resources.set('gold', 1000);

		// [WIP] Starter blueprints for testing
		this.blueprintInventory.set('mine', 2);
		this.blueprintInventory.set('lumber_camp', 1);
		this.blueprintInventory.set('farm', 1);
		this.blueprintInventory.set('house', 1);
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
