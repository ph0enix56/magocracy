import type { ArmyUnit } from '../shared/domain/gameViews';
import type { ResourceMap } from '../shared/domain/types';
import { RESOURCE_KEYS } from '../shared/domain/resources';

const RESOURCE_EMOJIS: Record<string, string> = {
	wood: '🪵',
	stone: '🪨',
	food: '🍞',
	mana: '💧',
	expansion: '🧭',
	renown: '🏆'
};

const RESOURCE_ORDER = new Map<string, number>(RESOURCE_KEYS.map((resource, index) => [resource, index]));

type UnitStatsForRange = Pick<ArmyUnit, 'actions'>;

export function resourceEmoji(resource: string): string {
	return RESOURCE_EMOJIS[resource] ?? resource;
}

export function orderedResourceEntries(resources: ResourceMap | undefined): Array<[string, number]> {
	if (!resources) return [];
	return Object.entries(resources)
		.filter(([, amount]) => amount !== 0)
		.sort(([leftKey], [rightKey]) => {
			const leftOrder = RESOURCE_ORDER.get(leftKey) ?? Number.MAX_SAFE_INTEGER;
			const rightOrder = RESOURCE_ORDER.get(rightKey) ?? Number.MAX_SAFE_INTEGER;
			if (leftOrder !== rightOrder) return leftOrder - rightOrder;
			return leftKey.localeCompare(rightKey);
		});
}

export function inferUnitRangeLabel(unit: UnitStatsForRange): 'Melee' | 'Ranged' {
	const maxRange = unit.actions.reduce((currentMax, action) => Math.max(currentMax, action.range), 0);
	return maxRange <= 2 ? 'Melee' : 'Ranged';
}
