import { configuration } from '../../../../game/configuration';
import { getPurchasableBuildings, type BuildingDef } from '../../config/buildings';
import type { WorldStore } from '../WorldStore';

export class ShopService {
	private phaseLoopIndex = 0;

	constructor(private readonly world: WorldStore) {}

	update(_delta: number, _time: number): void {}
	advanceTick(): void {}

	getState() {
		return {
			offers: this.world.shopOffers.map((offer) => {
				if (!offer) return null;
				const [buildingId, tier] = offer;
				return {
					buildingId,
					tier,
					buyCost: this.buyCostForTierWithThrow(tier)
				};
			}),
			rerollCost: configuration.shop.rerollCost
		};
	}

	rerollFree(): void {
		this.rerollInternal();
	}

	rerollWithThrow(): void {
		this.spendManaWithThrow(configuration.shop.rerollCost);
		this.rerollInternal();
	}

	setPhaseLoopIndex(phaseLoopIndex: number): void {
		this.phaseLoopIndex = Math.max(0, Math.floor(phaseLoopIndex));
	}

	buyWithThrow(slotIndex: number): string {
		if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= this.world.shopOffers.length) {
			throw new Error('Invalid slot.');
		}

		const offer = this.world.shopOffers[slotIndex];
		if (!offer) throw new Error('Empty slot.');
		const [buildingId, tier] = offer;

		this.spendManaWithThrow(this.buyCostForTierWithThrow(tier));
		const current = this.world.blueprintInventory.get(buildingId) || 0;
		this.world.blueprintInventory.set(buildingId, current + 1);
		this.world.shopOffers[slotIndex] = null;
		return buildingId;
	}

	private buyCostForTierWithThrow(tier: number): number {
		if (!Number.isInteger(tier) || tier < 1 || tier > configuration.shop.buyCostByTier.length) {
			throw new Error(`Missing buy cost configuration for tier ${tier}.`);
		}

		const amount = configuration.shop.buyCostByTier[tier - 1]!;
		if (!Number.isFinite(amount) || amount <= 0) {
			throw new Error(`Invalid buy cost configuration for tier ${tier}.`);
		}

		return amount;
	}

	private spendManaWithThrow(amount: number): void {
		if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid mana amount.');
		const current = this.world.resources.get('mana') || 0;
		if (current < amount) throw new Error('Not enough mana.');
		this.world.resources.set('mana', current - amount);
	}

	private randomOffer(): [string, number] | null {
		const pool = this.purchasablePool();
		if (pool.length === 0) return null;

		const weightedTier = this.randomTierFromPhaseLoopDistribution();
		const tierPool = pool.filter((building) => building.tier === weightedTier);
		const offerPool = tierPool.length > 0 ? tierPool : pool;
		const choice = offerPool[Math.floor(Math.random() * offerPool.length)]!;
		return [choice.id, choice.tier];
	}

	private purchasablePool(): BuildingDef[] {
		return getPurchasableBuildings();
	}

	private randomTierFromPhaseLoopDistribution(): number {
		const configuredDistributions = configuration.shop.offerTierWeightsByPhaseLoop;
		const distributionIndex = Math.min(this.phaseLoopIndex, configuredDistributions.length - 1);
		const weights: readonly number[] = configuredDistributions[distributionIndex]!;
		const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

		let roll = Math.random() * totalWeight;
		for (let i = 0; i < weights.length; i += 1) {
			roll -= weights[i]!;
			if (roll < 0) {
				return i + 1;
			}
		}

		return weights.length;
	}

	private rerollInternal(): void {
		this.world.shopOffers = Array.from({ length: configuration.shop.size }, () => this.randomOffer());
	}
}