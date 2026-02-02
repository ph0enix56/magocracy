import { Scene } from 'phaser';
import { getGameRun } from '../../run/runRegistry';
import { eventBus } from '../../../eventBus';

export class WorldMapScene extends Scene {
	private readonly PADDING = 80;
	private dots: Map<string, Phaser.GameObjects.Arc> = new Map();
	private lastSelectedPointId: string | null = null;
	private links?: Phaser.GameObjects.Graphics;
	private armyPath?: Phaser.GameObjects.Graphics;
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
			this.load.svg('wm_army_flag', 'game_icons/flying-flag.svg', { scale: 0.6 });
		}
	}

	create(): void {
		this.cameras.main.setBackgroundColor(0x0d1b2a);

		if (!this.links) this.links = this.add.graphics().setDepth(1);
		if (!this.armyPath) this.armyPath = this.add.graphics().setDepth(2);
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
		this.redrawLinksAndArmy();
		this.lastSelectedPointId = null;

		this.onResize = () => {
			this.createOrUpdateDots();
			this.publishLayout();
			this.redrawLinksAndArmy();
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
			this.redrawLinksAndArmy();
			if (this.lastSelectedPointId) this.publishSelected(this.lastSelectedPointId);
		});

		// Travel reveals new POIs; refresh map when travel updates.
		this.unsubscribeGameToUi = eventBus.subscribeGameToUi((event) => {
			if (event.type !== 'worldmap-travel-updated') return;
			this.createOrUpdateDots();
			this.publishLayout();
			this.redrawLinksAndArmy();
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
			if (this.armyPath) this.armyPath.destroy();
			if (this.armyFlag) this.armyFlag.destroy();
			this.links = undefined;
			this.armyPath = undefined;
			this.armyFlag = undefined;

			for (const dot of this.dots.values()) {
				dot.destroy();
			}
			this.dots.clear();

			eventBus.publishGameToUi({ type: 'worldmap-visibility-changed', isOpen: false });
			eventBus.publishGameToUi({ type: 'worldmap-poi-cleared' });
		});
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
					? 0xe63946
					: p.owner === 'player'
						? 0x2d6a4f
						: p.owner === 'enemy'
							? 0x9b2226
							: 0x3a86ff;
			const radius = p.kind === 'kingdom' ? 20 : 14;

			let dot = this.dots.get(p.id);
			const isReusable = !!dot && dot.active && dot.scene === this && (dot as any).geom != null;
			if (!isReusable) {
				if (dot) dot.destroy();
				dot = this.add.circle(x, y, radius, color, 1);
				dot.setDepth(3);
				dot.setStrokeStyle(3, 0xe0e1dd, 0.8);
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

	private redrawLinksAndArmy(): void {
		const run = getGameRun(this);
		const w = this.scale.width;
		const h = this.scale.height;

		this.links?.clear();
		this.armyPath?.clear();

		const toScreen = (p: { x: number; y: number }) => ({
			x: this.PADDING + p.x * (w - this.PADDING * 2),
			y: this.PADDING + p.y * (h - this.PADDING * 2)
		});

		// Lines between player-controlled POIs.
		const owned = run.worldMap.points.filter((p) => p.owner === 'player');
		const home = run.worldMap.points.find((p) => p.owner === 'player' && p.kind === 'kingdom');
		if (this.links && home) {
			this.links.lineStyle(3, 0x74c69d, 0.55);
			const a = toScreen(home);
			for (const p of owned) {
				if (p.id === home.id) continue;
				const b = toScreen(p);
				this.links.beginPath();
				this.links.moveTo(a.x, a.y);
				this.links.lineTo(b.x, b.y);
				this.links.strokePath();
			}
		}

		// Army marker and line to origin.
		const showArmy = run.travel.status === 'travelling' || run.travel.status === 'arrived';
		if (!showArmy) {
			if (this.armyFlag) this.armyFlag.setVisible(false);
			return;
		}

		const armyPos = run.getArmyWorldPositionNormalized();
		const armyScreen = toScreen(armyPos);
		if (this.armyFlag) {
			this.armyFlag.setVisible(true);
			this.armyFlag.setPosition(armyScreen.x, armyScreen.y);
			this.armyFlag.setScale(0.6);
		}

		const fromId = run.travel.status === 'travelling' ? run.travel.fromPointId : run.travel.status === 'arrived' ? run.travel.fromPointId : null;
		const from = fromId ? run.worldMap.points.find((p) => p.id === fromId) : undefined;
		if (this.armyPath && from) {
			const fromScreen = toScreen(from);
			this.armyPath.lineStyle(2, 0xe0e1dd, 0.65);
			this.armyPath.beginPath();
			this.armyPath.moveTo(fromScreen.x, fromScreen.y);
			this.armyPath.lineTo(armyScreen.x, armyScreen.y);
			this.armyPath.strokePath();
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
				name: p.name,
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
				name: p.name,
				kind: p.kind,
				owner: p.owner,
				defenders: p.defenders.map((d) => ({ unitId: d.unitId, name: d.name, assetPath: d.assetPath }))
			}
		});
	}
}
