import type { CharterTemplateDef } from '../../config/charters';
import type { BuildingDef } from '../../config/buildings';
import type { CharterBlueprintGrant, CharterOption as CharterDraftOption } from '../../../shared/domain/charter';

export function resolveAdvanceLevel(advancePhaseIndex: number, levels: readonly number[]): number {
	const level = levels[Math.min(advancePhaseIndex, levels.length - 1)] ?? levels[levels.length - 1] ?? 1;
	return Math.max(1, Math.floor(level));
}

export function pickCharterTemplatesForDraft(
	templates: CharterTemplateDef[],
	level: number,
	count: number
): CharterTemplateDef[] {
	let candidates = templates.filter((entry) => entry.level === level);
	if (candidates.length === 0) {
		candidates = templates.filter((entry) => entry.level <= level);
	}
	if (candidates.length === 0) candidates = [...templates];

	const byFocus = new Map<string, CharterTemplateDef[]>();
	for (const candidate of candidates) {
		const focus = getCharterFocus(candidate);
		const list = byFocus.get(focus) ?? [];
		list.push(candidate);
		byFocus.set(focus, list);
	}

	for (const [focus, list] of byFocus.entries()) {
		byFocus.set(focus, shuffleWithMathRandom(list));
	}

	const focusOrder = shuffleWithMathRandom([...byFocus.keys()]);
	const selected: CharterTemplateDef[] = [];
	let cursor = 0;

	while (selected.length < count) {
		const focus = focusOrder[cursor % Math.max(1, focusOrder.length)] ?? 'resources';
		cursor += 1;
		const list = byFocus.get(focus);
		if (!list || list.length === 0) {
			if ([...byFocus.values()].every((group) => group.length === 0)) {
				const fallback = shuffleWithMathRandom(candidates);
				selected.push(fallback[selected.length % Math.max(1, fallback.length)]!);
			}
			continue;
		}
		selected.push(list.shift()!);
	}

	return selected;
}

export function materializeCharter(
	template: CharterTemplateDef,
	serial: number,
	allBuildings: BuildingDef[]
): CharterDraftOption {
	const resources = template.resources
		.map((resourceDef) => ({
			resource: resourceDef.resource,
			amount: randomIntInRange(resourceDef.min, resourceDef.max)
		}))
		.filter((entry) => entry.amount > 0);

	const blueprints = generateBlueprintRewards(template, allBuildings);
	return {
		charterId: `${template.id}-${serial}`,
		title: template.title,
		level: template.level,
		resources,
		blueprints
	};
}

function generateBlueprintRewards(template: CharterTemplateDef, allBuildings: BuildingDef[]): CharterBlueprintGrant[] {
	const blueprintRules = template.blueprints ?? [];
	if (blueprintRules.length === 0) return [];

	const tierByBuildingId = buildTierByBuildingId(allBuildings);
	const aggregated = new Map<string, CharterBlueprintGrant>();

	for (const rule of blueprintRules) {
		const count = randomIntInRange(rule.countMin, rule.countMax);
		for (let i = 0; i < count; i += 1) {
			const picked = pickBlueprintBuildingForRule(allBuildings, tierByBuildingId, rule);
			if (!picked) continue;
			const existing = aggregated.get(picked.id);
			if (existing) {
				existing.count += 1;
				continue;
			}
			aggregated.set(picked.id, {
				buildingId: picked.id,
				count: 1,
				tier: tierByBuildingId.get(picked.id) ?? 1,
				type: picked.housedUnitDefId ? 'army' : 'production',
				magicSchool: rule.magicSchool
			});
		}
	}

	return [...aggregated.values()];
}

function pickBlueprintBuildingForRule(
	allBuildings: BuildingDef[],
	tierByBuildingId: Map<string, number>,
	rule: NonNullable<CharterTemplateDef['blueprints']>[number]
): BuildingDef | null {
	const filterByRule = (building: BuildingDef, strictTier: boolean): boolean => {
		if (building.parentId) return false;
		if (rule.buildingType === 'production' && !building.productions) return false;
		if (rule.buildingType === 'army' && !building.housedUnitDefId) return false;
		if (strictTier && (tierByBuildingId.get(building.id) ?? 1) !== Math.max(1, Math.floor(rule.tier))) return false;
		return true;
	};

	let candidates = allBuildings.filter((building) => filterByRule(building, true));
	if (candidates.length === 0) candidates = allBuildings.filter((building) => filterByRule(building, false));
	if (candidates.length === 0) candidates = allBuildings;
	if (candidates.length === 0) return null;
	return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

function getCharterFocus(template: CharterTemplateDef): 'resources' | 'blueprints' | 'expansion' {
	if ((template.blueprints?.length ?? 0) > 0) return 'blueprints';
	if (template.resources.some((resourceDef) => resourceDef.resource === 'expansion')) return 'expansion';
	return 'resources';
}

function randomIntInRange(min: number, max: number): number {
	const floorMin = Math.floor(Math.min(min, max));
	const floorMax = Math.floor(Math.max(min, max));
	if (floorMin === floorMax) return floorMin;
	return floorMin + Math.floor(Math.random() * (floorMax - floorMin + 1));
}

function shuffleWithMathRandom<T>(items: T[]): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = out[i];
		out[i] = out[j]!;
		out[j] = tmp!;
	}
	return out;
}

function buildTierByBuildingId(buildings: BuildingDef[]): Map<string, number> {
	return new Map(buildings.map((building) => [building.id, building.tier]));
}
