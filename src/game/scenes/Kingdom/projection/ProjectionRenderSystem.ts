import type { Scene } from 'phaser';
import { configuration } from '../../../configuration';
import { buildingCatalog } from '../../../../multiplayer/client/buildingCatalog';
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
					const scale = buildingCfg.hexSize / Math.max(sprite.width, sprite.height);
					sprite.setScale(scale * buildingCfg.spriteFillScaleMultiplier);
					sprite.setAlpha(buildingCfg.alpha.initial);
					render.building = sprite;
				}

				if (render.building.texture.key !== def.textureId) {
					render.building.setTexture(def.textureId);
				}

				if (tile.building.status === 'constructing' || tile.building.status === 'upgrading') {
					const isUpgrading = tile.building.status === 'upgrading';
					const progressDef = isUpgrading
						? (tile.building.upgradeNextId ? buildingCatalog.getById(tile.building.upgradeNextId) : undefined)
						: def;
					const totalTicks = progressDef?.buildTime ?? 0;

					render.building.setAlpha(isUpgrading ? buildingCfg.alpha.upgrading : buildingCfg.alpha.constructing);
					const targetScale = buildingCfg.hexSize / Math.max(render.building.width, render.building.height);
					render.building.setScale(targetScale);

					if (!render.constructionProgress) {
						render.constructionProgress = this.scene.add.graphics();
					}

					const graphics = render.constructionProgress;
					graphics.clear();
					const progress = totalTicks > 0 ? tile.building.progress / totalTicks : 1;

					graphics.lineStyle(buildingCfg.progress.lineWidth, buildingCfg.progress.backgroundColor, buildingCfg.progress.backgroundAlpha);
					graphics.strokeCircle(render.hex.x, render.hex.y, buildingCfg.progress.radius);
					graphics.lineStyle(
						buildingCfg.progress.lineWidth,
						isUpgrading ? buildingCfg.progress.arcColor.upgrading : buildingCfg.progress.arcColor.constructing,
						buildingCfg.progress.arcAlpha
					);
					graphics.beginPath();
					graphics.arc(
						render.hex.x,
						render.hex.y,
						buildingCfg.progress.radius,
						Phaser.Math.DegToRad(-90),
						Phaser.Math.DegToRad(-90 + 360 * progress),
						false
					);
					graphics.strokePath();
				} else {
					render.building.setAlpha(1);
					const targetScale = buildingCfg.hexSize / Math.max(render.building.width, render.building.height);
					render.building.setScale(targetScale);
					if (render.constructionProgress) {
						render.constructionProgress.destroy();
						render.constructionProgress = undefined;
					}
				}
			} else {
				if (render.building) {
					render.building.destroy();
					render.building = undefined;
				}
				if (render.constructionProgress) {
					render.constructionProgress.destroy();
					render.constructionProgress = undefined;
				}
			}
		}
	}
}