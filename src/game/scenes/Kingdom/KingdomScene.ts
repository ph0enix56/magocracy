import { Scene } from 'phaser';
import { eventBus } from '../../../eventBus';
import { ECSManager } from './ecs/ECSBase';
import { RenderSystem } from './ecs/systems/RenderSystem';
import { ConstructionSystem } from './ecs/systems/ConstructionSystem';
import { ProductionSystem } from './ecs/systems/ProductionSystem';
import { getBuildingDef, BUILDINGS } from './data/buildings';
import type { Entity } from './ecs/ECSBase';

export class KingdomScene extends Scene {
	private world: ECSManager;
	private productionSystem!: ProductionSystem;

	constructor() {
		super('Kingdom');
		this.world = new ECSManager();
	}

	preload() {
		this.load.setPath('assets');
		this.initHexTexture(this.HEX_SIZE, 3);

		// Load building assets
		for (const def of Object.values(BUILDINGS)) {
			this.load.image(def.textureId, def.assetPath);
		}
	}

	create() {
		// Initialize ECS systems
		this.world.addSystem(new ConstructionSystem(this.world));
		this.productionSystem = new ProductionSystem(this.world);
		this.world.addSystem(this.productionSystem);
		this.world.addSystem(new RenderSystem(this.world, this));

        // Broadcast initial resources
        this.world.broadcastResources();

		// Initialize hex grid
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
				this.handleBuild(event.q, event.r, event.buildingId);
			} else if (event.type === 'destroy-requested') {
				this.handleDestroy(event.q, event.r);
			}
		});
	}

	override update(time: number, delta: number): void {
		this.world.update(time, delta);
	}

	HEX_SIZE: number = 64;

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
				
				// Create Entity
				const entity: Entity = {
					id: `${q},${r}`,
					position: { q, r },
					render: { hex: tile }
				};
				this.world.addEntity(entity);

				tile.on('pointerover', () => {
					tile.setTintFill(0xffffff);
				});
				tile.on('pointerout', () => {
					tile.clearTint();
				});
				tile.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
					// prevent global pointerdown from clearing selection
					event.stopPropagation();
					
					// Get current state from entity
					const e = this.world.getEntity(`${q},${r}`);
					const built = !!e?.building;
					
					let buildingId: string | undefined;
					let constructionProgress: number | undefined;
					let productionMultiplier: number | undefined;

					// WIP: currently very hacky implementation
					if (e && e.building) {
						buildingId = e.building.buildingId;
						const def = getBuildingDef(buildingId);
						
						if (e.building.status === 'constructing' && def) {
							// Calculate progress %
							const totalTime = def.buildTime * 1000;
							if (totalTime > 0) {
								constructionProgress = (e.building.progress / totalTime) * 100;
							} else {
								constructionProgress = 100;
							}
						} else if (e.building.status === 'active' && def?.type === 'production') {
							productionMultiplier = this.productionSystem.calculateMultiplier(e);
						}
					}

					eventBus.publishGameToUi({
						type: 'tile-selected',
						payload: { q, r, built, buildingId, constructionProgress, productionMultiplier }
					});
				});
			}
		}
	}

	private handleBuild(q: number, r: number, buildingId: string) {
		const entity = this.world.getEntity(`${q},${r}`);
		if (!entity || entity.building) return;

		const def = getBuildingDef(buildingId);
		if (!def) return;

		// Check cost
		for (const [res, amount] of Object.entries(def.cost)) {
			const current = this.world.resources.get(res) || 0;
			if (current < amount) {
				console.log(`Not enough ${res} to build ${def.name}`);
				return;
			}
		}

		// Deduct cost
		for (const [res, amount] of Object.entries(def.cost)) {
			const current = this.world.resources.get(res) || 0;
			this.world.resources.set(res, current - amount);
			// Notify UI
			eventBus.publishGameToUi({
				type: 'resource-updated',
				key: res,
				value: current - amount
			});
		}

		// Add building component
		entity.building = {
			buildingId: buildingId,
			status: 'constructing',
			progress: 0
		};
	}

	private handleDestroy(q: number, r: number) {
		const entity = this.world.getEntity(`${q},${r}`);
		if (!entity || !entity.building) return;

		// Remove building component
		delete entity.building;
	}
}
