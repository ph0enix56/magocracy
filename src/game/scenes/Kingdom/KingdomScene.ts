import { Scene } from 'phaser';
import { eventBus } from '../../../eventBus';
import { ECSManager } from './ecs/ECSBase';
import { RenderSystem } from './ecs/systems/RenderSystem';
import { BuildSystem } from './ecs/systems/BuildSystem';
import { ProductionSystem } from './ecs/systems/ProductionSystem';
import { ShopSystem } from './ecs/systems/ShopSystem';
import { ArmySystem } from './ecs/systems/ArmySystem';
import { CombatSystem } from './ecs/systems/CombatSystem';
import { HexGridSystem } from './ecs/systems/HexGridSystem';
import { TileSelectionSystem } from './ecs/systems/TileSelectionSystem';
import { SelectionSystem } from './ecs/systems/SelectionSystem';
import { getAllBuildingDefs, getBuildingDef } from './data/buildings';
import { getGameRun } from '../../run/runRegistry';
import { configuration } from '../../configuration';

export class KingdomScene extends Scene {
	private world!: ECSManager;
	private productionSystem!: ProductionSystem;
	private buildSystem!: BuildSystem;
	private shopSystem!: ShopSystem;
	private armySystem!: ArmySystem;
	private combatSystem!: CombatSystem;
	private hexGridSystem!: HexGridSystem;
	private tileSelectionSystem!: TileSelectionSystem;
	private selectionSystem!: SelectionSystem;
	private readonly SELECTED_TILE_UI_TICK_MS = configuration.kingdomView.selectedTileUiTickMs;
	private readonly HEX_SIZE: number = configuration.kingdomView.hexSize;
	private readonly HEX_STROKE: number = configuration.kingdomView.hexStroke;
	private readonly GRID_ORIGIN_Y_OFFSET = configuration.kingdomView.gridOriginYOffset;

	constructor() {
		super('Kingdom');
	}

	preload() {
		this.load.setPath('assets');
		HexGridSystem.preloadHexTexture(this, this.HEX_SIZE, this.HEX_STROKE);

		// Load building icon assets
		for (const def of getAllBuildingDefs()) {
			this.load.image(def.textureId, def.assetPath);
		}
	}

