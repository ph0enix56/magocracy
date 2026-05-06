import { serverConfig } from '../config/serverConfig';
import { getUnitDef } from '../config/buildings';
import type { ArmyUnitState, KingdomTileState } from './model';

export type WorldStoreOptions = {
	initialResources: Record<string, number>;
	starterBlueprintInventory: Record<string, number>;
};

export class WorldStore {
	private readonly kingdomTiles = new Map<string, KingdomTileState>();
	private readonly armyUnits = new Map<string, ArmyUnitState>();
	readonly resources = new Map<string, number>();
	readonly blueprintInventory = new Map<string, number>();
	shopOffers: Array<[id: string, tier: number] | null> = Array.from({ length: serverConfig.shop.size }, () => null);
	armyUnitOrder: string[] = [];
	private nextArmyUnitSeq = 1;

	constructor(options: WorldStoreOptions = { initialResources: {}, starterBlueprintInventory: {} }) {
		for (const [key, value] of Object.entries(options.initialResources)) {
			this.resources.set(key, value);
		}

		for (const [buildingId, count] of Object.entries(options.starterBlueprintInventory)) {
			this.blueprintInventory.set(buildingId, count);
		}
	}

	upsertKingdomTile(tile: KingdomTileState): void {
		this.kingdomTiles.set(tile.tileId, tile);
	}

	getKingdomTile(tileId: string): KingdomTileState | undefined {
		return this.kingdomTiles.get(tileId);
	}

	getKingdomTiles(): KingdomTileState[] {
		return [...this.kingdomTiles.values()];
	}

	getKingdomTilesWithBuildings(): KingdomTileState[] {
		return this.getKingdomTiles().filter((tile) => !!tile.building);
	}

	spawnArmyUnit(unitDefId: string): ArmyUnitState {
		const unitDef = getUnitDef(unitDefId);
		if (!unitDef) throw new Error(`Unknown unitDefId '${unitDefId}'`);

		const armyUnitId = `unit:${unitDefId}:${this.nextArmyUnitSeq++}`;
		const unit: ArmyUnitState = {
			armyUnitId,
			unitDefId,
			initiative: unitDef.initiative,
			health: unitDef.health,
			drFlat: unitDef.drFlat,
			drPercent: unitDef.drPercent,
			actionPoints: unitDef.actionPoints
		};
		this.armyUnits.set(armyUnitId, unit);
		this.ensureArmyUnitOrderSynced();
		return unit;
	}

	replaceArmyUnitWithThrow(previousArmyUnitId: string, nextUnitDefId: string): ArmyUnitState {
		const previous = this.getArmyUnit(previousArmyUnitId);
		if (!previous) throw new Error('Invalid unit.');

		this.ensureArmyUnitOrderSynced();
		const previousIndex = this.armyUnitOrder.indexOf(previousArmyUnitId);

		this.removeArmyUnit(previousArmyUnitId);
		const nextUnit = this.spawnArmyUnit(nextUnitDefId);

		if (previousIndex < 0) return nextUnit;

		const insertedIndex = this.armyUnitOrder.indexOf(nextUnit.armyUnitId);
		if (insertedIndex < 0) return nextUnit;
		this.armyUnitOrder.splice(insertedIndex, 1);

		const clampedIndex = Math.max(0, Math.min(previousIndex, this.armyUnitOrder.length));
		this.armyUnitOrder.splice(clampedIndex, 0, nextUnit.armyUnitId);
		return nextUnit;
	}

	getArmyUnit(armyUnitId: string): ArmyUnitState | undefined {
		return this.armyUnits.get(armyUnitId);
	}

	getArmyUnits(): ArmyUnitState[] {
		return [...this.armyUnits.values()];
	}

	removeArmyUnit(armyUnitId: string): void {
		this.armyUnits.delete(armyUnitId);
		this.ensureArmyUnitOrderSynced();
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

	getOrderedArmyUnits(): ArmyUnitState[] {
		this.ensureArmyUnitOrderSynced();
		const out: ArmyUnitState[] = [];
		for (const armyUnitId of this.armyUnitOrder) {
			const unit = this.getArmyUnit(armyUnitId);
			if (unit) out.push(unit);
		}
		return out;
	}

	private ensureArmyUnitOrderSynced(): void {
		const existingArmyUnitIds = new Set(this.armyUnits.keys());

		this.armyUnitOrder = this.armyUnitOrder.filter((id) => existingArmyUnitIds.has(id));

		for (const id of existingArmyUnitIds) {
			if (!this.armyUnitOrder.includes(id)) this.armyUnitOrder.push(id);
		}
	}
}