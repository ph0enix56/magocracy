import type { ECSManager, System } from '../ECSBase';
import { getPurchasableBuildings, type BuildingDef } from '../../data/buildings';

export class ShopSystem implements System {
	static readonly SHOP_SIZE = 4;
	static readonly BUY_COST = 10;
	static readonly REROLL_COST = 10;

	private world: ECSManager;

	constructor(world: ECSManager) {
		this.world = world;
	}

	update(_delta: number, _time: number): void {}
	advanceTick(): void {}

	getState() {
		return {
			offers: [...this.world.shopOffers],
			buyCost: ShopSystem.BUY_COST,
			rerollCost: ShopSystem.REROLL_COST
		};
	}

	private spendGoldWithThrow(amount: number): void {
		if (!Number.isFinite(amount) || amount <= 0) {
			throw new Error('Invalid gold amount.');
		}
		const current = this.world.resources.get('gold') || 0;
		if (current < amount) {
			throw new Error('Not enough gold.');
		}
		this.world.resources.set('gold', current - amount);
	}

	randomOffer(): string | null {
		const pool = this.purchasablePool().map(b => b.id);
		if (pool.length === 0) return null;
		return pool[Math.floor(Math.random() * pool.length)]!;
	}

	purchasablePool(): BuildingDef[] {
		return getPurchasableBuildings();
	}

	private rerollInternal(): void {
		this.world.shopOffers = Array.from({ length: ShopSystem.SHOP_SIZE }, () => this.randomOffer());
	}

	// Free initial roll so the shop has offers at game start.
	rerollFree(): void {
		this.rerollInternal();
	}

	rerollWithThrow(): void {
		this.spendGoldWithThrow(ShopSystem.REROLL_COST);
		this.rerollInternal();
	}

	buyWithThrow(slotIndex: number): string {
		if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= this.world.shopOffers.length) {
			throw new Error('Invalid slot.');
		}

		const buildingId = this.world.shopOffers[slotIndex];
		if (!buildingId) throw new Error('Empty slot.');

		this.spendGoldWithThrow(ShopSystem.BUY_COST);
		const current = this.world.blueprintInventory.get(buildingId) || 0;
		this.world.blueprintInventory.set(buildingId, current + 1);
		this.world.shopOffers[slotIndex] = null;
		return buildingId;
	}
}
