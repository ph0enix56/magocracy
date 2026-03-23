import type { BuildingDef, EffectApply, EffectStat, EffectTarget } from '../../config/buildingTypes';
import type { KingdomTileState } from '../model';

type ParsedBuildingEffect = {
	target: EffectTarget;
	cond: string;
	stat: EffectStat;
	apply: EffectApply;
	value: number;
};

export type EffectAccumulator = {
	add: number;
	mult: number;
};

type ResolveBuildingDef = (buildingId: string) => BuildingDef | undefined;
type GetNeighbors = (q: number, r: number) => KingdomTileState[];

const VALID_TARGETS: EffectTarget[] = ['self-if', 'self-foreach', 'neighbor'];
const VALID_APPLIES: EffectApply[] = ['add', 'mult'];

export function parseBuildingEffect(raw: string): ParsedBuildingEffect | null {
	const parts = raw.split(';').map((part) => part.trim());
	if (parts.length !== 5) return null;
	const target = parts[0]!;
	const cond = parts[1]!;
	const stat = parts[2]!;
	const apply = parts[3]!;
	const valueRaw = parts[4]!;
	if (!VALID_TARGETS.includes(target as EffectTarget)) return null;
	if (!VALID_APPLIES.includes(apply as EffectApply)) return null;
	if (!isValidStat(stat)) return null;
	const value = Number(valueRaw);
	if (!Number.isFinite(value)) return null;
	return {
		target: target as EffectTarget,
		cond,
		stat: stat as EffectStat,
		apply: apply as EffectApply,
		value
	};
}

export function accumulateEffectsForTargetStat(params: {
	targetTile: KingdomTileState;
	targetBuildingDef: BuildingDef;
	targetStat: EffectStat;
	resolveBuildingDef: ResolveBuildingDef;
	getNeighbors: GetNeighbors;
}): EffectAccumulator {
	const { targetTile, targetBuildingDef, targetStat, resolveBuildingDef, getNeighbors } = params;

	let add = 0;
	let mult = 0;

	const applyEffect = (effect: ParsedBuildingEffect, applications: number): void => {
		if (applications <= 0) return;
		if (!statMatches(effect.stat, targetStat)) return;
		if (effect.apply === 'add') {
			add += Math.floor(effect.value) * applications;
			return;
		}
		mult += effect.value * applications;
	};

	const applySourceEffects = (sourceTile: KingdomTileState, sourceDef: BuildingDef): void => {
		for (const rawEffect of sourceDef.effects ?? []) {
			const effect = parseBuildingEffect(rawEffect);
			if (!effect) continue;

			if (sourceTile.tileId === targetTile.tileId) {
				if (effect.target === 'neighbor') continue;
				const sourceNeighbors = getNeighbors(sourceTile.coord.q, sourceTile.coord.r);
				const passes = sourceNeighbors.filter((tile) => evalCond(effect.cond, tile, resolveBuildingDef)).length;
				const applications = effect.target === 'self-if' ? (passes > 0 ? 1 : 0) : passes;
				applyEffect(effect, applications);
				continue;
			}

			if (effect.target !== 'neighbor') continue;
			const applications = evalCond(effect.cond, targetTile, resolveBuildingDef) ? 1 : 0;
			applyEffect(effect, applications);
		}
	};

	applySourceEffects(targetTile, targetBuildingDef);

	const neighboringTiles = getNeighbors(targetTile.coord.q, targetTile.coord.r);
	for (const sourceTile of neighboringTiles) {
		const sourceBuilding = sourceTile.building;
		if (!sourceBuilding || sourceBuilding.status !== 'active') continue;
		const sourceDef = resolveBuildingDef(sourceBuilding.buildingId);
		if (!sourceDef) continue;
		applySourceEffects(sourceTile, sourceDef);
	}

	return { add, mult };
}

function statMatches(effectStat: EffectStat, targetStat: EffectStat): boolean {
	if (effectStat === targetStat) return true;
	return effectStat === 'prod:all' && targetStat.startsWith('prod:');
}

function isValidStat(stat: string): stat is EffectStat {
	if (
		stat === 'prod:all' ||
		stat === 'army:traincost' ||
		stat === 'unit:hp' ||
		stat === 'unit:drflat' ||
		stat === 'unit:drpercent' ||
		stat === 'unit:ap' ||
		stat === 'unit:initiative' ||
		stat === 'unit:damage'
	) {
		return true;
	}
	return /^prod:[a-z0-9_]+$/i.test(stat);
}

function evalCond(cond: string, tile: KingdomTileState, resolveBuildingDef: ResolveBuildingDef): boolean {
	const operators = [...cond.matchAll(/([&|])/g)].map((entry) => entry[1]);
	const terms = cond
		.split(/\s*[&|]\s*/g)
		.map((term) => term.trim())
		.filter((term) => term.length > 0);

	if (terms.length === 0) return false;
	let result = evalTerm(terms[0]!, tile, resolveBuildingDef);
	for (let i = 1; i < terms.length; i += 1) {
		const op = operators[i - 1];
		const right = evalTerm(terms[i]!, tile, resolveBuildingDef);
		if (op === '&') result = result && right;
		else result = result || right;
	}
	return result;
}

function evalTerm(termRaw: string, tile: KingdomTileState, resolveBuildingDef: ResolveBuildingDef): boolean {
	const term = termRaw.trim().toLowerCase();
	if (term === 'empty') return !tile.building;
	if (!tile.building) return false;

	const def = resolveBuildingDef(tile.building.buildingId);
	if (!def) return false;

	if (term === 'hasprod') return !!def.production;
	if (term === 'hasarmy') return !!def.army;

	if (term.startsWith('school=')) {
		const school = term.slice('school='.length);
		return def.school.toLowerCase() === school;
	}

	if (term.startsWith('tier=')) {
		const tier = Number(term.slice('tier='.length));
		if (!Number.isFinite(tier)) return false;
		return def.tier === tier;
	}

	return false;
}
