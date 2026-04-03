import type { AttackAction, ResourceMap } from '../../../shared/domain/types';

export const BUILDING_SCHOOLS = {
	neutral: 'neutral',
	sylvan: 'sylvan',
	geomancy: 'geomancy',
	pyromancy: 'pyromancy',
	hydromancy: 'hydromancy',
	necromancy: 'necromancy',
	arcane: 'arcane'
} as const;

export type BuildingSchool = keyof typeof BUILDING_SCHOOLS;

export type EffectTarget = 'self-if' | 'self-foreach' | 'neighbor';
export type EffectApply = 'add' | 'mult';
export type EffectStat =
	| 'prod:all'
	| `prod:${string}`
	| 'unit:hp'
	| 'unit:drflat'
	| 'unit:drpercent'
	| 'unit:ap'
	| 'unit:initiative'
	| 'unit:damage';

/** Serialized DSL string: "<target>; <cond>; <stat>; <apply>; <value>" */
// --- Building def ---

export interface BuildingDef {
	/** Unique identifier for this building/upgrade. */
	id: string;
	/** Magic school used for effects and categorization. */
	school: BuildingSchool;
	/** Building tier for progression and effect conditions. */
	tier: number;
	/** If set, this building cannot be obtained directly; it is an upgrade of the parent. */
	parentId?: string;
	/** In-game display name. */
	name: string;
	/** In-game building card description. */
	description: string;
	/** Phaser texture key (can be the same as id). */
	textureId: string;
	/** Path relative to public/assets/ for the building icon. */
	assetPath: string;
	/** Resource cost to build/upgrade. */
	cost: ResourceMap;
	/** Time to build/upgrade in game ticks. */
	buildTime: number;
	/** Resource productions per game tick. Presence means this is a production building. */
	productions?: ResourceMap;
	/** Unit definition this building houses. Presence means this is an army building. */
	housedUnitDefId?: string;
	/** Neighbor interaction effects written in the serialized DSL. */
	effects?: string[];
	/** Resource grants awarded once when construction/upgrade completes. */
	onCompleteGrants?: ResourceMap;
}

// --- Unit defs ---

export interface UnitDef {
	/** Unique identifier for this unit type. */
	id: string;
	/** In-game display name. */
	name: string;
	/** Health points (damage capacity) before being defeated. */
	health: number;
	/** Flat damage reduction applied to each incoming attack. */
	drFlat: number;
	/** Percentual damage reduction applied to each incoming attack. */
	drPercent: number;
	/** Action queue/cycle of this unit. */
	actions: AttackAction[];
	/** Actions taken per turn in combat. */
	actionPoints: number;
	/** Initiative on the world map / combat ordering. */
	initiative: number;
	/** Phaser texture key. */
	textureId: string;
	/** Path relative to public/assets/ for the unit icon. */
	assetPath: string;
}
