import { writable } from 'svelte/store';
import type {
	ArmyUnitSnapshot,
	BlueprintInventorySnapshot,
	BuildingCatalogEntry,
	CombatSnapshot,
	FightSnapshot,
	GameActionCommand,
	GamePhase,
	KingdomSnapshot,
	LobbyPlayerSnapshot,
	PlayerGameView,
	ResourceSnapshot,
	ServerEvent,
	ShopSnapshot
} from '../../shared/multiplayer/protocol';
import type { MultiplayerClientState } from './MultiplayerClient';
import { buildingCatalog } from './buildingCatalog';
import { multiplayerClient } from './clientSingleton';

export type SelectedTileView = {
	q: number;
	r: number;
	built: boolean;
	buildingId?: string;
	buildingStatus?: 'constructing' | 'active' | 'upgrading';
	constructionProgress?: number;
	productionMultiplier?: number;
	nextUpgradeId?: string;
	nextUpgradeCost?: Record<string, number>;
	nextUpgradeTime?: number;
	upgradingToId?: string;
	upgradeProgress?: number;
};

export type CommandResult = { ok: true } | { ok: false; reason: string };

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
	resources: ResourceSnapshot;
	blueprints: BlueprintInventorySnapshot;
	shop: ShopSnapshot;
	army: ArmyUnitSnapshot[];
	combat: CombatSnapshot;
	fight: FightSnapshot;
	kingdom: KingdomSnapshot;
	selectedTile: SelectedTileView | null;
	combatOpenRequest: number;
};

type PendingRequest = {
	resolve: (result: CommandResult) => void;
};

const EMPTY_RESOURCES: ResourceSnapshot = {};
const EMPTY_SHOP: ShopSnapshot = {
	offers: [],
	buyCost: 0,
	rerollCost: 0
};
const EMPTY_COMBAT: CombatSnapshot = {
	status: 'idle',
	round: 0,
	activeSide: 'armyA',
	armyA: [],
	armyB: [],
	log: []
};
const EMPTY_KINGDOM: KingdomSnapshot = {
	tiles: []
};
const EMPTY_FIGHT: FightSnapshot = {
	isActive: false,
	encountersPerPhase: 1,
	secondsPerRound: 60,
	currentRoundIndex: 0,
	secondsToNextRound: 0,
	pairings: [],
	results: [],
	playerRounds: []
};

let selectedTileCoords: { q: number; r: number } | null = null;
let viewedPlayerId: string | null = null;
let combatOpenRequest = 0;
let lastCombatStatus: CombatSnapshot['status'] = 'idle';
const pendingRequests = new Map<string, PendingRequest>();

const initialState = buildState(multiplayerClient.getState(), buildingCatalog.getAll());
let currentState = initialState;
const store = writable<GameSessionState>(initialState);

multiplayerClient.subscribe((state) => {
	if (pendingRequests.size > 0 && !multiplayerClient.isAuthoritativeGameplayActive()) {
		rejectAllPending('Authoritative multiplayer gameplay is not active.');
	}
	setState(buildState(state, currentState.catalog));
});

multiplayerClient.subscribeServerEvents((event) => {
	handleServerEvent(event);
});

buildingCatalog.subscribe((entries) => {
	setState(buildState(multiplayerClient.getState(), entries));
});

export const gameSessionState = {
	subscribe: store.subscribe
};

export const gameSessionClient = {
	selectTile(q: number, r: number): void {
		if (selectedTileCoords?.q === q && selectedTileCoords.r === r) return;
		selectedTileCoords = { q, r };
		setState(buildState(multiplayerClient.getState(), currentState.catalog));
	},
	clearSelectedTile(): void {
		if (!selectedTileCoords) return;
		selectedTileCoords = null;
		setState(buildState(multiplayerClient.getState(), currentState.catalog));
	},
	scoutPlayer(playerId: string): void {
		const nextPlayerId = playerId.trim();
		if (!nextPlayerId) return;
		if (viewedPlayerId === nextPlayerId) return;
		viewedPlayerId = nextPlayerId;
		selectedTileCoords = null;
		setState(buildState(multiplayerClient.getState(), currentState.catalog));
	},
	viewOwnTown(): void {
		if (viewedPlayerId === null) return;
		viewedPlayerId = null;
		selectedTileCoords = null;
		setState(buildState(multiplayerClient.getState(), currentState.catalog));
	},
	requestBuild(q: number, r: number, buildingId: string): Promise<CommandResult> {
		return sendTrackedAction({ type: 'build/request', q, r, buildingId });
	},
	requestDestroy(q: number, r: number): Promise<CommandResult> {
		return sendTrackedAction({ type: 'destroy/request', q, r });
	},
	requestUpgrade(q: number, r: number, upgradeBuildingId: string): Promise<CommandResult> {
		return sendTrackedAction({ type: 'upgrade/request', q, r, upgradeBuildingId });
	},
	requestShopBuy(slotIndex: number): Promise<CommandResult> {
		return sendTrackedAction({ type: 'shop/buy', slotIndex });
	},
	requestShopReroll(): Promise<CommandResult> {
		return sendTrackedAction({ type: 'shop/reroll' });
	},
	requestArmyTrain(unitEntityId: string): Promise<CommandResult> {
		return sendTrackedAction({ type: 'army/train', unitEntityId });
	},
	requestArmyReorder(unitEntityId: string, direction: 'up' | 'down'): Promise<CommandResult> {
		return sendTrackedAction({ type: 'army/reorder', unitEntityId, direction });
	},
	requestCombatStep(steps = 1): Promise<CommandResult> {
		return sendTrackedAction({ type: 'combat/step', steps });
	},
	requestFightReplayOpen(matchId: string): Promise<CommandResult> {
		return sendTrackedAction({ type: 'fight/replay-open', matchId });
	}
};

