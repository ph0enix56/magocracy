import type { BuildingKind } from '../../../../shared/domain/types';

export type CharterResourceGrant = {
	resource: string;
	amount: number;
};

export type CharterBlueprintGrant = {
	buildingId: string;
	count: number;
	tier: number;
	type: BuildingKind;
	magicSchool?: string;
};

export type CharterDraftOption = {
	charterId: string;
	title: string;
	level: number;
	resources: CharterResourceGrant[];
	blueprints: CharterBlueprintGrant[];
	selectedByPlayerId?: string;
};
