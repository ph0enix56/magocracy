export type LobbyStatus = 'open' | 'in-game';
export type GamePhase = 'setup' | 'build' | 'combat' | 'advance';

export type CharterResourceGrantSnapshot = {
	resource: string;
	amount: number;
};

export type CharterBlueprintGrantSnapshot = {
	buildingId: string;
	count: number;
	tier: number;
	type: 'production' | 'blocking' | 'army';
	magicSchool?: string;
};

export type CharterSnapshot = {
	charterId: string;
	title: string;
	level: number;
	resources: CharterResourceGrantSnapshot[];
	blueprints: CharterBlueprintGrantSnapshot[];
	selectedByPlayerId?: string;
};

export type AdvanceSnapshot = {
	isActive: boolean;
	level: number;
	pickOrderPlayerIds: string[];
	currentPickerPlayerId?: string;
	secondsPerPick: number;
	secondsRemaining: number;
	revealDelaySeconds: number;
	secondsToPhaseEnd: number;
	charters: CharterSnapshot[];
};

export type FightRoundStatus = 'pending' | 'won' | 'lost' | 'draw' | 'bye';

export type FightPairingSnapshot = {
	matchId: string;
	roundIndex: number;
	playerAId: string;
	playerBId?: string;
};

export type FightRoundResultSnapshot = {
	matchId: string;
	roundIndex: number;
	playerAId: string;
	playerBId?: string;
	winnerPlayerId?: string;
	status: 'pending' | 'finished';
};

export type FightArmyUnitSummarySnapshot = {
	unitId: string;
	name: string;
	trainingLevel: number;
};

export type FightPlayerRoundSnapshot = {
	matchId: string;
	roundIndex: number;
	opponentPlayerId?: string;
	status: FightRoundStatus;
	replayAvailable: boolean;
	selfArmy: FightArmyUnitSummarySnapshot[];
	opponentArmy: FightArmyUnitSummarySnapshot[];
};

export type FightSnapshot = {
	isActive: boolean;
	encountersPerPhase: number;
	secondsPerRound: number;
	currentRoundIndex: number;
	secondsToNextRound: number;
	pairings: FightPairingSnapshot[];
	results: FightRoundResultSnapshot[];
	playerRounds: FightPlayerRoundSnapshot[];
};

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

export type BuildingCatalogEntry = {
	id: string;
	parentId?: string;
	type: 'production' | 'blocking' | 'army';
	name: string;
	description: string;
	textureId: string;
	assetPath: string;
	cost: Record<string, number>;
	buildTime: number;
};

export type BuildingCatalogSnapshot = {
	buildings: BuildingCatalogEntry[];
};

export type ShopSnapshot = {
	offers: Array<string | null>;
	buyCost: number;
	rerollCost: number;
};

export type KingdomBuildingSnapshot = {
	buildingId: string;
	status: 'constructing' | 'active' | 'upgrading';
	progress: number;
	upgradeNextId?: string;
	productionMultiplier?: number;
};

export type KingdomTileSnapshot = {
	q: number;
	r: number;
	building?: KingdomBuildingSnapshot;
};

export type KingdomSnapshot = {
	tiles: KingdomTileSnapshot[];
};

export type ArmyUnitSnapshot = {
	entityId: string;
	unitId: string;
	name: string;
	assetPath: string;
	speed: number;
	health: number;
	drFlat: number;
	drPercent: number;
	actionsPerTurn: number;
	trainingLevel: number;
	trainingStatus: 'idle' | 'training';
	trainingProgress: number;
	nextTrainCost: Record<string, number>;
	trainTime: number;
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
	shop: ShopSnapshot;
	kingdom: KingdomSnapshot;
	army: ArmyUnitSnapshot[];
	combat: CombatSnapshot;
	fight: FightSnapshot;
	advance: AdvanceSnapshot;
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
	| { type: 'combat/step'; steps?: number }
	| { type: 'fight/replay-open'; matchId: string }
	| { type: 'advance/select-charter'; charterId: string };

export type ClientCommand =
	| { type: 'lobby/create'; playerName: string }
	| { type: 'lobby/join'; lobbyId: string; playerName: string }
	| { type: 'lobby/leave' }
	| { type: 'lobby/set-ready'; ready: boolean }
	| { type: 'lobby/start' }
	| { type: 'lobby/start-fight' }
	| { type: 'lobby/start-advance' }
	| { type: 'lobby/solo'; playerName: string }
	| { type: 'game/action'; requestId: string; action: GameActionCommand };

export type ServerEvent =
	| { type: 'session/connected'; playerId: string }
	| { type: 'catalog/snapshot'; catalog: BuildingCatalogSnapshot }
	| { type: 'lobby/state'; lobby: LobbySnapshot | null }
	| { type: 'game/snapshot'; game: GameSnapshot }
	| {
		type: 'command/accepted';
		commandType: ClientCommand['type'] | GameActionCommand['type'];
		actionType?: GameActionCommand['type'];
		requestId?: string;
	}
	| {
		type: 'command/rejected';
		commandType: ClientCommand['type'] | GameActionCommand['type'];
		actionType?: GameActionCommand['type'];
		requestId?: string;
		reason: string;
	}
	| { type: 'system/error'; message: string };

export type ClientToServerEvents = {
	command: (command: ClientCommand) => void;
};

export type ServerToClientEvents = {
	event: (event: ServerEvent) => void;
};
