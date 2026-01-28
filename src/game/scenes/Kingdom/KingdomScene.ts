import { Scene } from 'phaser';
import { eventBus } from '../../../eventBus';
import { ECSManager } from './ecs/ECSBase';
import { RenderSystem } from './ecs/systems/RenderSystem';
import { BuildSystem } from './ecs/systems/BuildSystem';
import { ProductionSystem } from './ecs/systems/ProductionSystem';
import { ShopSystem } from './ecs/systems/ShopSystem';
import { getAllBuildingDefs, getBlockingBuildings, getBuildingDef, getNextUpgradeDef } from './data/buildings';
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
	private readonly HEX_STROKE: number = 4;
	private readonly TICK_INTERVAL_MS: number = 1000;
	private tickAccumulator = 0;
	private readonly GRID_ORIGIN_Y_OFFSET = -20;

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
		this.cameras.main.setBackgroundColor(0xcacaca);

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

		// Initialize dynamic visible hexes
		this.initDynamicStartingArea();

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
			.fillStyle(0x33cc33, 1)
			.strokePoints(this.getHexagon(hexSize, width / 2, height / 2).points, true)
			.fillPoints(this.getHexagon(hexSize, width / 2, height / 2).points, true)
			.generateTexture('hexTile', width, height)
			.destroy();
	}

	private neighborsOf(q: number, r: number): Array<{ q: number; r: number }> {
		// Doubled-q coordinates (q is doubled column), derived from odd-r offset grid.
		// Neighbor deltas: E/W = +/-2,0 ; diagonals = +/-1,+/-1
		const deltas = [
			{ dq: 2, dr: 0 },
			{ dq: 1, dr: 1 },
			{ dq: -1, dr: 1 },
			{ dq: -2, dr: 0 },
			{ dq: -1, dr: -1 },
			{ dq: 1, dr: -1 }
		];
		return deltas.map(d => ({ q: q + d.dq, r: r + d.dr }));
	}

	private screenPosFor(q: number, r: number) {
		const centerX = this.scale.width / 2;
		const centerY = this.scale.height / 2 + this.GRID_ORIGIN_Y_OFFSET;

		const parity = (r & 1) === 0 ? 0 : 1;
		const c = (q - parity) / 2;

		const x = centerX + this.HEX_SIZE * Math.sqrt(3) * (c + 0.5 * parity);
		const y = centerY + (this.HEX_SIZE * 3) / 2 * r;
		return { x, y };
	}

	private getRandomBlockerId(): string {
		const blockers = getBlockingBuildings();
		if (blockers.length === 0) {
			throw new Error('No blocker building defs found.');
		}
		return blockers[Math.floor(Math.random() * blockers.length)]!.id;
	}

	private ensureTileExists(q: number, r: number): Entity {
		const id = `${q},${r}`;
		const existing = this.world.getEntity(id);
		if (existing) return existing;

		const { x, y } = this.screenPosFor(q, r);
		const tile = this.add.image(x, y, 'hexTile');
		tile.setInteractive(this.getHexagon(this.HEX_SIZE, tile.width / 2, tile.height / 2), Phaser.Geom.Polygon.Contains);

		const entity: Entity = {
			id,
			position: { q, r },
			render: { hex: tile }
		};
		this.world.addEntity(entity);

		tile.on('pointerover', () => {
			tile.setTintFill(0x70db70);
		});
		tile.on('pointerout', () => {
			tile.clearTint();
		});
		tile.on('pointerdown', (
			_pointer: Phaser.Input.Pointer,
			_localX: number,
			_localY: number,
			event: Phaser.Types.Input.EventData
		) => {
			// prevent global pointerdown from clearing selection
			event.stopPropagation();
			this.selectedTile = { q, r };
			this.publishTileSelected(q, r);
		});

		return entity;
	}

	private placeBlockerIfEmpty(q: number, r: number): void {
		const entity = this.ensureTileExists(q, r);
		if (entity.building) return;

		const blockerId = this.getRandomBlockerId();
		entity.building = {
			buildingId: blockerId,
			status: 'active',
			progress: 0
		};
	}

	private initDynamicStartingArea(): void {
		const startCenter = { q: 0, r: 0 };
		const free = new Set<string>();
		const markFree = (q: number, r: number) => free.add(`${q},${r}`);

		// Center + 6 neighbors are visible and free to build.
		markFree(startCenter.q, startCenter.r);
		for (const n of this.neighborsOf(startCenter.q, startCenter.r)) {
			markFree(n.q, n.r);
		}

		// Spawn free tiles.
		for (const key of free) {
			const [qStr, rStr] = key.split(',');
			this.ensureTileExists(Number(qStr), Number(rStr));
		}

		// All neighbors of the free region become visible but blocked.
		const blocked = new Set<string>();
		for (const key of free) {
			const [qStr, rStr] = key.split(',');
			const q = Number(qStr);
			const r = Number(rStr);
			for (const n of this.neighborsOf(q, r)) {
				const nid = `${n.q},${n.r}`;
				if (free.has(nid)) continue;
				blocked.add(nid);
			}
		}

		for (const key of blocked) {
			const [qStr, rStr] = key.split(',');
			this.placeBlockerIfEmpty(Number(qStr), Number(rStr));
		}
	}

	private revealHiddenNeighbors(q: number, r: number): void {
		for (const n of this.neighborsOf(q, r)) {
			// If a tile doesn't exist yet, it was hidden; uncover as blocked.
			if (!this.world.getEntity(`${n.q},${n.r}`)) {
				this.placeBlockerIfEmpty(n.q, n.r);
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
		const buildingId = entity?.building?.buildingId;
		const wasBlocker = buildingId ? getBuildingDef(buildingId)?.type === 'blocking' : false;

		try { this.buildSystem.destroyBuilding(entity!); }
		catch (e: Error | any) {
			console.log(e.message);
			return;
		}
		this.publishResourceUpdates();
		if (wasBlocker) {
			this.revealHiddenNeighbors(q, r);
		}
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
