export type CombatWinner = 'armyA' | 'armyB' | 'draw';

export type CombatStatus = 'idle' | 'running' | 'finished';

export type CombatActiveSide = 'armyA' | 'armyB';

export type CombatUnitView = {
	unitId: string;
	name: string;
	assetPath: string;
	health: number;
	maxHealth: number;
};

export type CombatLogEntryView = {
	seq: number;
	text: string;
};

export type CombatSnapshotView = {
	status: CombatStatus;
	winner?: CombatWinner;
	round: number;
	activeSide: CombatActiveSide;
	armyA: CombatUnitView[];
	armyB: CombatUnitView[];
	log: CombatLogEntryView[];
};