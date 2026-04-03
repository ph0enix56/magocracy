import type { Scene } from 'phaser';
import { configuration } from '../../../configuration';
import { buildingCatalog } from '../../../../multiplayer/client/buildingCatalog';
import { getHexTileColorForSchool, getHoveredHexTileColor } from '../../../../shared/ui/buildingSchoolColors';
import { ConstructionBadge } from './ConstructionBadge';
import type { ProjectionRenderState, ProjectionWorld } from './model';

export class ProjectionRenderSystem {
	private visible = true;

	constructor(
		private readonly world: ProjectionWorld,
		private readonly scene: Scene
	) {}

	setVisible(visible: boolean): void {
		if (this.visible === visible) return;
		this.visible = visible;
		for (const tile of this.world.getTiles()) {
			tile.render.building?.setVisible(visible);
			tile.render.constructionBadge?.setVisible(visible);
			tile.render.expansion?.setVisible(visible && !!tile.isExpansionSite && this.world.areExpansionTilesVisible());
		}
	}

	update(): void {
		const buildingCfg = configuration.render.building;
		for (const tile of this.world.getTiles()) {
			const render = tile.render;
			const def = tile.building ? buildingCatalog.getById(tile.building.buildingId) : undefined;
			this.syncHexColor(tile, render, tile.building?.school ?? def?.school);

			if (tile.isExpansionSite && !tile.building) {
				if (!render.expansion) {
					render.expansion = this.scene.add.image(render.hex.x, render.hex.y, 'hexTilePlus');
					render.expansion.setVisible(this.visible && this.world.areExpansionTilesVisible());
				}
				render.expansion.setPosition(render.hex.x, render.hex.y);
				render.expansion.setVisible(this.visible && this.world.areExpansionTilesVisible());
			} else if (render.expansion) {
				render.expansion.destroy();
				render.expansion = undefined;
			}

			if (tile.building) {
				if (!def) continue;
				const textureKey = `building_${def.id}`;

				if (!render.building) {
					const sprite = this.scene.add.image(render.hex.x, render.hex.y, textureKey);
					sprite.setScale(this.getTargetBuildingScale(sprite, buildingCfg.spriteFillScaleMultiplier));
					sprite.setAlpha(buildingCfg.alpha.initial);
					sprite.setVisible(this.visible);
					render.building = sprite;
				}

				if (render.building.texture.key !== textureKey) {
					render.building.setTexture(textureKey);
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
						render.constructionBadge.setVisible(this.visible);
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

	private syncHexColor(tile: { isExpansionSite?: boolean }, render: ProjectionRenderState, school: string | undefined): void {
		const baseColor = tile.isExpansionSite ? 0xb9d5df : getHexTileColorForSchool(school);
		render.hexBaseColor = baseColor;
		const displayColor = render.hexHovered ? getHoveredHexTileColor(baseColor) : baseColor;
		if (displayColor === render.hexDisplayColor) return;
		render.hexDisplayColor = displayColor;
		render.hex.setTintFill(displayColor);
	}
}
