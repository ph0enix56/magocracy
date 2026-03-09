import type { UiToGameEvents } from '../../eventBus';

export type PendingUiAction =
	| { kind: 'build'; q: number; r: number; buildingId: string }
	| { kind: 'destroy'; q: number; r: number }
	| { kind: 'upgrade'; q: number; r: number; buildingId: string }
	| { kind: 'shop-buy'; slotIndex: number }
	| { kind: 'shop-reroll' }
	| { kind: 'army-train'; unitEntityId: string }
	| { kind: 'army-reorder'; unitEntityId: string }
	| { kind: 'combat-step' };

export type CombatProjectionStatus = 'idle' | 'running' | 'finished';

export function toPendingAction(event: UiToGameEvents): PendingUiAction | null {
	switch (event.type) {
		case 'build-requested':
			return { kind: 'build', q: event.q, r: event.r, buildingId: event.buildingId };
		case 'destroy-requested':
			return { kind: 'destroy', q: event.q, r: event.r };
		case 'upgrade-requested':
			return { kind: 'upgrade', q: event.q, r: event.r, buildingId: event.upgradeBuildingId };
		case 'shop-buy-requested':
			return { kind: 'shop-buy', slotIndex: event.slotIndex };
		case 'shop-reroll-requested':
			return { kind: 'shop-reroll' };
		case 'army-train-requested':
			return { kind: 'army-train', unitEntityId: event.unitEntityId };
		case 'army-reorder-requested':
			return { kind: 'army-reorder', unitEntityId: event.unitEntityId };
		case 'combat-step-requested':
			return { kind: 'combat-step' };
		default:
			return null;
	}
}