	create() {
		// Shared run state across scenes
		const run = getGameRun(this);
		this.world = run.ecs;
		this.combatSystem = run.combatSystem;

		this.cameras.main.setBackgroundColor(configuration.kingdomView.backgroundColor);

		// Open/close world map (doesn't destroy this scene)
		this.input.keyboard?.on('keydown-M', () => this.toggleWorldMap());

		// Initialize ECS systems
		this.buildSystem = new BuildSystem(this.world);
		this.world.addSystem(this.buildSystem);
		this.productionSystem = new ProductionSystem(this.world);
		this.world.addSystem(this.productionSystem);
		this.tileSelectionSystem = new TileSelectionSystem(this.world, this.productionSystem);
		this.selectionSystem = new SelectionSystem({
			tickIntervalMs: this.SELECTED_TILE_UI_TICK_MS,
			onTick: (q, r) => this.publishTileSelected(q, r)
		});
		this.shopSystem = new ShopSystem(this.world);
		this.world.addSystem(this.shopSystem);
		this.armySystem = new ArmySystem(this.world);
		this.world.addSystem(this.armySystem);
		this.world.addSystem(new RenderSystem(this.world, this));
		this.hexGridSystem = new HexGridSystem(this.world, this, {
			hexSize: this.HEX_SIZE,
			hexStroke: this.HEX_STROKE,
			gridOriginYOffset: this.GRID_ORIGIN_Y_OFFSET,
			onTileSelected: (q, r) => {
				this.selectionSystem.select(q, r);
			}
		});

		// Ensure the shop has offers at game start
		this.shopSystem.rerollFree();

		// Broadcast initial game state snapshots
		this.world.broadcastResources();
		this.world.broadcastBlueprintInventory();
		this.world.broadcastArmyState();
		this.publishShopState();

		// Initialize dynamic visible hexes
		this.hexGridSystem.initDynamicStartingArea();

		// notify UI when clicking off any tile
		this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
			if (currentlyOver.length === 0) {
				this.selectionSystem.clear();
				eventBus.publishGameToUi({ type: 'tile-cleared' });
			}
		});

		// listen for UI build/destroy/upgrade commands
		eventBus.subscribeUiToGame((event) => {
			if (event.type === 'worldmap-toggle') {
				this.toggleWorldMap();
				return;
			}
			if (event.type === 'worldmap-send-army') {
				try {
					run.startTravel(event.targetPointId);
					eventBus.publishGameToUi({ type: 'worldmap-action-result', action: 'send-army', ok: true });
				} catch (e) {
					const reason = e instanceof Error ? e.message : String(e);
					eventBus.publishGameToUi({ type: 'worldmap-action-result', action: 'send-army', ok: false, reason });
				}
				return;
			}
			if (event.type === 'worldmap-start-combat') {
				try {
					run.startPendingEncounterCombat(event.targetPointId);
					eventBus.publishGameToUi({ type: 'worldmap-action-result', action: 'start-combat', ok: true });
				} catch (e) {
					const reason = e instanceof Error ? e.message : String(e);
					eventBus.publishGameToUi({ type: 'worldmap-action-result', action: 'start-combat', ok: false, reason });
				}
				return;
			}

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
			} else if (event.type === 'army-train-requested') {
				this.handleTrain(event.unitEntityId);
			} else if (event.type === 'army-reorder-requested') {
				this.handleArmyReorder(event.unitEntityId, event.direction);
			} else if (event.type === 'combat-step-requested') {
				this.handleCombatStep(event.steps);
				const changed = run.tryResolvePendingEncounter();
				if (changed) eventBus.publishUiToGame({ type: 'worldmap-refresh-requested' });
			}
		});
	}

	private handleArmyReorder(unitEntityId: string, direction: 'up' | 'down') {
		try {
			this.world.reorderArmyUnitWithThrow(unitEntityId, direction);
			this.world.broadcastArmyState();
			eventBus.publishGameToUi({ type: 'army-action-result', action: 'reorder', ok: true, unitEntityId });
		} catch (e: Error | any) {
			const reason = e instanceof Error ? e.message : String(e);
			eventBus.publishGameToUi({ type: 'army-action-result', action: 'reorder', ok: false, reason, unitEntityId });
		}
	}

	private toggleWorldMap(): void {
		const isWorldMapActive = this.scene.isActive('WorldMap');
		if (isWorldMapActive) {
			this.scene.stop('WorldMap');
			this.scene.resume('Kingdom');
			eventBus.publishGameToUi({ type: 'worldmap-visibility-changed', isOpen: false });
			eventBus.publishGameToUi({ type: 'worldmap-poi-cleared' });
			return;
		}

		this.scene.launch('WorldMap');
		this.scene.pause('Kingdom');
		eventBus.publishGameToUi({ type: 'worldmap-visibility-changed', isOpen: true });
	}

	private handleCombatStep(steps?: number): void {
		try {
			this.combatSystem.stepCombat(steps ?? 1);
			eventBus.publishGameToUi({ type: 'combat-action-result', action: 'step', ok: true });
		} catch (e) {
			const reason = e instanceof Error ? e.message : String(e);
			eventBus.publishGameToUi({ type: 'combat-action-result', action: 'step', ok: false, reason });
		}
	}


	override update(time: number, delta: number): void {
		this.world.update(time, delta);
		this.selectionSystem.tick(delta);
	}

	private publishTileSelected(q: number, r: number) {
		const payload = this.tileSelectionSystem.buildPayload(q, r);
		eventBus.publishGameToUi({
			type: 'tile-selected',
			payload
		});
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
			this.hexGridSystem.revealHiddenNeighbors(q, r);
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

	private handleTrain(unitEntityId: string) {
		try {
			this.armySystem.startTrainingWithThrow(unitEntityId);
		} catch (e: Error | any) {
			eventBus.publishGameToUi({ type: 'army-action-result', action: 'train', ok: false, reason: e.message, unitEntityId });
			return;
		}
		eventBus.publishGameToUi({ type: 'army-action-result', action: 'train', ok: true, unitEntityId });
		this.publishResourceUpdates();
	}

	private publishResourceUpdates() {
		for (const [key, value] of this.world.resources) {
			eventBus.publishGameToUi({ type: 'resource-updated', key, value });
		}
	}
}
