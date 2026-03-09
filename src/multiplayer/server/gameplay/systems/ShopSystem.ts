import { configuration } from '../../../../game/configuration';
import { getPurchasableBuildings, type BuildingDef } from '../../config/buildings';
import type { ServerEcsWorld } from '../ServerEcsWorld';

export class ShopSystem {
	constructor(private readonly world: ServerEcsWorld) {}

	update(_delta: number, _time: number): void {}
	advanceTick(): void {}

	getState() {
		return {
			offers: [...this.world.shopOffers],
			buyCost: configuration.shop.buyCost,
			rerollCost: configuration.shop.rerollCost
		};
	}

	rerollFree(): void {
		this.rerollInternal();
	}

	rerollWithThrow(): void {
		this.spendGoldWithThrow(configuration.shop.rerollCost);
		this.rerollInternal();
	}

	buyWithThrow(slotIndex: number): string {
		if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= this.world.shopOffers.length) {
			throw new Error('Invalid slot.');
		}

		const buildingId = this.world.shopOffers[slotIndex];
		if (!buildingId) throw new Error('Empty slot.');

		this.spendGoldWithThrow(configuration.shop.buyCost);
		const current = this.world.blueprintInventory.get(buildingId) || 0;
		this.world.blueprintInventory.set(buildingId, current + 1);
		this.world.shopOffers[slotIndex] = null;
		return buildingId;
	}

	private spendGoldWithThrow(amount: number): void {
		if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid gold amount.');
		const current = this.world.resources.get('gold') || 0;
		if (current < amount) throw new Error('Not enough gold.');
		this.world.resources.set('gold', current - amount);
	}

	private randomOffer(): string | null {
		const pool = this.purchasablePool().map((building) => building.id);
		if (pool.length === 0) return null;
		return pool[Math.floor(Math.random() * pool.length)]!;
	}

	private purchasablePool(): BuildingDef[] {
		return getPurchasableBuildings();
	}

	private rerollInternal(): void {
		this.world.shopOffers = Array.from({ length: configuration.shop.size }, () => this.randomOffer());
	}
}