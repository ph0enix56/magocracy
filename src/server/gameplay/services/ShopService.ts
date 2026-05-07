import { serverConfig } from '../../config/serverConfig';
import { getPurchasableBuildings, type BuildingDef } from '../../config/buildings';
import type { WorldStore } from '../WorldStore';

/**
 * Manages the player's shop: offer generation, purchasing blueprints, and rerolling.
 * Offer tier probabilities are weighted by the current phase loop index, shifting toward
 * higher tiers as the game progresses.
 */
export class ShopService {
	private phaseLoopIndex = 0;

	constructor(private readonly world: WorldStore) {}

	/** Returns the current shop state: all offer slots and the reroll cost. */
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
			rerollCost: serverConfig.shop.rerollCost
		};
	}

	/** Rerolls all shop offers for free (used at phase start). */
	rerollFree(): void {
		this.rerollInternal();
	}

	/** Rerolls all shop offers, spending the configured mana cost. Throws if not enough mana. */
	rerollWithThrow(): void {
		this.spendManaWithThrow(serverConfig.shop.rerollCost);
		this.rerollInternal();
	}

	/** Sets the current phase loop index, which controls the shop's tier weight distribution. */
	setPhaseLoopIndex(phaseLoopIndex: number): void {
		this.phaseLoopIndex = Math.max(0, Math.floor(phaseLoopIndex));
	}

	/**
	 * Purchases the blueprint in a given offer slot, spending the tier's mana cost and
	 * adding one blueprint to the player's inventory. Clears the slot on success.
	 * Throws if the slot index is invalid, the slot is empty, or mana is insufficient.
	 * @returns The building ID that was purchased.
	 */
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
		if (!Number.isInteger(tier) || tier < 1 || tier > serverConfig.shop.buyCostByTier.length) {
			throw new Error(`Missing buy cost configuration for tier ${tier}.`);
		}

		const amount = serverConfig.shop.buyCostByTier[tier - 1]!;
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
		const configuredDistributions = serverConfig.shop.offerTierWeightsByPhaseLoop;
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
		this.world.shopOffers = Array.from({ length: serverConfig.shop.size }, () => this.randomOffer());
	}
}