import type { Scene } from 'phaser';
import { configuration } from '../../../configuration';

const BADGE_TEXTURE_KEY = 'kingdom:construction-badge';

export class ConstructionBadge {
	static preload(scene: Scene): void {
		if (scene.textures.exists(BADGE_TEXTURE_KEY)) return;

		const badgeCfg = configuration.render.building.badge;
		const size = badgeCfg.radius * 2 + badgeCfg.ringWidth * 2 + 4;
		const center = size / 2;
		const graphics = scene.add.graphics();

		graphics.fillStyle(badgeCfg.fillColor, badgeCfg.fillAlpha);
		graphics.fillCircle(center, center, badgeCfg.radius);
		graphics.lineStyle(badgeCfg.borderWidth, badgeCfg.borderColor, badgeCfg.borderAlpha);
		graphics.strokeCircle(center, center, badgeCfg.radius);
		graphics.generateTexture(BADGE_TEXTURE_KEY, size, size);
		graphics.destroy();
	}

	private readonly background: Phaser.GameObjects.Image;
	private readonly ring: Phaser.GameObjects.Graphics;
	private readonly label: Phaser.GameObjects.Text;

	constructor(scene: Scene) {
		ConstructionBadge.preload(scene);

		const badgeCfg = configuration.render.building.badge;
		this.background = scene.add.image(0, 0, BADGE_TEXTURE_KEY);
		this.background.setDepth(badgeCfg.depth);

		this.ring = scene.add.graphics();
		this.ring.setDepth(badgeCfg.depth + 1);

		this.label = scene.add.text(0, 0, '', {
			fontFamily: 'monospace',
			fontSize: `${badgeCfg.fontSize}px`,
			color: badgeCfg.color,
			stroke: badgeCfg.strokeColor,
			strokeThickness: badgeCfg.strokeThickness
		});
		this.label.setOrigin(0.5);
		this.label.setDepth(badgeCfg.depth + 2);
	}

	setPosition(x: number, y: number): void {
		const px = Math.round(x);
		const py = Math.round(y);
		this.background.setPosition(px, py);
		this.label.setPosition(px, py);
	}

	setRemainingTicks(remainingTicks: number, remainingRatio: number, variant: 'constructing' | 'upgrading'): void {
		const badgeCfg = configuration.render.building.badge;
		const x = this.background.x;
		const y = this.background.y;
		const color = variant === 'upgrading' ? badgeCfg.ringColor.upgrading : badgeCfg.ringColor.constructing;

		this.label.setText(`${remainingTicks}`);

		this.ring.clear();
		this.ring.lineStyle(badgeCfg.ringWidth, badgeCfg.trackColor, badgeCfg.trackAlpha);
		this.ring.strokeCircle(x, y, badgeCfg.ringRadius);

		if (remainingRatio <= 0) return;

		this.ring.lineStyle(badgeCfg.ringWidth, color, badgeCfg.ringAlpha);
		this.ring.beginPath();
		this.ring.arc(
			x,
			y,
			badgeCfg.ringRadius,
			Phaser.Math.DegToRad(-90),
			Phaser.Math.DegToRad(-90 + 360 * remainingRatio),
			false
		);
		this.ring.strokePath();
	}

	setVisible(visible: boolean): void {
		this.background.setVisible(visible);
		this.ring.setVisible(visible);
		this.label.setVisible(visible);
	}

	destroy(): void {
		this.background.destroy();
		this.ring.destroy();
		this.label.destroy();
	}
}