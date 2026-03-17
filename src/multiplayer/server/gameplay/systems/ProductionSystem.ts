import { getBuildingDef } from '../../config/buildings';
import type { Entity } from '../model';
import type { ServerEcsWorld } from '../ServerEcsWorld';

export class ProductionSystem {
	constructor(private readonly world: ServerEcsWorld) {}

	update(_delta: number, _time: number): void {}

	advanceTick(): void {
		const production = new Map<string, number>();

		for (const entity of this.world.getEntitiesWith(['building', 'position'])) {
			if (entity.building?.status !== 'active') continue;
			const def = getBuildingDef(entity.building.buildingId);
			if (!def?.production) continue;

			const multiplier = this.calculateMultiplier(entity);
			for (const [resource, baseAmount] of Object.entries(def.production.productions)) {
				const amount = baseAmount * multiplier;
				if (amount <= 0) continue;
				production.set(resource, (production.get(resource) || 0) + amount);
			}
		}

		for (const [resource, value] of production) {
			const current = this.world.resources.get(resource) || 0;
			this.world.resources.set(resource, current + value);
		}
	}

	calculateMultiplier(entity: Entity): number {
		if (!entity.building || !entity.position) return 0;
		const def = getBuildingDef(entity.building.buildingId);
		if (!def?.production) return 0;

		let multiplier = 1;
		const neighbors = this.getNeighbors(entity.position.q, entity.position.r);

		if (def.production.getSelfProdModifier) {
			multiplier += def.production.getSelfProdModifier(entity, neighbors);
		}

		for (const neighbor of neighbors) {
			if (neighbor.building?.status !== 'active') continue;
			const neighborDef = getBuildingDef(neighbor.building.buildingId);
			if (neighborDef?.buff?.getOutgoingProdModifier) {
				multiplier += neighborDef.buff.getOutgoingProdModifier(neighbor, entity);
			}
		}

		return multiplier;
	}

	private getNeighbors(q: number, r: number): Entity[] {
		const doubledDirections = [
			{ dq: 1, dr: 1 },
			{ dq: 2, dr: 0 },
			{ dq: 1, dr: -1 },
			{ dq: -1, dr: -1 },
			{ dq: -2, dr: 0 },
			{ dq: -1, dr: 1 }
		];

		return doubledDirections
			.map(({ dq, dr }) => this.world.getEntitiesWith(['position']).find((entity) => entity.position?.q === q + dq && entity.position?.r === r + dr))
			.filter((entity): entity is Entity => !!entity);
	}
}