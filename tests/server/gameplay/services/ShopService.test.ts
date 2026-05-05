import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configuration } from '../../../../src/game/configuration';
import { getPurchasableBuildings } from '../../../../src/server/config/buildings';
import { WorldStore } from '../../../../src/server/gameplay/WorldStore';
import { ShopService } from '../../../../src/server/gameplay/services/ShopService';

test('rerollWithThrow spends mana and fills offers from purchasable pool', () => {
	const world = new WorldStore();
	const service = new ShopService(world);
	world.resources.set('mana', 100);
	const purchasable = new Set(getPurchasableBuildings().map((building) => building.id));

	const originalRandom = Math.random;
	Math.random = () => 0;
	try {
		service.rerollWithThrow();
	} finally {
		Math.random = originalRandom;
	}

	assert.equal(world.resources.get('mana'), 100 - configuration.shop.rerollCost);
	assert.equal(world.shopOffers.length, configuration.shop.size);
	for (const offer of world.shopOffers) {
		if (!offer) {
			throw new Error('Expected a filled offer after reroll.');
		}
		assert.equal(purchasable.has(offer[0]), true);
	}
});

test('buyWithThrow consumes offer slot, spends tier cost, and grants blueprint', () => {
	const world = new WorldStore();
	const service = new ShopService(world);
	world.resources.set('mana', 1000);
	const purchasable = getPurchasableBuildings()[0]!;
	world.shopOffers[0] = [purchasable.id, purchasable.tier];
	const beforeBlueprints = world.blueprintInventory.get(purchasable.id) ?? 0;
	const expectedBuyCost = configuration.shop.buyCostByTier[purchasable.tier - 1]!;

	const purchased = service.buyWithThrow(0);

	assert.equal(purchased, purchasable.id);
	assert.equal(world.shopOffers[0], null);
	assert.equal(world.resources.get('mana'), 1000 - expectedBuyCost);
	assert.equal(world.blueprintInventory.get(purchasable.id), beforeBlueprints + 1);
});

test('buyWithThrow rejects invalid and empty slots and insufficient mana', () => {
	const world = new WorldStore();
	const service = new ShopService(world);
	const purchasable = getPurchasableBuildings()[0]!;

	assert.throws(() => service.buyWithThrow(-1), /Invalid slot/);
	assert.throws(() => service.buyWithThrow(0), /Empty slot/);

	world.shopOffers[0] = [purchasable.id, purchasable.tier];
	world.resources.set('mana', 0);
	assert.throws(() => service.buyWithThrow(0), /Not enough mana/);
});

test('rerollFree uses last configured distribution when phase loop index exceeds range', () => {
	const world = new WorldStore();
	const service = new ShopService(world);
	const purchasableByTier = new Map<number, string[]>(
		getPurchasableBuildings().reduce<Array<[number, string[]]>>((acc, building) => {
			const existing = acc.find(([tier]) => tier === building.tier);
			if (existing) {
				existing[1].push(building.id);
				return acc;
			}
			acc.push([building.tier, [building.id]]);
			return acc;
		}, [])
	);

	const lastDistribution = configuration.shop.offerTierWeightsByPhaseLoop[
		configuration.shop.offerTierWeightsByPhaseLoop.length - 1
	] ?? [];
	const expectedTier = lastDistribution.findIndex((weight, index) => weight > 0 && (purchasableByTier.get(index + 1)?.length ?? 0) > 0) + 1;
	assert.ok(expectedTier > 0, 'Expected at least one configured tier with purchasable buildings.');

	service.setPhaseLoopIndex(9999);
	const originalRandom = Math.random;
	Math.random = () => 0;
	try {
		service.rerollFree();
	} finally {
		Math.random = originalRandom;
	}

	for (const offer of world.shopOffers) {
		if (!offer) {
			throw new Error('Expected a filled offer after reroll.');
		}
		assert.equal(offer[1], expectedTier);
	}
});
