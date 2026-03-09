import type { TileSelectedPayload } from '../../../../eventBus';
import { buildingCatalog } from '../../../../multiplayer/client/buildingCatalog';
import type { ProjectionWorld } from './model';

export class TileSelectionProjection {
	constructor(private readonly world: ProjectionWorld) {}

	buildPayload(q: number, r: number): TileSelectedPayload {
		const tile = this.world.getTileAt(q, r);
		const built = !!tile?.building;

		let buildingId: string | undefined;
		let buildingStatus: 'constructing' | 'active' | 'upgrading' | undefined;
		let constructionProgress: number | undefined;
		let productionMultiplier: number | undefined;
		let nextUpgradeId: string | undefined;
		let nextUpgradeCost: Record<string, number> | undefined;
		let nextUpgradeTime: number | undefined;
		let upgradingToId: string | undefined;
		let upgradeProgress: number | undefined;

		if (tile?.building) {
			buildingId = tile.building.buildingId;
			buildingStatus = tile.building.status;
			const def = buildingCatalog.getById(buildingId);

			if (tile.building.status === 'constructing' && def) {
				const totalTicks = def.buildTime;
				constructionProgress = totalTicks > 0 ? (tile.building.progress / totalTicks) * 100 : 100;
				constructionProgress = Math.min(100, Math.max(0, constructionProgress));
			} else if (tile.building.status === 'upgrading') {
				upgradingToId = tile.building.upgradeNextId;
				const targetDef = upgradingToId ? buildingCatalog.getById(upgradingToId) : undefined;
				if (targetDef) {
					const totalTicks = targetDef.buildTime;
					upgradeProgress = totalTicks > 0 ? (tile.building.progress / totalTicks) * 100 : 100;
					upgradeProgress = Math.min(100, Math.max(0, upgradeProgress));
				}
			} else if (tile.building.status === 'active') {
				productionMultiplier = tile.building.productionMultiplier;

				const next = buildingId ? buildingCatalog.getNextUpgrade(buildingId) : undefined;
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