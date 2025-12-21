import type { ECSManager } from '../ECSBase';
import type { System } from '../ECSBase';
import type { Scene } from 'phaser';
import { getBuildingDef } from '../../data/buildings';

export class RenderSystem implements System {
    private world: ECSManager;
    private scene: Scene;

    constructor(world: ECSManager, scene: Scene) {
        this.world = world;
        this.scene = scene;
    }

    update(_delta: number, _time: number) {
        for (const entity of this.world.getEntities()) {
            if (!entity.render) continue;

            // Handle Building Visuals
            if (entity.building) {
                const def = getBuildingDef(entity.building.buildingId);
                if (!def) continue;

                if (!entity.render.building) {
                    // Create building visual
                    const x = entity.render.hex.x;
                    const y = entity.render.hex.y;
                    
                    const sprite = this.scene.add.image(x, y, def.textureId);
                    // Scale to fit reasonably within a 64-size hex (approx 100px wide)
                    // Let's assume we want it to be roughly 64px wide/high
                    const scale = 64 / Math.max(sprite.width, sprite.height);
                    sprite.setScale(scale);
                    sprite.setAlpha(0.5); // Start semi-transparent
                    
                    entity.render.building = sprite;
                }

                // Update visual based on status
                if (entity.building.status === 'constructing') {
                    // Keep sprite semi-transparent and fixed size
                    entity.render.building.setAlpha(0.6);
                    const targetScale = 64 / Math.max(entity.render.building.width, entity.render.building.height);
                    entity.render.building.setScale(targetScale);

                    // Draw progress circle
                    if (!entity.render.constructionProgress) {
                        entity.render.constructionProgress = this.scene.add.graphics();
                    }
                    
                    const graphics = entity.render.constructionProgress;
                    graphics.clear();
                    
                    const x = entity.render.hex.x;
                    const y = entity.render.hex.y;
                    const radius = 20;
                    const progress = entity.building.progress / (def.buildTime * 1000);
                    
                    // Background circle
                    graphics.lineStyle(4, 0x000000, 0.5);
                    graphics.strokeCircle(x, y, radius);
                    
                    // Progress arc
                    graphics.lineStyle(4, 0xffa500, 1);
                    graphics.beginPath();
                    // Arc from -90 degrees (top)
                    graphics.arc(x, y, radius, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + 360 * progress), false);
                    graphics.strokePath();

                } else {
                    // Active state
                    entity.render.building.setAlpha(1);
                    const targetScale = 64 / Math.max(entity.render.building.width, entity.render.building.height);
                    entity.render.building.setScale(targetScale);

                    // Remove progress indicator if it exists
                    if (entity.render.constructionProgress) {
                        entity.render.constructionProgress.destroy();
                        entity.render.constructionProgress = undefined;
                    }
                }
            } else {
                // No building component, but visual exists? Destroy it.
                if (entity.render.building) {
                    entity.render.building.destroy();
                    entity.render.building = undefined;
                }
                if (entity.render.constructionProgress) {
                    entity.render.constructionProgress.destroy();
                    entity.render.constructionProgress = undefined;
                }
            }
        }
    }
}
