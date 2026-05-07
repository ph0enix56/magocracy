export type CombatWinner = 'armyA' | 'armyB' | 'draw';

export type CombatStatus = 'idle' | 'running' | 'finished';

export type CombatActiveSide = 'armyA' | 'armyB';

export type CombatUnit = {
	unitDefId: string;
	name: string;
	assetPath: string;
	health: number;
	maxHealth: number;
};

export type CombatLogEntry = {
	seq: number;
	text: string;
};

export type CombatSnapshot = {
	status: CombatStatus;
	winner?: CombatWinner;
	round: number;
	armyA: CombatUnit[];
	armyB: CombatUnit[];
	log: CombatLogEntry[];
};