import { BUILDING_DEFS as CORE_DEFS } from './core';
import { BUILDING_DEFS as ARMY_DEFS } from './army';
import type { BuildingDef } from '../buildingTypes';

/** All non-blocker building defs. Add new def modules here. */
export const ALL_BUILDING_DEFS: BuildingDef[] = [
	...CORE_DEFS,
	...ARMY_DEFS,
];

export { UNIT_DEFS } from './units';
