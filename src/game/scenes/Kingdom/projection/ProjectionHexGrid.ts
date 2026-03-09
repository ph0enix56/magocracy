import type { Scene } from 'phaser';
import { kingdomCoordKey } from '../../../../shared/kingdom/kingdomGrid';
import type { ProjectionTile } from './model';
import type { ProjectionWorld } from './model';

export type ProjectionHexGridOptions = {
	hexSize: number;
	hexStroke: number;
	gridOriginYOffset: number;
	onTileSelected: (q: number, r: number) => void;
};

export class ProjectionHexGrid {
	constructor(
		private readonly world: ProjectionWorld,
		private readonly scene: Scene,
		private readonly options: ProjectionHexGridOptions
	) {}

	static preloadHexTexture(scene: Scene, hexSize: number, hexStroke: number): void {
		const width = Math.sqrt(3) * hexSize + 2 * hexStroke;
		const height = 2 * hexSize + 2 * hexStroke;
		const hex = ProjectionHexGrid.getHexagon(hexSize, width / 2, height / 2);

		scene.add
			.graphics()
			.lineStyle(hexStroke, 0xffffff)
			.fillStyle(0x33cc33, 1)
			.strokePoints(hex.points, true)
			.fillPoints(hex.points, true)
			.generateTexture('hexTile', width, height)
			.destroy();
	}

	ensureTileExists(q: number, r: number): ProjectionTile {
		const id = kingdomCoordKey(q, r);
		const existing = this.world.getTile(id);
		if (existing) return existing;

		const { x, y } = this.screenPosFor(q, r);
		const hex = this.scene.add.image(x, y, 'hexTile');
		hex.setInteractive(ProjectionHexGrid.getHexagon(this.options.hexSize, hex.width / 2, hex.height / 2), Phaser.Geom.Polygon.Contains);

		const tile: ProjectionTile = {
			id,
			position: { q, r },
			render: { hex }
		};
		this.world.addTile(tile);

		hex.on('pointerover', () => {
			hex.setTintFill(0x70db70);
		});
		hex.on('pointerout', () => {
			hex.clearTint();
		});
		hex.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
			event.stopPropagation();
			this.options.onTileSelected(q, r);
		});

		return tile;
	}

	private screenPosFor(q: number, r: number): { x: number; y: number } {
		const centerX = this.scene.scale.width / 2;
		const centerY = this.scene.scale.height / 2 + this.options.gridOriginYOffset;
		const parity = (r & 1) === 0 ? 0 : 1;
		const c = (q - parity) / 2;

		return {
			x: centerX + this.options.hexSize * Math.sqrt(3) * (c + 0.5 * parity),
			y: centerY + (this.options.hexSize * 3) / 2 * r
		};
	}

	private static getHexagon(hexSize: number, centerX: number, centerY: number): Phaser.Geom.Polygon {
		const points: Phaser.Geom.Point[] = [];
		for (let index = 0; index < 6; index += 1) {
			const angle = Phaser.Math.DegToRad(60 * index - 30);
			points.push(new Phaser.Geom.Point(centerX + hexSize * Math.cos(angle), centerY + hexSize * Math.sin(angle)));
		}
		return new Phaser.Geom.Polygon(points);
	}
}