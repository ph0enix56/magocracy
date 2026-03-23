import type { BuildingKind } from './types';
import type { ResourceKey } from './resources';

export type CharterResourceGrant = {
	resource: ResourceKey;
	amount: number;
};

export type CharterBlueprintGrant = {
	buildingId: string;
	count: number;
	tier: number;
	type: BuildingKind;
	magicSchool?: string;
};

/** Canonical charter model shared by runtime draft state and transport snapshots. */
export type CharterOption = {
	charterId: string;
	title: string;
	level: number;
	resources: CharterResourceGrant[];
	blueprints: CharterBlueprintGrant[];
	selectedByPlayerId?: string;
};
