import { Scene } from 'phaser';
import { getGameRun } from '../../run/runRegistry';
import { eventBus } from '../../../eventBus';
import { configuration } from '../../configuration';

export class WorldMapScene extends Scene {
	private readonly PADDING = configuration.worldMapView.padding;
	private dots: Map<string, Phaser.GameObjects.Arc> = new Map();
	private lastSelectedPointId: string | null = null;
	private links?: Phaser.GameObjects.Graphics;
	private armyFlag?: Phaser.GameObjects.Image;
	private onResize?: () => void;
	private onBackgroundPointerDown?: (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => void;
	private onEsc?: () => void;
	private unsubscribeUiToGame?: () => void;
	private unsubscribeGameToUi?: () => void;

	constructor() {
		super('WorldMap');
	}

	preload(): void {
		this.load.setPath('assets');
		if (!this.textures.exists('wm_army_flag')) {
			// SVG in public/assets/game_icons/flying-flag.svg
			this.load.svg('wm_army_flag', 'game_icons/flying-flag.svg', { scale: configuration.worldMapView.armyFlagScale });
		}
	}

	create(): void {
		this.cameras.main.setBackgroundColor(configuration.worldMapView.backgroundColor);
		if (!this.links) this.links = this.add.graphics().setDepth(1);
		if (!this.armyFlag && this.textures.exists('wm_army_flag')) {
			this.armyFlag = this.add.image(0, 0, 'wm_army_flag').setDepth(4);
			this.armyFlag.setVisible(false);
		}

		const run = getGameRun(this);
		run.ensureWorldMapGenerated();

		// If the scene is restarted, ensure we don't reuse destroyed dots.
		for (const dot of this.dots.values()) {
			// Safe even if already destroyed.
			dot.destroy();
		}
		this.dots.clear();

		this.createOrUpdateDots();
		this.publishLayout();
		this.redrawLinks();
		this.redrawArmyMarker();
		this.lastSelectedPointId = null;

		this.onResize = () => {
			this.createOrUpdateDots();
			this.publishLayout();
			this.redrawLinks();
			this.redrawArmyMarker();
		};
		this.scale.on('resize', this.onResize);

		// clicking on empty space clears selection
		this.onBackgroundPointerDown = (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
			if (currentlyOver.length !== 0) return;
			this.lastSelectedPointId = null;
			eventBus.publishGameToUi({ type: 'worldmap-poi-cleared' });
		};
		this.input.on('pointerdown', this.onBackgroundPointerDown);

		this.unsubscribeUiToGame = eventBus.subscribeUiToGame((event) => {
			if (event.type !== 'worldmap-refresh-requested') return;
			this.createOrUpdateDots();
			this.publishLayout();
			this.redrawLinks();
			this.redrawArmyMarker();
			if (this.lastSelectedPointId) this.publishSelected(this.lastSelectedPointId);
		});

		// Travel updates can affect army marker + POI colors.
		this.unsubscribeGameToUi = eventBus.subscribeGameToUi((event) => {
			if (event.type !== 'worldmap-travel-updated') return;
			this.createOrUpdateDots();
			this.publishLayout();
			this.redrawLinks();
			this.redrawArmyMarker();
		});

		this.onEsc = () => {
			this.scene.stop('WorldMap');
			this.scene.resume('Kingdom');
			eventBus.publishGameToUi({ type: 'worldmap-visibility-changed', isOpen: false });
			eventBus.publishGameToUi({ type: 'worldmap-poi-cleared' });
		};
		this.input.keyboard?.on('keydown-ESC', this.onEsc);

		// Ensure UI is cleaned up even if the scene is stopped externally.
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			if (this.onResize) this.scale.off('resize', this.onResize);
			if (this.onBackgroundPointerDown) this.input.off('pointerdown', this.onBackgroundPointerDown);
			if (this.onEsc) this.input.keyboard?.off('keydown-ESC', this.onEsc);
			if (this.unsubscribeUiToGame) this.unsubscribeUiToGame();
			if (this.unsubscribeGameToUi) this.unsubscribeGameToUi();
			this.onResize = undefined;
			this.onBackgroundPointerDown = undefined;
			this.onEsc = undefined;
			this.unsubscribeUiToGame = undefined;
			this.unsubscribeGameToUi = undefined;
			this.lastSelectedPointId = null;
			if (this.links) this.links.destroy();
			if (this.armyFlag) this.armyFlag.destroy();
			this.links = undefined;
			this.armyFlag = undefined;

			for (const dot of this.dots.values()) {
				dot.destroy();
			}
			this.dots.clear();

			eventBus.publishGameToUi({ type: 'worldmap-visibility-changed', isOpen: false });
			eventBus.publishGameToUi({ type: 'worldmap-poi-cleared' });
		});
	}

	private formatPoiName(name: string, kind: string, hops: number): string {
		if (kind === 'kingdom') return name;
		const level = Number.isFinite(hops) ? Math.max(0, Math.floor(hops)) : 0;
		return `${name} Lv. ${level}`;
	}

	private createOrUpdateDots(): void {
		const run = getGameRun(this);
		const w = this.scale.width;
		const h = this.scale.height;
		const visiblePoints = run.getRevealedWorldPoints();
		const visibleIds = new Set(visiblePoints.map((p) => p.id));

		for (const [id, dot] of this.dots.entries()) {
			if (visibleIds.has(id)) continue;
			dot.destroy();
			this.dots.delete(id);
			if (this.lastSelectedPointId === id) {
				this.lastSelectedPointId = null;
				eventBus.publishGameToUi({ type: 'worldmap-poi-cleared' });
			}
		}

		const arrivedTargetId = run.travel.status === 'arrived' ? run.travel.toPointId : null;
		for (const p of visiblePoints) {
			const x = this.PADDING + p.x * (w - this.PADDING * 2);
			const y = this.PADDING + p.y * (h - this.PADDING * 2);
			const color =
				arrivedTargetId && p.id === arrivedTargetId
					? configuration.worldMapView.dots.colors.arrived
					: p.owner === 'player'
						? configuration.worldMapView.dots.colors.player
						: p.owner === 'enemy'
							? configuration.worldMapView.dots.colors.enemy
							: configuration.worldMapView.dots.colors.neutral;
			const radius = p.kind === 'kingdom' ? configuration.worldMapView.dots.radius.kingdom : configuration.worldMapView.dots.radius.other;

			let dot = this.dots.get(p.id);
			const isReusable = !!dot && dot.active && dot.scene === this && (dot as any).geom != null;
			if (!isReusable) {
				if (dot) dot.destroy();
				dot = this.add.circle(x, y, radius, color, 1);
				dot.setDepth(3);
				dot.setStrokeStyle(
					configuration.worldMapView.dots.stroke.width,
					configuration.worldMapView.dots.stroke.color,
					configuration.worldMapView.dots.stroke.alpha
				);
				dot.setInteractive({ useHandCursor: true });
					dot.on('pointerdown', () => {
						this.lastSelectedPointId = p.id;
						this.publishSelected(p.id);
					});
				this.dots.set(p.id, dot);
			}
			if (!dot) continue;

			dot.setPosition(x, y);
			dot.setFillStyle(color, 1);
			dot.setRadius(radius);
		}
	}

	private redrawArmyMarker(): void {
		const run = getGameRun(this);
		const w = this.scale.width;
		const h = this.scale.height;

		const toScreen = (p: { x: number; y: number }) => ({
			x: this.PADDING + p.x * (w - this.PADDING * 2),
			y: this.PADDING + p.y * (h - this.PADDING * 2)
		});

		// Army marker only (no dynamic path rendering).
		const armyPos = run.getArmyWorldPositionNormalized();
		const armyScreen = toScreen(armyPos);
		if (this.armyFlag) {
			this.armyFlag.setVisible(true);
			this.armyFlag.setPosition(armyScreen.x, armyScreen.y);
			this.armyFlag.setScale(configuration.worldMapView.armyFlagScale);
		}
	}

	private redrawLinks(): void {
		const run = getGameRun(this);
		const w = this.scale.width;
		const h = this.scale.height;
		if (!this.links) return;

		this.links.clear();
		this.links.lineStyle(configuration.worldMapView.links.width, configuration.worldMapView.links.color, configuration.worldMapView.links.alpha);

		const toScreen = (p: { x: number; y: number }) => ({
			x: this.PADDING + p.x * (w - this.PADDING * 2),
			y: this.PADDING + p.y * (h - this.PADDING * 2)
		});

		const drawn = new Set<string>();
		for (const p of run.getWorldPoints()) {
			const a = toScreen(p);
			for (const n of p.neighbors) {
				const other = run.getWorldPoints().find((x) => x.id === n.pointId);
				if (!other) continue;
				const key = [p.id, other.id].sort().join('|');
				if (drawn.has(key)) continue;
				drawn.add(key);
				const b = toScreen(other);
				this.links.beginPath();
				this.links.moveTo(a.x, a.y);
				this.links.lineTo(b.x, b.y);
				this.links.strokePath();
			}
		}
	}

	private publishLayout(): void {
		const run = getGameRun(this);
		const w = this.scale.width;
		const h = this.scale.height;
		const visiblePoints = run.getRevealedWorldPoints();
		eventBus.publishGameToUi({
			type: 'worldmap-points-layout',
			points: visiblePoints.map((p) => ({
				id: p.id,
				name: this.formatPoiName(p.name, p.kind, p.hopsFromKingdom),
				kind: p.kind,
				owner: p.owner,
				screenX: this.PADDING + p.x * (w - this.PADDING * 2),
				screenY: this.PADDING + p.y * (h - this.PADDING * 2),
				defenderCount: p.defenders.length
			}))
		});
	}

	private publishSelected(pointId: string): void {
		const run = getGameRun(this);
		const p = run.worldMap.points.find((x) => x.id === pointId);
		if (!p) return;
		eventBus.publishGameToUi({
			type: 'worldmap-poi-selected',
			poi: {
				id: p.id,
				name: this.formatPoiName(p.name, p.kind, p.hopsFromKingdom),
				kind: p.kind,
				owner: p.owner,
				pathDistance: run.getPathDistanceTo(p.id),
				defenders: p.defenders.map((d) => ({ unitId: d.unitId, name: d.name, assetPath: d.assetPath }))
			}
		});
	}
}
