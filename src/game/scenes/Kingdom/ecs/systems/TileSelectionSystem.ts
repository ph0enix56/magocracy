import type { ECSManager } from '../ECSBase';
import { getBuildingDef, getNextUpgradeDef } from '../../data/buildings';
import type { TileSelectedPayload } from '../../../../../eventBus';
import type { ProductionSystem } from './ProductionSystem';

export class TileSelectionSystem {
	private world: ECSManager;
	private productionSystem: ProductionSystem;

	constructor(world: ECSManager, productionSystem: ProductionSystem) {
		this.world = world;
		this.productionSystem = productionSystem;
	}

	buildPayload(q: number, r: number): TileSelectedPayload {
		const e = this.world.getEntity(`${q},${r}`);
		const built = !!e?.building;

		let buildingId: string | undefined;
		let buildingStatus: 'constructing' | 'active' | 'upgrading' | undefined;
		let constructionProgress: number | undefined;
		let productionMultiplier: number | undefined;
		let nextUpgradeId: string | undefined;
		let nextUpgradeCost: Record<string, number> | undefined;
		let nextUpgradeTime: number | undefined;
		let upgradingToId: string | undefined;
		let upgradeProgress: number | undefined;

		if (e?.building) {
			buildingId = e.building.buildingId;
			buildingStatus = e.building.status;
			const def = getBuildingDef(buildingId);

			if (e.building.status === 'constructing' && def) {
				const totalTicks = def.buildTime;
				constructionProgress = totalTicks > 0 ? (e.building.progress / totalTicks) * 100 : 100;
				constructionProgress = Math.min(100, Math.max(0, constructionProgress));
			} else if (e.building.status === 'upgrading') {
				upgradingToId = e.building.upgradeNextId;
				const targetDef = upgradingToId ? getBuildingDef(upgradingToId) : undefined;
				if (targetDef) {
					const totalTicks = targetDef.buildTime;
					upgradeProgress = totalTicks > 0 ? (e.building.progress / totalTicks) * 100 : 100;
					upgradeProgress = Math.min(100, Math.max(0, upgradeProgress));
				}
			} else if (e.building.status === 'active') {
				if (def?.type === 'production') {
					productionMultiplier = this.productionSystem.calculateMultiplier(e);
				}

				const next = buildingId ? getNextUpgradeDef(buildingId) : undefined;
				if (next) {
					nextUpgradeId = next.id;
					nextUpgradeCost = next.cost;
					nextUpgradeTime = next.buildTime;
				}
			}
		}

		return {
			q,
			r,
			built,
			buildingId,
			buildingStatus,
			constructionProgress,
			productionMultiplier,
			nextUpgradeId,
			nextUpgradeCost,
			nextUpgradeTime,
			upgradingToId,
			upgradeProgress
		};
	}
}
