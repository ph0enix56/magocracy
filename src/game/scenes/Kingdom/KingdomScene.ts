import { Scene } from 'phaser';
import { eventBus } from '../../../eventBus';
import { ECSManager } from './ecs/ECSBase';
import { RenderSystem } from './ecs/systems/RenderSystem';
import { BuildSystem } from './ecs/systems/BuildSystem';
import { ProductionSystem } from './ecs/systems/ProductionSystem';
import { ShopSystem } from './ecs/systems/ShopSystem';
import { getAllBuildingDefs, getBuildingDef, getNextUpgradeDef } from './data/buildings';
import type { Entity } from './ecs/ECSBase';

export class KingdomScene extends Scene {
	private world!: ECSManager;
	private productionSystem!: ProductionSystem;
	private buildSystem!: BuildSystem;
	private shopSystem!: ShopSystem;
	private selectedTile: { q: number; r: number } | null = null;
	private selectedTileUiTimer = 0;
	private readonly SELECTED_TILE_UI_TICK_MS = 250;
	private readonly HEX_SIZE: number = 64;
	private readonly HEX_STROKE: number = 3;
	private readonly TICK_INTERVAL_MS: number = 1000;
	private tickAccumulator = 0;

	constructor() {
		super('Kingdom');
		this.world = new ECSManager();
	}

	preload() {
		this.load.setPath('assets');
		this.initHexTexture(this.HEX_SIZE, this.HEX_STROKE);

		// Load building icon assets
		for (const def of getAllBuildingDefs()) {
			this.load.image(def.textureId, def.assetPath);
		}
	}

