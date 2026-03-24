import { kingdomCoordKey } from '../../../../shared/kingdom/kingdomGrid';
import type { GameActionCommand } from '../../../../shared/multiplayer/contracts/commands';
import { getBuildingDef } from '../../config/buildings';
import type { ServerGameState } from '../ServerGameState';
import { ArmyService } from '../services/ArmyService';
import { BuildService } from '../services/BuildService';
import { ProductionService } from '../services/ProductionService';
import { ShopService } from '../services/ShopService';

type ActionResult = { ok: true } | { ok: false; reason: string };

type BuildPhasePlayerRuntime = {
	run: ServerGameState;
	buildService: BuildService;
	armyService: ArmyService;
	productionService: ProductionService;
	shopService: ShopService;
};

type BuildPhaseDeps = {
	revealNeighbors: (runtime: BuildPhasePlayerRuntime, q: number, r: number) => void;
};

export class BuildPhaseRuntime {
	constructor(private readonly deps: BuildPhaseDeps) {}

	advanceTick(runtime: BuildPhasePlayerRuntime): void {
		runtime.buildService.advanceTick();
		runtime.productionService.advanceTick();
		runtime.shopService.advanceTick();
		runtime.armyService.advanceTick();
	}

	handleBuildRequest(
		runtime: BuildPhasePlayerRuntime,
		action: Extract<GameActionCommand, { type: 'build/request' }>,
		phase: 'build' | 'combat' | 'advance' | 'setup'
	): ActionResult {
		if (phase !== 'build') return { ok: false, reason: 'Build actions are disabled outside build phase.' };
		const tileId = kingdomCoordKey(action.q, action.r);
		if (!runtime.run.world.getKingdomTile(tileId)) return { ok: false, reason: 'Unknown tile.' };
		runtime.buildService.startBuild(tileId, action.buildingId);
		return { ok: true };
	}

	handleDestroyRequest(
		runtime: BuildPhasePlayerRuntime,
		action: Extract<GameActionCommand, { type: 'destroy/request' }>,
		phase: 'build' | 'combat' | 'advance' | 'setup'
	): ActionResult {
		if (phase !== 'build') return { ok: false, reason: 'Destroy actions are disabled outside build phase.' };
		const tileId = kingdomCoordKey(action.q, action.r);
		const tile = runtime.run.world.getKingdomTile(tileId);
		if (!tile?.building) return { ok: false, reason: 'No building on that tile.' };
		const buildingDef = getBuildingDef(tile.building.buildingId);
		const wasBlocker = buildingDef?.isBlocker === true;
		runtime.buildService.destroyBuilding(tileId);
		if (wasBlocker) {
			this.deps.revealNeighbors(runtime, action.q, action.r);
		}
		return { ok: true };
	}

	handleUpgradeRequest(
		runtime: BuildPhasePlayerRuntime,
		action: Extract<GameActionCommand, { type: 'upgrade/request' }>,
		phase: 'build' | 'combat' | 'advance' | 'setup'
	): ActionResult {
		if (phase !== 'build') return { ok: false, reason: 'Upgrade actions are disabled outside build phase.' };
		const tileId = kingdomCoordKey(action.q, action.r);
		if (!runtime.run.world.getKingdomTile(tileId)) return { ok: false, reason: 'Unknown tile.' };
		runtime.buildService.startUpgrade(tileId, action.upgradeBuildingId);
		return { ok: true };
	}

	handleShopBuy(
		runtime: BuildPhasePlayerRuntime,
		action: Extract<GameActionCommand, { type: 'shop/buy' }>,
		phase: 'build' | 'combat' | 'advance' | 'setup'
	): ActionResult {
		if (phase !== 'build') return { ok: false, reason: 'Shop is disabled outside build phase.' };
		runtime.shopService.buyWithThrow(action.slotIndex);
		return { ok: true };
	}

	handleShopReroll(runtime: BuildPhasePlayerRuntime, phase: 'build' | 'combat' | 'advance' | 'setup'): ActionResult {
		if (phase !== 'build') return { ok: false, reason: 'Shop is disabled outside build phase.' };
		runtime.shopService.rerollWithThrow();
		return { ok: true };
	}

	handleArmyTrain(
		runtime: BuildPhasePlayerRuntime,
		action: Extract<GameActionCommand, { type: 'army/train' }>,
		phase: 'build' | 'combat' | 'advance' | 'setup'
	): ActionResult {
		if (phase !== 'build') return { ok: false, reason: 'Training is disabled outside build phase.' };
		runtime.armyService.startTrainingWithThrow(action.unitEntityId);
		return { ok: true };
	}

	handleArmyReorder(
		runtime: BuildPhasePlayerRuntime,
		action: Extract<GameActionCommand, { type: 'army/reorder' }>
	): ActionResult {
		runtime.run.world.reorderArmyUnitWithThrow(action.unitEntityId, action.direction);
		return { ok: true };
	}
}
