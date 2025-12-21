import { Scene } from 'phaser';
import { eventBus } from '../../eventBus';

export class Game extends Scene {
	constructor() {
		super('Game');
	}

	preload() {
		this.load.setPath('assets');
		this.initHexTexture(this.HEX_SIZE, 3);
	}

	create() {
		this.createHexGrid(7, 7, this.HEX_SIZE);

		// notify UI when clicking off any tile
		this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
			if (currentlyOver.length === 0) {
				eventBus.publishGameToUi({ type: 'tile-cleared' });
			}
		});

		// listen for UI build/destroy commands
		eventBus.subscribeUiToGame(event => {
			if (event.type === 'build-requested') {
				this.handleBuild(event.q, event.r);
			} else if (event.type === 'destroy-requested') {
				this.handleDestroy(event.q, event.r);
			}
		});
	}

	// for debug only
	timer: number = 0;
	private testUpdateMana(delta: number): void {
		this.timer += delta;
		if (this.timer < 1000) return;
		this.timer = 0;
		eventBus.publishGameToUi({
			type: 'resource-updated',
			key: 'mana',
			value: Math.floor(Math.random() * 100) });
	}

	override update(_time: number, delta: number): void {
		this.testUpdateMana(delta);
	}

	HEX_SIZE: number = 64;

	// doubled coordinate representation: 2D array
	private tiles: Array<Array<{full: boolean, g?: Phaser.GameObjects.Image, built?: Phaser.GameObjects.Arc}>>;

	private getHexagon(hexSize: number, centerX: number, centerY: number): Phaser.Geom.Polygon {
		const points = [];
		for (let i = 0; i < 6; i++) {
			const angle = Phaser.Math.DegToRad(60 * i - 30);
			const x = centerX + hexSize * Math.cos(angle);
			const y = centerY + hexSize * Math.sin(angle);
			points.push(new Phaser.Geom.Point(x, y));
		}
		return new Phaser.Geom.Polygon(points);
	}

	// create and bake hex texture
	private initHexTexture(hexSize: number, stroke: number) {
		const width = Math.sqrt(3) * hexSize + 2 * stroke;
		const height = 2 * hexSize + 2 * stroke;

		this.add.graphics()
			.lineStyle(stroke, 0xffffff)
			.fillStyle(0x00ff00, 0.1)
			.strokePoints(this.getHexagon(hexSize, width / 2, height / 2).points, true)
			.fillPoints(this.getHexagon(hexSize, width / 2, height / 2).points, true)
			.generateTexture('hexTile', width, height)
			.destroy();
	}

	private createHexGrid(rows: number, cols: number, hexSize: number) {
		// center grid on screen
		const centerX = this.scale.width / 2;
		const centerY = this.scale.height / 2 - 20;

		// hex dimensions
		const hexWidth = Math.sqrt(3) * hexSize;
		const hexHeight = 2 * hexSize;

		// total grid dimensions
		const totalWidth = hexWidth * (cols + 0.5);
		const totalHeight = (3/2 * hexSize) * (rows - 1) + hexHeight;

		// origin point (top-left)
		const originX = centerX - totalWidth / 2 + hexWidth / 2;
		const originY = centerY - totalHeight / 2 + hexHeight / 2;

		// first initialize array to accommodate the double of cols
		this.tiles = new Array(cols * 2);
		for (let i = 0; i < cols * 2; i++) {
			this.tiles[i] = new Array(rows);
		}

		// now, fill valid coordinates with a hex game object
		for (let c = 0; c < cols; c++) {
			for (let r = 0; r < rows; r++) {
				// even row: q = 2 * c, odd row: q = 2 * c + 1
				const q = r % 2 === 0 ? 2 * c : 2 * c + 1;

				// calculate screen position
				const posX = hexSize * Math.sqrt(3) * (c + 0.5 * (r % 2));
				const posY = hexSize * 3/2 * r;

				let tile = this.add.image(originX + posX, originY + posY, 'hexTile');

				tile.setInteractive(
					this.getHexagon(hexSize, tile.width / 2, tile.height / 2),
					Phaser.Geom.Polygon.Contains
				);
				tile.on('pointerover', () => {
					tile.setTintFill(0xffffff);
				});
				tile.on('pointerout', () => {
					tile.clearTint();
				});
				tile.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
					// prevent global pointerdown from clearing selection
					event.stopPropagation();
					const built = !!this.tiles[q]?.[r]?.built;
					eventBus.publishGameToUi({
						type: 'tile-selected',
						payload: { q, r, built }
					});
				});
				this.tiles[q]![r]! = { full: false, g: tile };
			}
		}
	}

	private handleBuild(q: number, r: number) {
		const tile = this.tiles[q]?.[r];
		if (!tile || !tile.g || tile.built) return;
		const circle = this.add.circle(tile.g.x, tile.g.y, this.HEX_SIZE * 0.35, 0x0000ff, 1);
		tile.built = circle;
		tile.full = true;
	}

	private handleDestroy(q: number, r: number) {
		const tile = this.tiles[q]?.[r];
		if (!tile || !tile.built) return;
		tile.built.destroy();
		tile.built = undefined;
		tile.full = false;
	}
}
