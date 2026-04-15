import { Scene } from 'phaser';
import { configuration } from '../../configuration';
import type { BuildingCatalogSnapshot, KingdomTileSnapshot } from '../../../shared/multiplayer/snapshots';
import { gameSessionClient } from '../../../multiplayer/client/gameSessionStore';
import {
	OVERLAY_BACKGROUND_EVENT,
	OVERLAY_TOWN_VISIBILITY_EVENT,
	type OverlayBackground,
	type OverlayTownVisibility
} from '../../../shared/ui/overlayRender';
import { shouldBlockGameInput } from '../../../shared/ui/uiInputGuard';
import { ConstructionBadge } from './projection/ConstructionBadge';
import { ProjectionRenderSystem } from './projection/ProjectionRenderSystem';
import { ProjectionHexGrid } from './projection/ProjectionHexGrid';
import { kingdomCatalogProjectionState, kingdomExpansionTilesVisibleState, kingdomTileProjectionState } from './projection/kingdomSceneProjectionState';
import { ProjectionWorld, type ProjectionRenderState, type ProjectionTile } from './projection/model';

export class KingdomScene extends Scene {
	private world!: ProjectionWorld;
	private renderSystem!: ProjectionRenderSystem;
	private hexGridSystem!: ProjectionHexGrid;
	private readonly HEX_SIZE: number = configuration.kingdomView.hexSize;
	private readonly HEX_STROKE: number = configuration.kingdomView.hexStroke;
	private readonly GRID_ORIGIN_Y_OFFSET = configuration.kingdomView.gridOriginYOffset;
	private readonly MIN_CAMERA_ZOOM = 0.6;
	private readonly MAX_CAMERA_ZOOM = 2.4;
	private readonly CAMERA_ZOOM_STEP = 0.12;
	private catalogUnsubscribe: (() => void) | null = null;
	private tileProjectionUnsubscribe: (() => void) | null = null;
	private expansionVisibilityUnsubscribe: (() => void) | null = null;
	private isPanning = false;
	private panPointerStart = new Phaser.Math.Vector2();
	private panCameraStart = new Phaser.Math.Vector2();
	private spaceKey!: Phaser.Input.Keyboard.Key;
	private hideTownRender = false;
	private overlayBackgroundColor: number | undefined;
	private readonly handleResize = () => {
		this.hexGridSystem.relayout();
	};
	private readonly handleOverlayTownVisibilityChanged = (event: Event) => {
		const detail = (event as CustomEvent<OverlayTownVisibility>).detail;
		this.hideTownRender = !!detail?.hideTownRender;
		this.applyOverlayRenderMode();
	};
	private readonly handleOverlayBackgroundChanged = (event: Event) => {
		const detail = (event as CustomEvent<OverlayBackground>).detail;
		this.overlayBackgroundColor = detail?.backgroundColor;
		this.applyOverlayRenderMode();
	};
	private readonly handlePointerDown = (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
		if (this.shouldIgnorePointerInput(_pointer)) return;

		if (currentlyOver.length === 0) {
			gameSessionClient.clearSelectedTile();
		}

		if (_pointer.leftButtonDown() && currentlyOver.length === 0) {
			this.isPanning = true;
			this.panPointerStart.set(_pointer.x, _pointer.y);
			this.panCameraStart.set(this.cameras.main.scrollX, this.cameras.main.scrollY);
			this.input.setDefaultCursor('grabbing');
		}
	};
	private readonly handlePointerMove = (pointer: Phaser.Input.Pointer) => {
		if (this.shouldIgnorePointerInput(pointer)) {
			this.stopPanning();
			return;
		}
		if (!this.isPanning || !pointer.isDown) return;

		const camera = this.cameras.main;
		const dragX = (pointer.x - this.panPointerStart.x) / camera.zoom;
		const dragY = (pointer.y - this.panPointerStart.y) / camera.zoom;
		camera.setScroll(this.panCameraStart.x - dragX, this.panCameraStart.y - dragY);
	};
	private readonly stopPanning = () => {
		if (!this.isPanning) return;
		this.isPanning = false;
		this.input.setDefaultCursor('');
	};
	private readonly handleWheel = (
		pointer: Phaser.Input.Pointer,
		_currentlyOver: Phaser.GameObjects.GameObject[],
		_deltaX: number,
		deltaY: number
	) => {
		if (this.shouldIgnorePointerInput(pointer)) return;
		if (deltaY === 0) return;

		const camera = this.cameras.main;
		const zoomMultiplier = deltaY > 0 ? 1 - this.CAMERA_ZOOM_STEP : 1 + this.CAMERA_ZOOM_STEP;
		const nextZoom = Phaser.Math.Clamp(camera.zoom * zoomMultiplier, this.MIN_CAMERA_ZOOM, this.MAX_CAMERA_ZOOM);
		if (nextZoom === camera.zoom) return;

		const worldPointBefore = camera.getWorldPoint(pointer.x, pointer.y);
		camera.setZoom(nextZoom);
		const worldPointAfter = camera.getWorldPoint(pointer.x, pointer.y);
		camera.scrollX += worldPointBefore.x - worldPointAfter.x;
		camera.scrollY += worldPointBefore.y - worldPointAfter.y;
	};

