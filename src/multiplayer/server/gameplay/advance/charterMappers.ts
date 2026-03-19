import type {
	CharterBlueprintGrantSnapshot,
	CharterResourceGrantSnapshot,
	CharterSnapshot
} from '../../../../shared/multiplayer/protocol';
import type { CharterBlueprintGrant, CharterDraftOption, CharterResourceGrant } from './charterModel';

function toResourceSnapshot(resource: CharterResourceGrant): CharterResourceGrantSnapshot {
	return {
		resource: resource.resource,
		amount: resource.amount
	};
}

function toBlueprintSnapshot(blueprint: CharterBlueprintGrant): CharterBlueprintGrantSnapshot {
	return {
		buildingId: blueprint.buildingId,
		count: blueprint.count,
		tier: blueprint.tier,
		type: blueprint.type,
		magicSchool: blueprint.magicSchool
	};
}

export function toCharterSnapshot(option: CharterDraftOption): CharterSnapshot {
	return {
		charterId: option.charterId,
		title: option.title,
		level: option.level,
		resources: option.resources.map(toResourceSnapshot),
		blueprints: option.blueprints.map(toBlueprintSnapshot),
		selectedByPlayerId: option.selectedByPlayerId
	};
}
