import { Scene } from 'phaser';
import { eventBus } from '../../../eventBus';
import { configuration } from '../../configuration';
import { multiplayerClient } from '../../../multiplayer/client/clientSingleton';
import type { BuildingCatalogSnapshot, GameSnapshot, KingdomTileSnapshot } from '../../../shared/multiplayer/protocol';
import { ensureProjectionWorld } from './projection/ProjectionRegistry';
import { ProjectionRenderSystem } from './projection/ProjectionRenderSystem';
import { ProjectionHexGrid } from './projection/ProjectionHexGrid';
import { TileSelectionProjection } from './projection/TileSelectionProjection';
import { SelectionSystem } from './projection/SelectionSystem';
import type { ProjectionWorld } from './projection/model';

export class KingdomScene extends Scene {
	private world!: ProjectionWorld;
	private renderSystem!: ProjectionRenderSystem;
	private hexGridSystem!: ProjectionHexGrid;
	private tileSelectionSystem!: TileSelectionProjection;
	private selectionSystem!: SelectionSystem;
	private readonly SELECTED_TILE_UI_TICK_MS = configuration.kingdomView.selectedTileUiTickMs;
	private readonly HEX_SIZE: number = configuration.kingdomView.hexSize;
	private readonly HEX_STROKE: number = configuration.kingdomView.hexStroke;
	private readonly GRID_ORIGIN_Y_OFFSET = configuration.kingdomView.gridOriginYOffset;
	private multiplayerUnsubscribe: (() => void) | null = null;

	constructor() {
		super('Kingdom');
	}

	preload() {
		ProjectionHexGrid.preloadHexTexture(this, this.HEX_SIZE, this.HEX_STROKE);
	}

	create() {
		this.world = ensureProjectionWorld(this);

		this.cameras.main.setBackgroundColor(configuration.kingdomView.backgroundColor);

		this.tileSelectionSystem = new TileSelectionProjection(this.world);
		this.selectionSystem = new SelectionSystem({
			tickIntervalMs: this.SELECTED_TILE_UI_TICK_MS,
			onTick: (q, r) => this.publishTileSelected(q, r)
		});
		this.renderSystem = new ProjectionRenderSystem(this.world, this);
		this.hexGridSystem = new ProjectionHexGrid(this.world, this, {
			hexSize: this.HEX_SIZE,
			hexStroke: this.HEX_STROKE,
			gridOriginYOffset: this.GRID_ORIGIN_Y_OFFSET,
			onTileSelected: (q, r) => {
				this.selectionSystem.select(q, r);
			}
		});

		this.multiplayerUnsubscribe = multiplayerClient.subscribeServerEvents((event) => {
			if (event.type === 'catalog/snapshot') {
				this.loadCatalogAssets(event.catalog);
				return;
			}
			if (event.type !== 'game/snapshot') return;
			this.applyMultiplayerSnapshot(event.game);
		});
		this.events.once('shutdown', () => {
			this.multiplayerUnsubscribe?.();
			this.multiplayerUnsubscribe = null;
		});

		// notify UI when clicking off any tile
		this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
			if (currentlyOver.length === 0) {
				this.selectionSystem.clear();
				eventBus.publishGameToUi({ type: 'tile-cleared' });
			}
		});

		const initialCatalog = multiplayerClient.getCatalog();
		if (initialCatalog) {
			this.loadCatalogAssets(initialCatalog);
		}
	}


	override update(time: number, delta: number): void {
		this.renderSystem.update();
		this.selectionSystem.tick(delta);
	}

	private publishTileSelected(q: number, r: number) {
		const payload = this.tileSelectionSystem.buildPayload(q, r);
		eventBus.publishGameToUi({
			type: 'tile-selected',
			payload
		});
	}

	private applyMultiplayerSnapshot(game: GameSnapshot): void {
		const view = multiplayerClient.getSelfGameView(game);
		if (!view) return;
		this.applyKingdomSnapshot(view.kingdom.tiles);
	}

	private loadCatalogAssets(catalog: BuildingCatalogSnapshot): void {
		let queued = false;
		for (const building of catalog.buildings) {
			if (this.textures.exists(building.textureId)) continue;
			this.load.image(building.textureId, `assets/${building.assetPath}`);
			queued = true;
		}
		if (queued && !this.load.isLoading()) {
			this.load.start();
		}
	}

	private applyKingdomSnapshot(tiles: KingdomTileSnapshot[]): void {
		const snapshotIds = new Set(tiles.map((tile) => `${tile.q},${tile.r}`));
		for (const tile of tiles) {
			const entity = this.hexGridSystem.ensureTileExists(tile.q, tile.r);
			entity.position = { q: tile.q, r: tile.r };
			if (tile.building) {
				entity.building = {
					buildingId: tile.building.buildingId,
					status: tile.building.status,
					progress: tile.building.progress,
					upgradeNextId: tile.building.upgradeNextId,
					productionMultiplier: tile.building.productionMultiplier
				};
			} else {
				delete entity.building;
			}
		}

		for (const tile of this.world.getTiles()) {
			const key = `${tile.position.q},${tile.position.r}`;
			if (snapshotIds.has(key)) continue;
			delete tile.building;
		}
	}
}