	private shouldIgnorePointerInput(pointer: Phaser.Input.Pointer): boolean {
		return shouldBlockGameInput(pointer.event?.target);
	}

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

		this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
		this.spaceKey.on('down', () => {
			this.cameras.main.setScroll(0, 0);
			this.cameras.main.setZoom(1);
		});

		this.renderSystem = new ProjectionRenderSystem(this.world, this);
		this.hexGridSystem = new ProjectionHexGrid(this.world, this, {
			hexSize: this.HEX_SIZE,
			hexStroke: this.HEX_STROKE,
			gridOriginYOffset: this.GRID_ORIGIN_Y_OFFSET,
			onTileSelected: (q, r, anchor) => {
				gameSessionClient.selectTile(q, r, anchor);
			}
		});

		this.scale.on('resize', this.handleResize);

		this.catalogUnsubscribe = kingdomCatalogProjectionState.subscribe((catalog) => {
			this.loadCatalogAssets(catalog);
		});
		this.tileProjectionUnsubscribe = kingdomTileProjectionState.subscribe((tiles) => {
			this.applyKingdomSnapshot(tiles);
			this.hexGridSystem.relayout();
		});
		this.expansionVisibilityUnsubscribe = kingdomExpansionTilesVisibleState.subscribe((visible) => {
			this.hexGridSystem.setExpansionTilesVisible(visible);
		});
		this.applyOverlayRenderMode();
		window.addEventListener(OVERLAY_TOWN_VISIBILITY_EVENT, this.handleOverlayTownVisibilityChanged as EventListener);
		window.addEventListener(OVERLAY_BACKGROUND_EVENT, this.handleOverlayBackgroundChanged as EventListener);
		this.events.once('shutdown', () => {
			this.scale.off('resize', this.handleResize);
			this.input.keyboard?.removeKey(this.spaceKey);
			this.input.off('pointerdown', this.handlePointerDown);
			this.input.off('pointermove', this.handlePointerMove);
			this.input.off('pointerup', this.stopPanning);
			this.input.off('gameout', this.stopPanning);
			this.input.off('wheel', this.handleWheel);
			window.removeEventListener(OVERLAY_TOWN_VISIBILITY_EVENT, this.handleOverlayTownVisibilityChanged as EventListener);
			window.removeEventListener(OVERLAY_BACKGROUND_EVENT, this.handleOverlayBackgroundChanged as EventListener);
			this.catalogUnsubscribe?.();
			this.tileProjectionUnsubscribe?.();
			this.expansionVisibilityUnsubscribe?.();
			this.catalogUnsubscribe = null;
			this.tileProjectionUnsubscribe = null;
			this.expansionVisibilityUnsubscribe = null;
		});

		this.input.on('pointerdown', this.handlePointerDown);
		this.input.on('pointermove', this.handlePointerMove);
		this.input.on('pointerup', this.stopPanning);
		this.input.on('gameout', this.stopPanning);
		this.input.on('wheel', this.handleWheel);
	}


	override update(_time: number, _delta: number): void {
		this.renderSystem.update();
	}

	private loadCatalogAssets(catalog: BuildingCatalogSnapshot): void {
		let queued = false;
		for (const building of catalog.buildings) {
			const texKey = `building_${building.id}`;
			if (this.textures.exists(texKey)) continue;
			const assetUrl = `assets/${building.assetPath}`;
			if (assetUrl.toLowerCase().endsWith('.svg')) {
				const targetSize = this.getBuildingRasterSize();
				this.load.svg(texKey, assetUrl, { width: targetSize, height: targetSize });
			} else {
				this.load.image(texKey, assetUrl);
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
			entity.isExpansionSite = tile.isExpansionSite === true;
			if (tile.building) {
				entity.building = {
					buildingId: tile.building.buildingId,
					school: tile.building.school,
					status: tile.building.status,
					progress: tile.building.progress,
					upgradeNextId: tile.building.upgradeNextId,
					productionMultiplier: tile.building.productionMultiplier
				};
			} else {
				delete entity.building;
			}
			this.hexGridSystem.refreshTileVisualState(entity);
		}

		for (const tile of this.world.getTiles()) {
			const key = `${tile.position.q},${tile.position.r}`;
			if (snapshotIds.has(key)) continue;
			this.destroyTileEntity(tile);
		}
	}

	private destroyTileEntity(tile: ProjectionTile): void {
		this.destroyTileRenderState(tile.render);
		tile.render.expansion?.destroy();
		tile.render.expansion = undefined;
		tile.render.hex.disableInteractive();
		tile.render.hex.destroy();
		tile.render.hexOutline.destroy();
		this.world.removeTile(tile.id);
	}

	private destroyTileRenderState(render: ProjectionRenderState): void {
		render.building?.destroy();
		render.building = undefined;
		render.constructionBadge?.destroy();
		render.constructionBadge = undefined;
	}

	private applyOverlayRenderMode(): void {
		const hideTown = this.hideTownRender;
		this.cameras.main.setBackgroundColor(this.overlayBackgroundColor ?? configuration.kingdomView.backgroundColor);
		this.hexGridSystem.setVisible(!hideTown);
		this.renderSystem.setVisible(!hideTown);
		if (hideTown) {
			this.stopPanning();
		}
		this.input.enabled = !hideTown;
	}
}
