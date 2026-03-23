export const RESOURCE_KEYS = [
	'wood',
	'stone',
	'gold',
	'food',
	'mana',
	'expansion',
	'renown'
] as const;

export type ResourceKey = typeof RESOURCE_KEYS[number];

export function isResourceKey(value: string): value is ResourceKey {
	return (RESOURCE_KEYS as readonly string[]).includes(value);
}

/**
 * Strict map for known canonical resources.
 * Keep optional keys to support partial payloads.
 */
export type KnownResourceMap = Partial<Record<ResourceKey, number>>;
