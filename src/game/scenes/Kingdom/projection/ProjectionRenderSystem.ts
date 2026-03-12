import type { Scene } from 'phaser';
import { configuration } from '../../../configuration';
import { buildingCatalog } from '../../../../multiplayer/client/buildingCatalog';
import { ConstructionBadge } from './ConstructionBadge';
import type { ProjectionWorld } from './model';

export class ProjectionRenderSystem {
	constructor(
		private readonly world: ProjectionWorld,
		private readonly scene: Scene
	) {}

	update(): void {
		const buildingCfg = configuration.render.building;
		for (const tile of this.world.getTiles()) {
			const render = tile.render;

			if (tile.building) {
				const def = buildingCatalog.getById(tile.building.buildingId);
				if (!def) continue;
				if (!this.scene.textures.exists(def.textureId)) continue;

				if (!render.building) {
					const sprite = this.scene.add.image(render.hex.x, render.hex.y, def.textureId);
					sprite.setScale(this.getTargetBuildingScale(sprite, buildingCfg.spriteFillScaleMultiplier));
					sprite.setAlpha(buildingCfg.alpha.initial);
					render.building = sprite;
				}

				if (render.building.texture.key !== def.textureId) {
					render.building.setTexture(def.textureId);
				}

				render.building.setPosition(render.hex.x, render.hex.y);

				if (tile.building.status === 'constructing' || tile.building.status === 'upgrading') {
					const isUpgrading = tile.building.status === 'upgrading';
					const progressDef = isUpgrading
						? (tile.building.upgradeNextId ? buildingCatalog.getById(tile.building.upgradeNextId) : undefined)
						: def;
					const totalTicks = progressDef?.buildTime ?? 0;
					const remainingTicks = Math.max(0, totalTicks - tile.building.progress);
					const remainingRatio = totalTicks > 0 ? remainingTicks / totalTicks : 0;

					render.building.setAlpha(isUpgrading ? buildingCfg.alpha.upgrading : buildingCfg.alpha.constructing);
					render.building.setScale(this.getTargetBuildingScale(render.building, buildingCfg.spriteFillScaleMultiplier));

					if (!render.constructionBadge) {
						render.constructionBadge = new ConstructionBadge(this.scene);
					}

					render.constructionBadge.setPosition(
						render.hex.x + buildingCfg.badge.offsetX,
						render.hex.y + buildingCfg.badge.offsetY
					);
					render.constructionBadge.setRemainingTicks(
						remainingTicks,
						remainingRatio,
						isUpgrading ? 'upgrading' : 'constructing'
					);
				} else {
					render.building.setAlpha(1);
					render.building.setScale(this.getTargetBuildingScale(render.building, buildingCfg.spriteFillScaleMultiplier));
					if (render.constructionBadge) {
						render.constructionBadge.destroy();
						render.constructionBadge = undefined;
					}
				}
			} else {
				if (render.building) {
					render.building.destroy();
					render.building = undefined;
				}
				if (render.constructionBadge) {
					render.constructionBadge.destroy();
					render.constructionBadge = undefined;
				}
			}
		}
	}

	private getTargetBuildingScale(sprite: Phaser.GameObjects.Image, fillScaleMultiplier: number): number {
		const sourceWidth = sprite.frame.realWidth || sprite.width;
		const sourceHeight = sprite.frame.realHeight || sprite.height;
		return (configuration.render.building.hexSize / Math.max(sourceWidth, sourceHeight)) * fillScaleMultiplier;
	}
}