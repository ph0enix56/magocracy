import type { ECSManager } from '../ECSBase';
import type { System } from '../ECSBase';
import type { Scene } from 'phaser';
import { getBuildingDef } from '../../data/buildings';
import { configuration } from '../../../../configuration';

export class RenderSystem implements System {
    private world: ECSManager;
    private scene: Scene;

    constructor(world: ECSManager, scene: Scene) {
        this.world = world;
        this.scene = scene;
    }

    update(_delta: number, _time: number) {
        const buildingCfg = configuration.render.building;
        for (const entity of this.world.getEntitiesWith(['render'])) {
            const render = entity.render;
            if (!render) continue;

            // Handle Building Visuals
            if (entity.building) {
                const def = getBuildingDef(entity.building.buildingId);
                if (!def) continue;

                if (!render.building) {
                    // Create building visual
                    const x = render.hex.x;
                    const y = render.hex.y;
                    
                    const sprite = this.scene.add.image(x, y, def.textureId);
                    // Scale to fit reasonably within a 64-size hex (approx 100px wide)
                    // Let's assume we want it to be roughly 64px wide/high
                    const scale = buildingCfg.hexSize / Math.max(sprite.width, sprite.height);
                    sprite.setScale(scale * buildingCfg.spriteFillScaleMultiplier);
                    sprite.setAlpha(buildingCfg.alpha.initial);
                    
                    render.building = sprite;
                }

                // Keep sprite in sync if buildingId changes (e.g. upgrade completion)
                if (render.building.texture.key !== def.textureId) {
                    render.building.setTexture(def.textureId);
                }

                // Update visual based on status
                if (entity.building.status === 'constructing' || entity.building.status === 'upgrading') {
                    const isUpgrading = entity.building.status === 'upgrading';
                    const progressDef = isUpgrading
                        ? (entity.building.upgradeNextId ? getBuildingDef(entity.building.upgradeNextId) : undefined)
                        : def;
                    const totalTicks = progressDef?.buildTime ?? 0;

                    // Keep sprite semi-transparent and fixed size
                    render.building.setAlpha(isUpgrading ? buildingCfg.alpha.upgrading : buildingCfg.alpha.constructing);
                    const targetScale = buildingCfg.hexSize / Math.max(render.building.width, render.building.height);
                    render.building.setScale(targetScale);

                    // Draw progress circle
                    if (!render.constructionProgress) {
                        render.constructionProgress = this.scene.add.graphics();
                    }
                    
                    const graphics = render.constructionProgress;
                    graphics.clear();
                    
                    const x = render.hex.x;
                    const y = render.hex.y;
                    const radius = buildingCfg.progress.radius;
                    const progress = totalTicks > 0 ? entity.building.progress / totalTicks : 1;
                    
                    // Background circle
                    graphics.lineStyle(buildingCfg.progress.lineWidth, buildingCfg.progress.backgroundColor, buildingCfg.progress.backgroundAlpha);
                    graphics.strokeCircle(x, y, radius);
                    
                    // Progress arc
                    graphics.lineStyle(
                        buildingCfg.progress.lineWidth,
                        isUpgrading ? buildingCfg.progress.arcColor.upgrading : buildingCfg.progress.arcColor.constructing,
                        buildingCfg.progress.arcAlpha
                    );
                    graphics.beginPath();
                    // Arc from -90 degrees (top)
                    graphics.arc(x, y, radius, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + 360 * progress), false);
                    graphics.strokePath();

                } else {
                    // Active state
                    render.building.setAlpha(1);
                    const targetScale = buildingCfg.hexSize / Math.max(render.building.width, render.building.height);
                    render.building.setScale(targetScale);

                    // Remove progress indicator if it exists
                    if (render.constructionProgress) {
                        render.constructionProgress.destroy();
                        render.constructionProgress = undefined;
                    }
                }
            } else {
                // No building component, but visual exists? Destroy it.
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

    advanceTick(): void {}
}
