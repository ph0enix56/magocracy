import { kingdomCoordKey } from '../../../../shared/kingdom/kingdomGrid';
import type { GameActionCommand } from '../../../../shared/multiplayer/commands';
import type { ServerGameState } from '../ServerGameState';
import { expandKingdomTile } from '../board/kingdomBoard';
import { ArmyService } from '../services/armyService';
import { BuildService } from '../services/BuildService';
import { ProductionService } from '../services/ProductionService';
import { ShopService } from '../services/ShopService';
import type { PhaseActionResult, PhaseTickResult, RuntimePhase, RuntimePhaseContext } from './runtimePhase';

type ActionResult = { ok: true } | { ok: false; reason: string };

type BuildPhasePlayerRuntime = {
	run: ServerGameState;
	buildService: BuildService;
	armyService: ArmyService;
	productionService: ProductionService;
	shopService: ShopService;
};

export class BuildPhaseRuntime implements RuntimePhase {
	readonly key = 'build' as const;
	private durationSecondsRemaining = 0;
	private tickSecondsRemaining = 0;

	constructor() {}

	onEnter(ctx: RuntimePhaseContext): void {
		this.durationSecondsRemaining = ctx.resolveBuildPhaseDurationSeconds();
		this.tickSecondsRemaining = ctx.resolveBuildTickIntervalSeconds();
		for (const playerId of ctx.playerIds) {
			const runtime = ctx.getPlayerRuntime(playerId);
			if (!runtime) continue;
			runtime.shopService.setPhaseLoopIndex(ctx.phaseLoopIndex);
		}
	}

	onExit(_ctx: RuntimePhaseContext): void {}

	tick(ctx: RuntimePhaseContext): PhaseTickResult {
		if (this.durationSecondsRemaining > 0) {
			this.durationSecondsRemaining -= 1;
		}

		if (this.tickSecondsRemaining > 0) {
			this.tickSecondsRemaining -= 1;
		}

		if (this.tickSecondsRemaining <= 0) {
			for (const playerId of ctx.playerIds) {
				const runtime = ctx.getPlayerRuntime(playerId);
				if (!runtime) continue;
				this.advanceTick(runtime);
			}
			this.tickSecondsRemaining = ctx.resolveBuildTickIntervalSeconds();
		}

		if (this.durationSecondsRemaining <= 0) {
			return { kind: 'transition', transition: { nextPhase: 'combat' } };
		}

		return { kind: 'continue' };
	}

	tryHandleAction(ctx: RuntimePhaseContext, playerId: string, action: GameActionCommand): PhaseActionResult {
		const runtime = ctx.getPlayerRuntime(playerId);
		if (!runtime) {
			return { handled: true, ok: false, reason: 'Unknown player game state.' };
		}

		switch (action.type) {
			case 'build/request': {
				const result = this.handleBuildRequest(runtime, action);
				if (!result.ok) return { handled: true, ok: false, reason: result.reason };
				return { handled: true, ok: true, emitSnapshot: true };
			}
			case 'kingdom/expand': {
				const result = this.handleExpandRequest(runtime, action);
				if (!result.ok) return { handled: true, ok: false, reason: result.reason };
				return { handled: true, ok: true, emitSnapshot: true };
			}
			case 'destroy/request': {
				const result = this.handleDestroyRequest(runtime, action);
				if (!result.ok) return { handled: true, ok: false, reason: result.reason };
				return { handled: true, ok: true, emitSnapshot: true };
			}
			case 'upgrade/request': {
				const result = this.handleUpgradeRequest(runtime, action);
				if (!result.ok) return { handled: true, ok: false, reason: result.reason };
				return { handled: true, ok: true, emitSnapshot: true };
			}
			case 'shop/buy': {
				const result = this.handleShopBuy(runtime, action);
				if (!result.ok) return { handled: true, ok: false, reason: result.reason };
				return { handled: true, ok: true, emitSnapshot: true };
			}
			case 'shop/reroll': {
				const result = this.handleShopReroll(runtime);
				if (!result.ok) return { handled: true, ok: false, reason: result.reason };
				return { handled: true, ok: true, emitSnapshot: true };
			}
			default:
				return { handled: false };
		}
	}

	getSecondsRemaining(): number {
		return Math.max(0, this.durationSecondsRemaining);
	}

	private advanceTick(runtime: BuildPhasePlayerRuntime): void {
		runtime.buildService.advanceTick();
		runtime.productionService.advanceTick();
		runtime.shopService.advanceTick();
		runtime.armyService.advanceTick();
	}

	handleBuildRequest(
		runtime: BuildPhasePlayerRuntime,
		action: Extract<GameActionCommand, { type: 'build/request' }>
	): ActionResult {
		const tileId = kingdomCoordKey(action.q, action.r);
		const tile = runtime.run.world.getKingdomTile(tileId);
		if (!tile) return { ok: false, reason: 'Unknown tile.' };
		if (tile.isExpansionSite) return { ok: false, reason: 'Tile must be expanded first.' };
		runtime.buildService.startBuild(tileId, action.buildingId);
		return { ok: true };
	}

	handleExpandRequest(
		runtime: BuildPhasePlayerRuntime,
		action: Extract<GameActionCommand, { type: 'kingdom/expand' }>
	): ActionResult {
		const tileId = kingdomCoordKey(action.q, action.r);
		const tile = runtime.run.world.getKingdomTile(tileId);
		if (!tile) return { ok: false, reason: 'Unknown tile.' };
		if (!tile.isExpansionSite) return { ok: false, reason: 'Tile is not expandable.' };
		const expansion = runtime.run.world.resources.get('expansion') || 0;
		if (expansion < 1) return { ok: false, reason: 'No expansion tokens available.' };
		runtime.run.world.resources.set('expansion', expansion - 1);
		expandKingdomTile(runtime.run.world, action.q, action.r);
		return { ok: true };
	}

	handleDestroyRequest(
		runtime: BuildPhasePlayerRuntime,
		action: Extract<GameActionCommand, { type: 'destroy/request' }>
	): ActionResult {
		const tileId = kingdomCoordKey(action.q, action.r);
		const tile = runtime.run.world.getKingdomTile(tileId);
		if (!tile?.building) return { ok: false, reason: 'No building on that tile.' };
		runtime.buildService.destroyBuilding(tileId);
		return { ok: true };
	}

	handleUpgradeRequest(
		runtime: BuildPhasePlayerRuntime,
		action: Extract<GameActionCommand, { type: 'upgrade/request' }>
	): ActionResult {
		const tileId = kingdomCoordKey(action.q, action.r);
		if (!runtime.run.world.getKingdomTile(tileId)) return { ok: false, reason: 'Unknown tile.' };
		runtime.buildService.startUpgrade(tileId, action.upgradeBuildingId);
		return { ok: true };
	}

	handleShopBuy(
		runtime: BuildPhasePlayerRuntime,
		action: Extract<GameActionCommand, { type: 'shop/buy' }>
	): ActionResult {
		runtime.shopService.buyWithThrow(action.slotIndex);
		return { ok: true };
	}

	handleShopReroll(runtime: BuildPhasePlayerRuntime): ActionResult {
		runtime.shopService.rerollWithThrow();
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
