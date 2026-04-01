import type { ArmyUnit } from '../../../shared/domain/gameViews';
import type { CombatSnapshot } from '../../../shared/domain/combatTypes';
import type { BuildingStatus, ResourceMap } from '../../../shared/domain/types';
import type {
	AdvanceSnapshot,
	BuildingCatalogEntry,
	FightSnapshot,
	GamePhase,
	KingdomSnapshot,
	LobbyPlayerSnapshot,
	PlayerGameView,
	ShopSnapshot
} from '../../../shared/multiplayer/contracts/snapshots';
import type { MultiplayerClientState } from '../MultiplayerClient';

/** Coordinates of a selected kingdom tile in axial hex space. */
export type TileCoords = {
	q: number;
	r: number;
};

/** Screen-space anchor used to position floating tile UI near the clicked hex. */
export type TileScreenAnchor = {
	screenX: number;
	screenY: number;
};

/**
 * UI projection for the currently selected tile. Values are derived from authoritative
 * kingdom snapshot and building catalog data.
 */
export type SelectedTileView = {
	q: number;
	r: number;
	anchor?: TileScreenAnchor;
	built: boolean;
	buildingId?: string;
	buildingName?: string;
	buildingKind?: BuildingCatalogEntry['kind'];
	buildingSchool?: string;
	buildingTier?: number;
	buildingAssetPath?: string;
	buildingStatus?: BuildingStatus;
	constructionProgress?: number;
	productionMultiplier?: number;
	nextUpgradeId?: string;
	nextUpgradeCost?: ResourceMap;
	nextUpgradeTime?: number;
	upgradingToId?: string;
	upgradeProgress?: number;
};

/** Result of issuing a game action command from the client. */
export type CommandResult = { ok: true } | { ok: false; reason: string };

/**
 * Client-side context that is local to rendering/interaction and not part of the
 * authoritative server game state.
 */
export type SessionBuildContext = {
	selectedTileCoords: TileCoords | null;
	selectedTileAnchor: TileScreenAnchor | null;
	viewedPlayerId: string | null;
	combatOpenRequest: number;
	lastCombatStatus: CombatSnapshot['status'];
};

/**
 * Full client session state consumed by UI and projection layers.
 * Includes transport/lobby/game wire state plus derived local view state.
 */
export type GameSessionState = MultiplayerClientState & {
	catalog: BuildingCatalogEntry[];
	selfPlayer: LobbyPlayerSnapshot | null;
	selfGameView: PlayerGameView | null;
	viewedPlayerId: string | null;
	viewedPlayer: LobbyPlayerSnapshot | null;
	viewedGameView: PlayerGameView | null;
	isScouting: boolean;
	canIssueCommands: boolean;
	canTownInteract: boolean;
	canArmyReorder: boolean;
	canCombatStep: boolean;
	currentPhase: GamePhase;
	isFightPhase: boolean;
	isAdvancePhase: boolean;
	resources: ResourceMap;
	blueprints: ResourceMap;
	shop: ShopSnapshot;
	army: ArmyUnit[];
	combat: CombatSnapshot;
	fight: FightSnapshot;
	advance: AdvanceSnapshot;
	kingdom: KingdomSnapshot;
	selectedTile: SelectedTileView | null;
	combatOpenRequest: number;
};

/** Empty fallback resource map used before first game snapshot arrives. */
export const EMPTY_RESOURCES: ResourceMap = {};

/** Empty fallback shop snapshot used before first game snapshot arrives. */
export const EMPTY_SHOP: ShopSnapshot = {
	offers: [],
	buyCost: 0,
	rerollCost: 0
};

/** Empty fallback combat snapshot used before first game snapshot arrives. */
export const EMPTY_COMBAT: CombatSnapshot = {
	status: 'idle',
	round: 0,
	activeSide: 'armyA',
	armyA: [],
	armyB: [],
	log: []
};

/** Empty fallback kingdom snapshot used before first game snapshot arrives. */
export const EMPTY_KINGDOM: KingdomSnapshot = {
	tiles: []
};

/** Empty fallback fight snapshot used before first game snapshot arrives. */
export const EMPTY_FIGHT: FightSnapshot = {
	isActive: false,
	encountersPerPhase: 1,
	secondsPerRound: 60,
	currentRoundIndex: 0,
	secondsToNextRound: 0,
	pairings: [],
	results: [],
	playerRounds: []
};

/** Empty fallback advance snapshot used before first game snapshot arrives. */
export const EMPTY_ADVANCE: AdvanceSnapshot = {
	isActive: false,
	level: 1,
	pickOrderPlayerIds: [],
	secondsPerPick: 1,
	secondsRemaining: 0,
	revealDelaySeconds: 0,
	secondsToPhaseEnd: 0,
	charters: []
};

/** Initial local view context used for the first client session build. */
export const INITIAL_SESSION_BUILD_CONTEXT: SessionBuildContext = {
	selectedTileCoords: null,
	selectedTileAnchor: null,
	viewedPlayerId: null,
	combatOpenRequest: 0,
	lastCombatStatus: 'idle'
};
