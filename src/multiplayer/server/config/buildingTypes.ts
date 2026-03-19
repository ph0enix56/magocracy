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
	| 'army:traincost'
	| 'unit:hp'
	| 'unit:drflat'
	| 'unit:drpercent'
	| 'unit:ap'
	| 'unit:initiative'
	| 'unit:damage';

/** Serialized DSL string: "<target>; <cond>; <stat>; <apply>; <value>" */
export type BuildingEffectDef = string;

// --- Building components (attach to BuildingDef as optional fields) ---

/** Attached to buildings that produce resources over time. */
export interface ProductionComponent {
	/** Resource productions per game tick. */
	productions: Record<string, number>;
}

/** Attached to buildings that train and manage an army unit type. */
export interface ArmyComponent {
	/** The unit type this building trains, referenced by id. */
	unitId: string;
	trainCostBase: Record<string, number>;
	trainCostMult: number;
	trainTime: number;
	trainDef: UnitTrainDef;
}

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
	/** Resource cost to build/upgrade. For blockers this is the removal cost instead. */
	cost: Record<string, number>;
	/** Time to build/upgrade in game ticks. For blockers this is removal time instead. */
	buildTime: number;
	/** If true, this is a pre-placed obstacle — not purchasable, removed by paying expansion. */
	isBlocker?: true;
	/** Attached production component. */
	production?: ProductionComponent;
	/** Attached army component. */
	army?: ArmyComponent;
	/** Neighbor interaction effects written in the serialized DSL. */
	effects?: BuildingEffectDef[];
	/** Resource grants awarded once when construction/upgrade completes. */
	onCompleteGrants?: Record<string, number>;
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
	actions: UnitAttackDef[];
	/** Actions taken per turn in combat. */
	actionsPerTurn: number;
	/** Travel speed on the world map. */
	speed: number;
	/** Phaser texture key. */
	textureId: string;
	/** Path relative to public/assets/ for the unit icon. */
	assetPath: string;
}

export interface UnitTrainDef {
	health: number;
	attackDamage: number;
	drFlat: number;
}

export interface UnitAttackDef {
	/** Attack damage dealt to target(s). */
	damage: number;
	/** Whether this attack's damage can be upgraded. */
	canUpgrade: boolean;
	/** How many units across can be targeted by this attack. */
	range: number;
	/** Targeting logic among possible targets. */
	targeting: 'first' | 'last' | 'weak' | 'all';
	/** Action point cost to perform this attack. */
	actionPointCost: number;
}
