import { configuration } from '../../../game/configuration';
import type { ArmyUnitComponent, Entity } from './model';

export class WorldStore {
	private readonly entities = new Map<string, Entity>();
	readonly resources = new Map<string, number>();
	readonly blueprintInventory = new Map<string, number>();
	shopOffers: Array<string | null> = Array.from({ length: configuration.shop.size }, () => null);
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
			armyUnit: component as ArmyUnitComponent
		};
		this.addEntity(entity);
		this.ensureArmyUnitOrderSynced();
		return entity;
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
			const entity = this.getEntity(id);
			if (entity?.armyUnit) out.push(entity);
		}
		return out;
	}

	addEntity(entity: Entity): void {
		this.entities.set(entity.id, entity);
	}

	getEntity(id: string): Entity | undefined {
		return this.entities.get(id);
	}

	getEntities(): Entity[] {
		return [...this.entities.values()];
	}

	getEntitiesWith<K extends keyof Pick<Entity, 'position' | 'building' | 'armyUnit'>>(
		components: K[]
	): Entity[] {
		return this.getEntities().filter((entity) => components.every((component) => !!entity[component]));
	}

	private ensureArmyUnitOrderSynced(): void {
		const existingArmyUnitIds = new Set(
			this.getEntities()
				.filter((entity) => !!entity.armyUnit)
				.map((entity) => entity.id)
		);

		this.armyUnitOrder = this.armyUnitOrder.filter((id) => existingArmyUnitIds.has(id));

		for (const id of existingArmyUnitIds) {
			if (!this.armyUnitOrder.includes(id)) this.armyUnitOrder.push(id);
		}
	}
}