import type { ServerEcsWorld } from '../gameplay/ServerEcsWorld';
import type { Entity } from '../gameplay/model';

export type BuildingCompleteContext = {
	world: ServerEcsWorld;
	entity: Entity;
	buildingId: string;
	previousStatus: 'constructing' | 'upgrading';
};

// --- Building components (attach to BuildingDef as optional fields) ---

/** Attached to buildings that produce resources over time. */
export interface ProductionComponent {
	/** Resource productions per game tick. */
	productions: Record<string, number>;
	/** Returns an additive bonus to self production multiplier, evaluated against neighbors. */
	getSelfProdModifier?: (self: Entity, neighbors: Entity[]) => number;
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

/** Attached to buildings that grant passive bonuses to neighboring buildings. */
export interface BuffComponent {
	/** Additive bonus to a neighboring building's production multiplier (e.g. 0.1 for +10%). */
	getOutgoingProdModifier?: (self: Entity, target: Entity) => number;
}

// --- Building def ---

export interface BuildingDef {
	/** Unique identifier for this building/upgrade. */
	id: string;
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
	/** Attached buff component. */
	buff?: BuffComponent;
	/** Optional hook executed when this building finishes construction or upgrade. */
	onComplete?: (ctx: BuildingCompleteContext) => void;
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
