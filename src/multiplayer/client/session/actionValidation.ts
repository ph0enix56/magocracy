import type { GameActionCommand } from '../../../shared/multiplayer/contracts/commands';
import type { CommandResult } from './types';

/**
 * Performs client-side sanity checks for malformed input.
 * This module intentionally does not validate authoritative game rules.
 */
export function validateActionSanity(action: GameActionCommand): CommandResult | null {
	switch (action.type) {
		case 'build/request':
			if (!isInteger(action.q) || !isInteger(action.r)) {
				return { ok: false, reason: 'Build coordinates must be integers.' };
			}
			if (!isNonEmptyId(action.buildingId)) {
				return { ok: false, reason: 'Building ID is required.' };
			}
			return null;
		case 'kingdom/expand':
			if (!isInteger(action.q) || !isInteger(action.r)) {
				return { ok: false, reason: 'Expansion coordinates must be integers.' };
			}
			return null;
		case 'destroy/request':
			if (!isInteger(action.q) || !isInteger(action.r)) {
				return { ok: false, reason: 'Destroy coordinates must be integers.' };
			}
			return null;
		case 'upgrade/request':
			if (!isInteger(action.q) || !isInteger(action.r)) {
				return { ok: false, reason: 'Upgrade coordinates must be integers.' };
			}
			if (!isNonEmptyId(action.upgradeBuildingId)) {
				return { ok: false, reason: 'Upgrade building ID is required.' };
			}
			return null;
		case 'shop/buy':
			if (!isInteger(action.slotIndex) || action.slotIndex < 0) {
				return { ok: false, reason: 'Shop slot index must be a non-negative integer.' };
			}
			return null;
		case 'shop/reroll':
			return null;
		case 'army/train':
			if (!isNonEmptyId(action.unitEntityId)) {
				return { ok: false, reason: 'Unit entity ID is required.' };
			}
			return null;
		case 'army/reorder':
			if (!isNonEmptyId(action.unitEntityId)) {
				return { ok: false, reason: 'Unit entity ID is required.' };
			}
			if (action.direction !== 'up' && action.direction !== 'down') {
				return { ok: false, reason: 'Army reorder direction is invalid.' };
			}
			return null;
		case 'combat/step': {
			const steps = action.steps ?? 1;
			if (!isInteger(steps) || steps <= 0) {
				return { ok: false, reason: 'Combat step count must be a positive integer.' };
			}
			return null;
		}
		case 'fight/replay-open':
			if (!isNonEmptyId(action.matchId)) {
				return { ok: false, reason: 'Fight replay match ID is required.' };
			}
			return null;
		case 'advance/select-charter':
			if (!isNonEmptyId(action.charterId)) {
				return { ok: false, reason: 'Charter ID is required.' };
			}
			return null;
	}
}

function isInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

function isNonEmptyId(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}