function setState(nextState: GameSessionState): void {
	currentState = nextState;
	store.set(nextState);
}

function buildState(base: MultiplayerClientState, catalog: BuildingCatalogEntry[]): GameSessionState {
	const selfPlayer = getSelfPlayer(base);
	const selfGameView = getSelfGameView(base);
	const resolvedViewedPlayerId = resolveViewedPlayerId(base, viewedPlayerId);
	if (resolvedViewedPlayerId !== viewedPlayerId) {
		viewedPlayerId = resolvedViewedPlayerId;
	}
	const viewedPlayer = getViewedPlayer(base, resolvedViewedPlayerId);
	const viewedGameView = getViewedGameView(base, resolvedViewedPlayerId);
	const isScouting = viewedGameView !== null && selfGameView !== null && viewedGameView.playerId !== selfGameView.playerId;
	const currentPhase: GamePhase = base.game?.phase ?? 'setup';
	const isFightPhase = currentPhase === 'combat';
	const canIssueCommands = !isScouting && selfGameView !== null && base.lobby?.status === 'in-game';
	const canTownInteract = canIssueCommands && currentPhase === 'build';
	const canArmyReorder = canIssueCommands;
	const canCombatStep = canIssueCommands;
	const nextCombatStatus = selfGameView?.combat.status ?? 'idle';

	if (lastCombatStatus !== 'running' && nextCombatStatus === 'running') {
		combatOpenRequest += 1;
	}
	lastCombatStatus = nextCombatStatus;

	if (!viewedGameView) {
		selectedTileCoords = null;
	}

	return {
		...base,
		catalog,
		selfPlayer,
		selfGameView,
		viewedPlayerId: viewedGameView?.playerId ?? selfGameView?.playerId ?? null,
		viewedPlayer,
		viewedGameView,
		isScouting,
		canIssueCommands,
		canTownInteract,
		canArmyReorder,
		canCombatStep,
		currentPhase,
		isFightPhase,
		resources: viewedGameView?.resources ?? EMPTY_RESOURCES,
		blueprints: viewedGameView?.blueprints ?? {},
		shop: viewedGameView?.shop ?? EMPTY_SHOP,
		army: viewedGameView?.army ?? [],
		combat: viewedGameView?.combat ?? EMPTY_COMBAT,
		fight: viewedGameView?.fight ?? EMPTY_FIGHT,
		kingdom: viewedGameView?.kingdom ?? EMPTY_KINGDOM,
		selectedTile: viewedGameView && selectedTileCoords
			? buildSelectedTileView(selectedTileCoords.q, selectedTileCoords.r, viewedGameView.kingdom, catalog)
			: null,
		combatOpenRequest
	};
}

function getSelfPlayer(base: MultiplayerClientState): LobbyPlayerSnapshot | null {
	if (!base.lobby || !base.playerId) return null;
	return base.lobby.players.find((player) => player.playerId === base.playerId) ?? null;
}

function getSelfGameView(base: MultiplayerClientState): PlayerGameView | null {
	if (!base.game || !base.playerId) return null;
	return base.game.players.find((player) => player.playerId === base.playerId) ?? null;
}

function getViewedPlayer(base: MultiplayerClientState, targetPlayerId: string | null): LobbyPlayerSnapshot | null {
	const playerId = targetPlayerId ?? base.playerId;
	if (!base.lobby || !playerId) return null;
	return base.lobby.players.find((player) => player.playerId === playerId) ?? null;
}

function getViewedGameView(base: MultiplayerClientState, targetPlayerId: string | null): PlayerGameView | null {
	const playerId = targetPlayerId ?? base.playerId;
	if (!base.game || !playerId) return null;
	return base.game.players.find((player) => player.playerId === playerId) ?? null;
}

