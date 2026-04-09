import type { AttackAction, BuildingStatus, ResourceMap, UnitRole } from '../domain/types';
import type { CharterOption } from '../domain/charter';
import type { ArmyUnit, FightArmyUnitSummary } from '../domain/gameViews';
import type { CombatSnapshot } from '../domain/combatTypes';
import type { KingdomCoord } from '../kingdom/kingdomGrid';

export type LobbyStatus = 'open' | 'in-game';
export type GamePhase = 'setup' | 'build' | 'combat' | 'advance';
export type GameStatus = 'running' | 'finished';

export type GameStandingSnapshot = {
	playerId: string;
	renown: number;
	rank: number;
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
	charters: CharterOption[];
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

export type FightPlayerRoundSnapshot = {
	matchId: string;
	roundIndex: number;
	opponentPlayerId?: string;
	status: FightRoundStatus;
	replayAvailable: boolean;
	selfArmy: FightArmyUnitSummary[];
	opponentArmy: FightArmyUnitSummary[];
};

export type FightSnapshot = {
	isActive: boolean;
	totalRounds: number;
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

export type BuildingCatalogEntry = {
	id: string;
	kind: 'production' | 'army';
	school: string;
	tier: number;
	parentId?: string;
	name: string;
	description: string;
	assetPath: string;
	cost: ResourceMap;
	buildTime: number;
	productions?: ResourceMap;
	housedUnit?: UnitCatalogEntry;
};

export type UnitCatalogEntry = {
	id: string;
	name: string;
	role: UnitRole;
	assetPath: string;
	health: number;
	drFlat: number;
	drPercent: number;
	initiative: number;
	actionPoints: number;
	actions: AttackAction[];
};

export type BuildingCatalogSnapshot = {
	buildings: BuildingCatalogEntry[];
};

export type ShopOfferSnapshot = {
	buildingId: string;
	tier: number;
	buyCost: number;
};

export type ShopSnapshot = {
	offers: Array<ShopOfferSnapshot | null>;
	rerollCost: number;
};

export type KingdomBuildingSnapshot = {
	buildingId: string;
	school?: string;
	status: BuildingStatus;
	progress: number;
	upgradeNextId?: string;
	productionMultiplier?: number;
};

export type KingdomTileSnapshot = KingdomCoord & {
	isExpansionSite?: true;
	building?: KingdomBuildingSnapshot;
};

export type KingdomSnapshot = {
	tiles: KingdomTileSnapshot[];
};

export type PlayerGameView = {
	playerId: string;
	resources: ResourceMap;
	blueprints: ResourceMap;
	shop: ShopSnapshot;
	kingdom: KingdomSnapshot;
	army: ArmyUnit[];
	combat: CombatSnapshot;
	fight: FightSnapshot;
	advance: AdvanceSnapshot;
};

export type GameSnapshot = {
	tick: number;
	phase: GamePhase;
	status: GameStatus;
	targetRenown: number;
	winnerPlayerId?: string;
	finalStandings: GameStandingSnapshot[];
	buildPhaseSecondsRemaining: number;
	players: PlayerGameView[];
};
