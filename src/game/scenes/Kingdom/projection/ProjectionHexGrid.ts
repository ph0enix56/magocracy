import type { Scene } from 'phaser';
import { kingdomCoordKey } from '../../../../shared/kingdom/kingdomGrid';
import {
	EMPTY_HEX_TILE_COLOR,
	getHoveredHexTileColor
} from '../../../../shared/ui/buildingSchoolColors';
import type { TileScreenAnchor } from '../../../../multiplayer/client/session/types';
import type { ProjectionTile } from './model';
import type { ProjectionWorld } from './model';

export type ProjectionHexGridOptions = {
	hexSize: number;
	hexStroke: number;
	gridOriginYOffset: number;
	onTileSelected: (q: number, r: number, anchor: TileScreenAnchor) => void;
};

export class ProjectionHexGrid {
	private visible = true;
	private static readonly HEX_FILL_TEXTURE_KEY = 'hexTileFill';
	private static readonly HEX_OUTLINE_TEXTURE_KEY = 'hexTileOutline';

	constructor(
		private readonly world: ProjectionWorld,
		private readonly scene: Scene,
		private readonly options: ProjectionHexGridOptions
	) {}

	setVisible(visible: boolean): void {
		if (this.visible === visible) return;
		this.visible = visible;
		for (const tile of this.world.getTiles()) {
			tile.render.hex.setVisible(visible);
			tile.render.hexOutline.setVisible(visible);
		}
	}

	static preloadHexTexture(scene: Scene, hexSize: number, hexStroke: number): void {
		if (scene.textures.exists(ProjectionHexGrid.HEX_FILL_TEXTURE_KEY)) {
			scene.textures.remove(ProjectionHexGrid.HEX_FILL_TEXTURE_KEY);
		}
		if (scene.textures.exists(ProjectionHexGrid.HEX_OUTLINE_TEXTURE_KEY)) {
			scene.textures.remove(ProjectionHexGrid.HEX_OUTLINE_TEXTURE_KEY);
		}

		const width = Math.sqrt(3) * hexSize + 2 * hexStroke;
		const height = 2 * hexSize + 2 * hexStroke;
		const hex = ProjectionHexGrid.getHexagon(hexSize, width / 2, height / 2);

		scene.add
			.graphics()
			.fillStyle(0xffffff, 1)
			.fillPoints(hex.points, true)
			.generateTexture(ProjectionHexGrid.HEX_FILL_TEXTURE_KEY, width, height)
			.destroy();

		scene.add
			.graphics()
			.lineStyle(hexStroke, 0xffffff)
			.strokePoints(hex.points, true)
			.generateTexture(ProjectionHexGrid.HEX_OUTLINE_TEXTURE_KEY, width, height)
			.destroy();
	}

	ensureTileExists(q: number, r: number): ProjectionTile {
		const id = kingdomCoordKey(q, r);
		const existing = this.world.getTile(id);
		if (existing) return existing;

		const { x, y } = this.screenPosFor(q, r);
		const hex = this.scene.add.image(x, y, ProjectionHexGrid.HEX_FILL_TEXTURE_KEY);
		const hexOutline = this.scene.add.image(x, y, ProjectionHexGrid.HEX_OUTLINE_TEXTURE_KEY);
		hex.setVisible(this.visible);
		hexOutline.setVisible(this.visible);
		hex.setTintFill(EMPTY_HEX_TILE_COLOR);
		hex.setInteractive(ProjectionHexGrid.getHexagon(this.options.hexSize, hex.width / 2, hex.height / 2), Phaser.Geom.Polygon.Contains);

		const tile: ProjectionTile = {
			id,
			position: { q, r },
			render: {
				hex,
				hexOutline,
				hexBaseColor: EMPTY_HEX_TILE_COLOR,
				hexDisplayColor: EMPTY_HEX_TILE_COLOR,
				hexHovered: false
			}
		};
		this.world.addTile(tile);

		hex.on('pointerover', () => {
			tile.render.hexHovered = true;
			this.applyHexTint(tile);
		});
		hex.on('pointerout', () => {
			tile.render.hexHovered = false;
			this.applyHexTint(tile);
		});
		hex.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
			if (this.isPointerFromUi(pointer)) return;
			event.stopPropagation();
			this.options.onTileSelected(q, r, { screenX: pointer.x, screenY: pointer.y });
		});

		return tile;
	}

	relayout(): void {
		for (const tile of this.world.getTiles()) {
			const { x, y } = this.screenPosFor(tile.position.q, tile.position.r);
			tile.render.hex.setPosition(x, y);
			tile.render.hexOutline.setPosition(x, y);
		}
	}

	private screenPosFor(q: number, r: number): { x: number; y: number } {
		const centerX = Math.round(this.scene.scale.width / 2);
		const centerY = Math.round(this.scene.scale.height / 2 + this.options.gridOriginYOffset);
		const parity = (r & 1) === 0 ? 0 : 1;
		const c = (q - parity) / 2;

		return {
			x: Math.round(centerX + this.options.hexSize * Math.sqrt(3) * (c + 0.5 * parity)),
			y: Math.round(centerY + (this.options.hexSize * 3) / 2 * r)
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

	private applyHexTint(tile: ProjectionTile): void {
		const displayColor = tile.render.hexHovered
			? getHoveredHexTileColor(tile.render.hexBaseColor)
			: tile.render.hexBaseColor;
		if (displayColor === tile.render.hexDisplayColor) return;
		tile.render.hexDisplayColor = displayColor;
		tile.render.hex.setTintFill(displayColor);
	}

	private isPointerFromUi(pointer: Phaser.Input.Pointer): boolean {
		const target = pointer.event?.target;
		return target instanceof HTMLElement && !!target.closest('#ui-root');
	}
}
