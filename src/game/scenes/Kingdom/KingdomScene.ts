import { Scene } from 'phaser';
import { configuration } from '../../configuration';
import type { BuildingCatalogSnapshot, KingdomTileSnapshot } from '../../../shared/multiplayer/protocol';
import { gameSessionClient, gameSessionState } from '../../../multiplayer/client/gameSessionStore';
import { ConstructionBadge } from './projection/ConstructionBadge';
import { ProjectionRenderSystem } from './projection/ProjectionRenderSystem';
import { ProjectionHexGrid } from './projection/ProjectionHexGrid';
import { ProjectionWorld, type ProjectionRenderState } from './projection/model';

export class KingdomScene extends Scene {
	private world!: ProjectionWorld;
	private renderSystem!: ProjectionRenderSystem;
	private hexGridSystem!: ProjectionHexGrid;
	private readonly HEX_SIZE: number = configuration.kingdomView.hexSize;
	private readonly HEX_STROKE: number = configuration.kingdomView.hexStroke;
	private readonly GRID_ORIGIN_Y_OFFSET = configuration.kingdomView.gridOriginYOffset;
	private stateUnsubscribe: (() => void) | null = null;
	private readonly handleResize = () => {
		this.hexGridSystem.relayout();
	};

	constructor() {
		super('Kingdom');
	}

	preload() {
		ProjectionHexGrid.preloadHexTexture(this, this.HEX_SIZE, this.HEX_STROKE);
		ConstructionBadge.preload(this);
	}

	create() {
		this.world = new ProjectionWorld();

		this.cameras.main.setBackgroundColor(configuration.kingdomView.backgroundColor);

		this.renderSystem = new ProjectionRenderSystem(this.world, this);
		this.hexGridSystem = new ProjectionHexGrid(this.world, this, {
			hexSize: this.HEX_SIZE,
			hexStroke: this.HEX_STROKE,
			gridOriginYOffset: this.GRID_ORIGIN_Y_OFFSET,
			onTileSelected: (q, r) => {
				gameSessionClient.selectTile(q, r);
			}
		});

		this.scale.on('resize', this.handleResize);

		this.stateUnsubscribe = gameSessionState.subscribe((state) => {
			this.loadCatalogAssets({ buildings: state.catalog });
			this.applyKingdomSnapshot(state.kingdom.tiles);
			this.hexGridSystem.relayout();
		});
		this.events.once('shutdown', () => {
			this.scale.off('resize', this.handleResize);
			this.stateUnsubscribe?.();
			this.stateUnsubscribe = null;
		});

		// notify UI when clicking off any tile
		this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
			if (currentlyOver.length === 0) {
				gameSessionClient.clearSelectedTile();
			}
		});
	}


	override update(_time: number, _delta: number): void {
		this.renderSystem.update();
	}

	private loadCatalogAssets(catalog: BuildingCatalogSnapshot): void {
		let queued = false;
		for (const building of catalog.buildings) {
			if (this.textures.exists(building.textureId)) continue;
			const assetUrl = `assets/${building.assetPath}`;
			if (assetUrl.toLowerCase().endsWith('.svg')) {
				const targetSize = this.getBuildingRasterSize();
				this.load.svg(building.textureId, assetUrl, { width: targetSize, height: targetSize });
			} else {
				this.load.image(building.textureId, assetUrl);
			}
			queued = true;
		}
		if (queued && !this.load.isLoading()) {
			this.load.start();
		}
	}

	private getBuildingRasterSize(): number {
		const buildingCfg = configuration.render.building;
		const deviceScale = Math.min(window.devicePixelRatio || 1, 2);
		const targetDisplaySize = buildingCfg.hexSize * buildingCfg.spriteFillScaleMultiplier;
		return Math.ceil(targetDisplaySize * buildingCfg.textureOversample * deviceScale);
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
			this.destroyTileRenderState(tile.render);
			delete tile.building;
		}
	}

	private destroyTileRenderState(render: ProjectionRenderState): void {
		render.building?.destroy();
		render.building = undefined;
		render.constructionBadge?.destroy();
		render.constructionBadge = undefined;
	}
}
