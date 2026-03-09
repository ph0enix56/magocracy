import { eventBus } from '../../eventBus';
import type { ServerEvent } from '../../shared/multiplayer/protocol';
import type { PendingUiAction } from './projectionBridgeTypes';

export function flushPendingSuccess(pending: PendingUiAction[]): void {
	while (pending.length > 0) {
		const current = pending.shift();
		if (!current) continue;

		switch (current.kind) {
			case 'build':
				eventBus.publishGameToUi({
					type: 'build-result',
					q: current.q,
					r: current.r,
					buildingId: current.buildingId,
					ok: true
				});
				break;
			case 'destroy':
				break;
			case 'upgrade':
				eventBus.publishGameToUi({
					type: 'build-result',
					q: current.q,
					r: current.r,
					buildingId: current.buildingId,
					ok: true
				});
				break;
			case 'shop-buy':
				eventBus.publishGameToUi({ type: 'shop-action-result', action: 'buy', ok: true, slotIndex: current.slotIndex });
				break;
			case 'shop-reroll':
				eventBus.publishGameToUi({ type: 'shop-action-result', action: 'reroll', ok: true });
				break;
			case 'army-train':
				eventBus.publishGameToUi({ type: 'army-action-result', action: 'train', ok: true, unitEntityId: current.unitEntityId });
				break;
			case 'army-reorder':
				eventBus.publishGameToUi({ type: 'army-action-result', action: 'reorder', ok: true, unitEntityId: current.unitEntityId });
				break;
			case 'combat-step':
				eventBus.publishGameToUi({ type: 'combat-action-result', action: 'step', ok: true });
				break;
		}
	}
}

export function publishRejectedAction(
	event: Extract<ServerEvent, { type: 'command/rejected' }>,
	current: PendingUiAction | undefined
): void {
	const reason = event.reason;

	switch (event.actionType ?? event.commandType) {
		case 'build/request':
			eventBus.publishGameToUi({
				type: 'build-result',
				q: current?.kind === 'build' ? current.q : 0,
				r: current?.kind === 'build' ? current.r : 0,
				buildingId: current?.kind === 'build' ? current.buildingId : '',
				ok: false,
				reason
			});
			return;
		case 'destroy/request':
			window.alert(reason);
			return;
		case 'upgrade/request':
			eventBus.publishGameToUi({
				type: 'build-result',
				q: current?.kind === 'upgrade' ? current.q : 0,
				r: current?.kind === 'upgrade' ? current.r : 0,
				buildingId: current?.kind === 'upgrade' ? current.buildingId : '',
				ok: false,
				reason
			});
			return;
		case 'shop/buy':
			eventBus.publishGameToUi({
				type: 'shop-action-result',
				action: 'buy',
				ok: false,
				reason,
				slotIndex: current?.kind === 'shop-buy' ? current.slotIndex : undefined
			});
			return;
		case 'shop/reroll':
			eventBus.publishGameToUi({ type: 'shop-action-result', action: 'reroll', ok: false, reason });
			return;
		case 'army/train':
			eventBus.publishGameToUi({
				type: 'army-action-result',
				action: 'train',
				ok: false,
				reason,
				unitEntityId: current?.kind === 'army-train' ? current.unitEntityId : undefined
			});
			return;
		case 'army/reorder':
			eventBus.publishGameToUi({
				type: 'army-action-result',
				action: 'reorder',
				ok: false,
				reason,
				unitEntityId: current?.kind === 'army-reorder' ? current.unitEntityId : undefined
			});
			return;
		case 'combat/step':
			eventBus.publishGameToUi({ type: 'combat-action-result', action: 'step', ok: false, reason });
			return;
	}
}