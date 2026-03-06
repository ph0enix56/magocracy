export type LobbyStatus = 'open' | 'in-game';
export type GamePhase = 'setup' | 'build' | 'combat';

export type LobbyPlayerSnapshot = {
	playerId: string;
	name: string;
	isHost: boolean;
	isReady: boolean;
	connected: boolean;
};

export type LobbySnapshot = {
	lobbyId: string;
	status: LobbyStatus;
	hostPlayerId: string;
	maxPlayers: number;
	players: LobbyPlayerSnapshot[];
	createdAt: number;
};

export type ResourceSnapshot = Record<string, number>;
export type BlueprintInventorySnapshot = Record<string, number>;

export type ArmyUnitSnapshot = {
	entityId: string;
	unitId: string;
	name: string;
	assetPath: string;
	health: number;
	drFlat: number;
	drPercent: number;
	actionsPerTurn: number;
	trainingLevel: number;
	trainingStatus: 'idle' | 'training';
	trainingProgress: number;
};

export type CombatUnitSnapshot = {
	unitId: string;
	name: string;
	assetPath: string;
	health: number;
	maxHealth: number;
};

export type CombatLogEntrySnapshot = {
	seq: number;
	text: string;
};

export type CombatSnapshot = {
	status: 'idle' | 'running' | 'finished';
	winner?: 'armyA' | 'armyB' | 'draw';
	round: number;
	activeSide: 'armyA' | 'armyB';
	armyA: CombatUnitSnapshot[];
	armyB: CombatUnitSnapshot[];
	log: CombatLogEntrySnapshot[];
};

export type PlayerGameView = {
	playerId: string;
	resources: ResourceSnapshot;
	blueprints: BlueprintInventorySnapshot;
	army: ArmyUnitSnapshot[];
	combat: CombatSnapshot;
};

export type GameSnapshot = {
	tick: number;
	phase: GamePhase;
	players: PlayerGameView[];
};

export type GameActionCommand =
	| { type: 'build/request'; q: number; r: number; buildingId: string }
	| { type: 'destroy/request'; q: number; r: number }
	| { type: 'upgrade/request'; q: number; r: number; upgradeBuildingId: string }
	| { type: 'shop/buy'; slotIndex: number }
	| { type: 'shop/reroll' }
	| { type: 'army/train'; unitEntityId: string }
	| { type: 'army/reorder'; unitEntityId: string; direction: 'up' | 'down' }
	| { type: 'combat/step'; steps?: number };

export type ClientCommand =
	| { type: 'lobby/create'; playerName: string }
	| { type: 'lobby/join'; lobbyId: string; playerName: string }
	| { type: 'lobby/leave' }
	| { type: 'lobby/set-ready'; ready: boolean }
	| { type: 'lobby/start' }
	| { type: 'game/action'; action: GameActionCommand };

export type ServerEvent =
	| { type: 'session/connected'; playerId: string }
	| { type: 'lobby/state'; lobby: LobbySnapshot | null }
	| { type: 'game/snapshot'; game: GameSnapshot }
	| { type: 'command/rejected'; commandType: ClientCommand['type'] | GameActionCommand['type']; reason: string }
	| { type: 'system/error'; message: string };

export type ClientToServerEvents = {
	command: (command: ClientCommand) => void;
};

export type ServerToClientEvents = {
	event: (event: ServerEvent) => void;
};