function resolveViewedPlayerId(base: MultiplayerClientState, candidatePlayerId: string | null): string | null {
	if (!base.game || !base.playerId) return null;
	if (!candidatePlayerId || candidatePlayerId === base.playerId) return null;
	return base.game.players.some((player) => player.playerId === candidatePlayerId) ? candidatePlayerId : null;
}

function buildSelectedTileView(
	q: number,
	r: number,
	kingdom: KingdomSnapshot,
	catalog: BuildingCatalogEntry[]
): SelectedTileView {
	const tile = kingdom.tiles.find((entry) => entry.q === q && entry.r === r);
	const built = !!tile?.building;

	let buildingId: string | undefined;
	let buildingStatus: 'constructing' | 'active' | 'upgrading' | undefined;
	let constructionProgress: number | undefined;
	let productionMultiplier: number | undefined;
	let nextUpgradeId: string | undefined;
	let nextUpgradeCost: Record<string, number> | undefined;
	let nextUpgradeTime: number | undefined;
	let upgradingToId: string | undefined;
	let upgradeProgress: number | undefined;

	if (tile?.building) {
		buildingId = tile.building.buildingId;
		buildingStatus = tile.building.status;
		const def = catalog.find((entry) => entry.id === buildingId);

		if (tile.building.status === 'constructing' && def) {
			constructionProgress = toProgressPercent(tile.building.progress, def.buildTime);
		} else if (tile.building.status === 'upgrading') {
			upgradingToId = tile.building.upgradeNextId;
			const targetDef = upgradingToId ? catalog.find((entry) => entry.id === upgradingToId) : undefined;
			if (targetDef) {
				upgradeProgress = toProgressPercent(tile.building.progress, targetDef.buildTime);
			}
		} else if (tile.building.status === 'active') {
			productionMultiplier = tile.building.productionMultiplier;
			const nextUpgrade = catalog.find((entry) => entry.parentId === buildingId);
			if (nextUpgrade) {
				nextUpgradeId = nextUpgrade.id;
				nextUpgradeCost = nextUpgrade.cost;
				nextUpgradeTime = nextUpgrade.buildTime;
			}
		}
	}

	return {
		q,
		r,
		built,
		buildingId,
		buildingStatus,
		constructionProgress,
		productionMultiplier,
		nextUpgradeId,
		nextUpgradeCost,
		nextUpgradeTime,
		upgradingToId,
		upgradeProgress
	};
}

function toProgressPercent(progress: number, total: number): number {
	if (total <= 0) return 100;
	return Math.min(100, Math.max(0, (progress / total) * 100));
}

function sendTrackedAction(action: GameActionCommand): Promise<CommandResult> {
	if (currentState.isScouting) {
		return Promise.resolve({ ok: false, reason: 'Return to your own town before issuing commands.' });
	}

	if (currentState.currentPhase !== 'build') {
		if (action.type === 'build/request' || action.type === 'destroy/request' || action.type === 'upgrade/request') {
			return Promise.resolve({ ok: false, reason: 'City interactions are disabled during fight phase.' });
		}

		if (action.type === 'shop/buy' || action.type === 'shop/reroll') {
			return Promise.resolve({ ok: false, reason: 'Shop is disabled during fight phase.' });
		}

		if (action.type === 'army/train') {
			return Promise.resolve({ ok: false, reason: 'Training is disabled during fight phase.' });
		}
	}

	if (!multiplayerClient.isAuthoritativeGameplayActive()) {
		return Promise.resolve({ ok: false, reason: 'Authoritative multiplayer gameplay is not active.' });
	}

	const requestId = createRequestId();

	return new Promise((resolve) => {
		pendingRequests.set(requestId, { resolve });
		const sent = multiplayerClient.sendGameAction(action, requestId);
		if (!sent) {
			resolvePending(requestId, { ok: false, reason: 'Not connected to the multiplayer server.' });
		}
	});
}

function handleServerEvent(event: ServerEvent): void {
	if (event.type === 'command/accepted' && event.requestId) {
		resolvePending(event.requestId, { ok: true });
		return;
	}

	if (event.type === 'command/rejected' && event.requestId) {
		resolvePending(event.requestId, { ok: false, reason: event.reason });
	}
}

function resolvePending(requestId: string, result: CommandResult): void {
	const pending = pendingRequests.get(requestId);
	if (!pending) return;
	pendingRequests.delete(requestId);
	pending.resolve(result);
}

function rejectAllPending(reason: string): void {
	for (const [requestId, pending] of pendingRequests.entries()) {
		pending.resolve({ ok: false, reason });
		pendingRequests.delete(requestId);
	}
}

function createRequestId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}