import type { GameActionCommand } from '../../../shared/multiplayer/commands';
import type { ActionResult } from '../phases/runtimePhase';


export type RoutedActionResult = ActionResult & { emitSnapshot: boolean };
type HandlerMap = {
	onBuildRequest: (action: Extract<GameActionCommand, { type: 'build/request' }>) => ActionResult;
	onKingdomExpand: (action: Extract<GameActionCommand, { type: 'kingdom/expand' }>) => ActionResult;
	onDestroyRequest: (action: Extract<GameActionCommand, { type: 'destroy/request' }>) => ActionResult;
	onUpgradeRequest: (action: Extract<GameActionCommand, { type: 'upgrade/request' }>) => ActionResult;
	onShopBuy: (action: Extract<GameActionCommand, { type: 'shop/buy' }>) => ActionResult;
	onShopReroll: (action: Extract<GameActionCommand, { type: 'shop/reroll' }>) => ActionResult;
	onArmyReorder: (action: Extract<GameActionCommand, { type: 'army/reorder' }>) => ActionResult;
	onCombatStep: (action: Extract<GameActionCommand, { type: 'combat/step' }>) => ActionResult;
	onFightReplayOpen: (action: Extract<GameActionCommand, { type: 'fight/replay-open' }>) => ActionResult;
	onAdvanceSelectCharter: (action: Extract<GameActionCommand, { type: 'advance/select-charter' }>) => ActionResult;
};

export function routeGameAction(command: GameActionCommand, handlers: HandlerMap): RoutedActionResult {
	switch (command.type) {
		case 'build/request': {
			const result = handlers.onBuildRequest(command);
			return { ...result, emitSnapshot: result.ok };
		}
		case 'kingdom/expand': {
			const result = handlers.onKingdomExpand(command);
			return { ...result, emitSnapshot: result.ok };
		}
		case 'destroy/request': {
			const result = handlers.onDestroyRequest(command);
			return { ...result, emitSnapshot: result.ok };
		}
		case 'upgrade/request': {
			const result = handlers.onUpgradeRequest(command);
			return { ...result, emitSnapshot: result.ok };
		}
		case 'shop/buy': {
			const result = handlers.onShopBuy(command);
			return { ...result, emitSnapshot: result.ok };
		}
		case 'shop/reroll': {
			const result = handlers.onShopReroll(command);
			return { ...result, emitSnapshot: result.ok };
		}
		case 'army/reorder': {
			const result = handlers.onArmyReorder(command);
			return { ...result, emitSnapshot: result.ok };
		}
		case 'combat/step': {
			const result = handlers.onCombatStep(command);
			return { ...result, emitSnapshot: result.ok };
		}
		case 'fight/replay-open': {
			const result = handlers.onFightReplayOpen(command);
			return { ...result, emitSnapshot: result.ok };
		}
		case 'advance/select-charter': {
			const result = handlers.onAdvanceSelectCharter(command);
			return { ...result, emitSnapshot: result.ok };
		}
	}
}