	create() {
		// Initialize ECS systems
		this.buildSystem = new BuildSystem(this.world);
		this.world.addSystem(this.buildSystem);
		this.productionSystem = new ProductionSystem(this.world);
		this.world.addSystem(this.productionSystem);
		this.shopSystem = new ShopSystem(this.world);
		this.world.addSystem(this.shopSystem);
		this.world.addSystem(new RenderSystem(this.world, this));

		// Ensure the shop has offers at game start
		this.shopSystem.rerollFree();

		// Broadcast initial game state snapshots
		this.world.broadcastResources();
		this.world.broadcastBlueprintInventory();
		this.publishShopState();

		// Initialize hex grid
		this.createHexGrid(7, 7, this.HEX_SIZE);

		// notify UI when clicking off any tile
		this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
			if (currentlyOver.length === 0) {
				this.selectedTile = null;
				eventBus.publishGameToUi({ type: 'tile-cleared' });
			}
		});

		// listen for UI build/destroy/upgrade commands
		eventBus.subscribeUiToGame(event => {
			if (event.type === 'build-requested') {
				this.handleBuild(event.q, event.r, event.buildingId);
			} else if (event.type === 'destroy-requested') {
				this.handleDestroy(event.q, event.r);
			} else if (event.type === 'upgrade-requested') {
				this.handleUpgrade(event.q, event.r, event.upgradeBuildingId);
			} else if (event.type === 'shop-buy-requested') {
				this.handleShopBuy(event.slotIndex);
			} else if (event.type === 'shop-reroll-requested') {
				this.handleShopReroll();
			}
		});
	}

	override update(time: number, delta: number): void {
		this.world.update(time, delta);
		this.tickSelectedTileUi(delta);
		this.tickAccumulator += delta;
		if (this.tickAccumulator >= this.TICK_INTERVAL_MS) {
			this.tickAccumulator -= this.TICK_INTERVAL_MS;
			this.world.advanceTick();
			this.publishResourceUpdates();
		}
	}

	private tickSelectedTileUi(delta: number) {
		if (!this.selectedTile) return;
		this.selectedTileUiTimer += delta;
		if (this.selectedTileUiTimer < this.SELECTED_TILE_UI_TICK_MS) return;
		this.selectedTileUiTimer = 0;
		this.publishTileSelected(this.selectedTile.q, this.selectedTile.r);
	}

	private publishTileSelected(q: number, r: number) {
		const e = this.world.getEntity(`${q},${r}`);
		const built = !!e?.building;

		let buildingId: string | undefined;
		let buildingStatus: 'constructing' | 'active' | 'upgrading' | undefined;
		let constructionProgress: number | undefined;
		let productionMultiplier: number | undefined;
		let nextUpgradeId: string | undefined;
		let nextUpgradeCost: Record<string, number> | undefined;
		let nextUpgradeTime: number | undefined;
		let upgradingToId: string | undefined;
		let upgradeProgress: number | undefined;

		if (e?.building) {
			buildingId = e.building.buildingId;
			buildingStatus = e.building.status;
			const def = getBuildingDef(buildingId);

			if (e.building.status === 'constructing' && def) {
				const totalTicks = def.buildTime;
				constructionProgress = totalTicks > 0 ? (e.building.progress / totalTicks) * 100 : 100;
				constructionProgress = Math.min(100, Math.max(0, constructionProgress));
			} else if (e.building.status === 'upgrading') {
				upgradingToId = e.building.upgradeNextId;
				const targetDef = upgradingToId ? getBuildingDef(upgradingToId) : undefined;
				if (targetDef) {
					const totalTicks = targetDef.buildTime;
					upgradeProgress = totalTicks > 0 ? (e.building.progress / totalTicks) * 100 : 100;
					upgradeProgress = Math.min(100, Math.max(0, upgradeProgress));
				}
			} else if (e.building.status === 'active') {
				if (def?.type === 'production') {
					productionMultiplier = this.productionSystem.calculateMultiplier(e);
				}

				const next = buildingId ? getNextUpgradeDef(buildingId) : undefined;
				if (next) {
					nextUpgradeId = next.id;
					nextUpgradeCost = next.cost;
					nextUpgradeTime = next.buildTime;
				}
			}
		}

		eventBus.publishGameToUi({
			type: 'tile-selected',
			payload: {
				q,
				r,
				built,
				buildingId,
				buildingStatus,
				constructionProgress,
				productionMultiplier,
				nextUpgradeId,
				nextUpgradeCost,
				nextUpgradeTime,
				upgradingToId,
				upgradeProgress
			}
		});
	}

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

		this.add
			.graphics()
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
		const totalHeight = (3 / 2) * hexSize * (rows - 1) + hexHeight;

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
				const posY = (hexSize * 3) / 2 * r;

				const tile = this.add.image(originX + posX, originY + posY, 'hexTile');

				tile.setInteractive(this.getHexagon(hexSize, tile.width / 2, tile.height / 2), Phaser.Geom.Polygon.Contains);

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
				tile.on(
					'pointerdown',
					(
					_pointer: Phaser.Input.Pointer,
					_localX: number,
					_localY: number,
					event: Phaser.Types.Input.EventData
					) => {
						// prevent global pointerdown from clearing selection
						event.stopPropagation();
						this.selectedTile = { q, r };
						this.publishTileSelected(q, r);
					}
				);
			}
		}
	}

	private handleBuild(q: number, r: number, buildingId: string) {
		const entity = this.world.getEntity(`${q},${r}`);
		try { this.buildSystem.startBuild(entity!, buildingId); }
		catch (e: Error | any) {
			console.log(e.message);
			eventBus.publishGameToUi({ type: 'build-result', q, r, buildingId, ok: false, reason: e.message });
			return;
		}
		eventBus.publishGameToUi({ type: 'build-result', q, r, buildingId, ok: true });
		this.publishResourceUpdates();
		this.world.broadcastBlueprintInventory();
	}

	private handleUpgrade(q: number, r: number, upgradeBuildingId: string) {
		const entity = this.world.getEntity(`${q},${r}`);
		try { this.buildSystem.startUpgrade(entity!, upgradeBuildingId); }
		catch (e: Error | any) {
			console.log(e.message);
			eventBus.publishGameToUi({ type: 'build-result', q, r, buildingId: upgradeBuildingId, ok: false, reason: e.message });
			return;
		}
		eventBus.publishGameToUi({ type: 'build-result', q, r, buildingId: upgradeBuildingId, ok: true });
		this.publishResourceUpdates();
		this.publishTileSelected(q, r);
	}

	private handleDestroy(q: number, r: number) {
		const entity = this.world.getEntity(`${q},${r}`);
		try { this.buildSystem.destroyBuilding(entity!); }
		catch (e: Error | any) {
			console.log(e.message);
			return;
		}
		this.publishResourceUpdates();
	}

	private publishShopState() {
		const { offers, buyCost, rerollCost } = this.shopSystem.getState();
		eventBus.publishGameToUi({ type: 'shop-state-updated', offers, buyCost, rerollCost });
	}

	private handleShopBuy(slotIndex: number) {
		try {
			this.shopSystem.buyWithThrow(slotIndex);
		} catch (e: Error | any) {
			eventBus.publishGameToUi({ type: 'shop-action-result', action: 'buy', ok: false, reason: e.message, slotIndex });
			return;
		}
		eventBus.publishGameToUi({ type: 'shop-action-result', action: 'buy', ok: true, slotIndex });
		this.publishResourceUpdates();
		this.world.broadcastBlueprintInventory();
		this.publishShopState();
	}

	private handleShopReroll() {
		try {
			this.shopSystem.rerollWithThrow();
		} catch (e: Error | any) {
			eventBus.publishGameToUi({ type: 'shop-action-result', action: 'reroll', ok: false, reason: e.message });
			return;
		}
		eventBus.publishGameToUi({ type: 'shop-action-result', action: 'reroll', ok: true });
		this.publishResourceUpdates();
		this.publishShopState();
	}

	private publishResourceUpdates() {
		for (const [key, value] of this.world.resources) {
			eventBus.publishGameToUi({ type: 'resource-updated', key, value });
		}
	}
}
