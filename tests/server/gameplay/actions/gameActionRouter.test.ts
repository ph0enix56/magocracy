import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameActionCommand } from '../../../../src/shared/multiplayer/commands';
import { routeGameAction } from '../../../../src/multiplayer/server/gameplay/actions/gameActionRouter';

type Invocation = { handler: string; actionType: GameActionCommand['type'] };

function createHandlers(invocations: Invocation[], okByType: Partial<Record<GameActionCommand['type'], boolean>>) {
	const resolve = (actionType: GameActionCommand['type']) => {
		invocations.push({ handler: actionType, actionType });
		return okByType[actionType] === false ? { ok: false as const, reason: `${actionType} failed` } : { ok: true as const };
	};

	return {
		onBuildRequest: (action: Extract<GameActionCommand, { type: 'build/request' }>) => resolve(action.type),
		onKingdomExpand: (action: Extract<GameActionCommand, { type: 'kingdom/expand' }>) => resolve(action.type),
		onDestroyRequest: (action: Extract<GameActionCommand, { type: 'destroy/request' }>) => resolve(action.type),
		onUpgradeRequest: (action: Extract<GameActionCommand, { type: 'upgrade/request' }>) => resolve(action.type),
		onShopBuy: (action: Extract<GameActionCommand, { type: 'shop/buy' }>) => resolve(action.type),
		onShopReroll: (action: Extract<GameActionCommand, { type: 'shop/reroll' }>) => resolve(action.type),
		onArmyReorder: (action: Extract<GameActionCommand, { type: 'army/reorder' }>) => resolve(action.type),
		onCombatStep: (action: Extract<GameActionCommand, { type: 'combat/step' }>) => resolve(action.type),
		onFightReplayOpen: (action: Extract<GameActionCommand, { type: 'fight/replay-open' }>) => resolve(action.type),
		onAdvanceSelectCharter: (action: Extract<GameActionCommand, { type: 'advance/select-charter' }>) => resolve(action.type)
	};
}

test('routes each action type to matching handler', () => {
	const invocations: Invocation[] = [];
	const handlers = createHandlers(invocations, {});

	const commands: GameActionCommand[] = [
		{ type: 'build/request', q: 1, r: 2, buildingId: 'farm' },
		{ type: 'kingdom/expand', q: 1, r: 2 },
		{ type: 'destroy/request', q: 1, r: 2 },
		{ type: 'upgrade/request', q: 1, r: 2, upgradeBuildingId: 'farm_2' },
		{ type: 'shop/buy', slotIndex: 0 },
		{ type: 'shop/reroll' },
		{ type: 'army/reorder', unitEntityId: 'unit-1', direction: 'up' },
		{ type: 'combat/step', steps: 1 },
		{ type: 'fight/replay-open', matchId: 'fight-1' },
		{ type: 'advance/select-charter', charterId: 'c-1' }
	];

	for (const command of commands) {
		const result = routeGameAction(command, handlers);
		assert.equal(result.ok, true);
		assert.equal(result.emitSnapshot, true);
	}

	assert.deepEqual(
		invocations.map((entry) => entry.handler),
		commands.map((command) => command.type)
	);
});

test('propagates failed handler result and disables emitSnapshot', () => {
	const invocations: Invocation[] = [];
	const handlers = createHandlers(invocations, { 'shop/reroll': false });

	const result = routeGameAction({ type: 'shop/reroll' }, handlers);
	assert.equal(result.ok, false);
	assert.equal(result.emitSnapshot, false);
	if (!result.ok) {
		assert.equal(result.reason, 'shop/reroll failed');
	}
});
