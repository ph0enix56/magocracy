import type { MultiplayerClientState } from '../MultiplayerClient';
import type {
	BuildingCatalogEntry,
	GamePhase,
	KingdomSnapshot,
	LobbyPlayerSnapshot,
	PlayerGameView
} from '../../../shared/multiplayer/contracts/snapshots';
import type { BuildingStatus, ResourceMap } from '../../../shared/domain/types';
import {
	EMPTY_ADVANCE,
	EMPTY_COMBAT,
	EMPTY_FIGHT,
	EMPTY_KINGDOM,
	EMPTY_RESOURCES,
	EMPTY_SHOP,
	type GameSessionState,
	type SelectedTileView,
	type SessionBuildContext,
	type TileScreenAnchor
} from './types';

export type BuildGameSessionStateInput = {
	base: MultiplayerClientState;
	catalog: BuildingCatalogEntry[];
	context: SessionBuildContext;
};

export type BuildGameSessionStateResult = {
	state: GameSessionState;
	context: SessionBuildContext;
};

/**
 * Builds the full client session state from wire transport state, catalog snapshot,
 * and local view context. This function is pure and has no side effects.
 */
export function buildGameSessionState(input: BuildGameSessionStateInput): BuildGameSessionStateResult {
	const { base, catalog } = input;
	const nextContext: SessionBuildContext = { ...input.context };

	const selfPlayer = getSelfPlayer(base);
	const selfGameView = getSelfGameView(base);
	const resolvedViewedPlayerId = resolveViewedPlayerId(base, nextContext.viewedPlayerId);
	nextContext.viewedPlayerId = resolvedViewedPlayerId;

	const viewedPlayer = getViewedPlayer(base, resolvedViewedPlayerId);
	const viewedGameView = getViewedGameView(base, resolvedViewedPlayerId);	
	const isScouting = viewedGameView !== null && selfGameView !== null && viewedGameView.playerId !== selfGameView.playerId;
	const currentPhase: GamePhase = base.game?.phase ?? 'setup';
	const isFightPhase = currentPhase === 'combat';
	const isAdvancePhase = currentPhase === 'advance';
	const canIssueCommands = !isScouting && selfGameView !== null && base.lobby?.status === 'in-game';
	const canTownInteract = canIssueCommands && currentPhase === 'build';
	const canArmyReorder = canIssueCommands;
	const canCombatStep = canIssueCommands;
	const nextCombatStatus = selfGameView?.combat.status ?? 'idle';

	if (nextContext.lastCombatStatus !== 'running' && nextCombatStatus === 'running') {
		nextContext.combatOpenRequest += 1;
	}
	nextContext.lastCombatStatus = nextCombatStatus;

	if (!viewedGameView) {
		nextContext.selectedTileCoords = null;
		nextContext.selectedTileAnchor = null;
	}

	const selectedTile = viewedGameView && nextContext.selectedTileCoords
		? buildSelectedTileView(
			nextContext.selectedTileCoords.q,
			nextContext.selectedTileCoords.r,
			viewedGameView.kingdom,
			catalog,
			nextContext.selectedTileAnchor
		)
		: null;

	return {
		state: {
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
			isAdvancePhase,
			resources: viewedGameView?.resources ?? EMPTY_RESOURCES,
			blueprints: viewedGameView?.blueprints ?? {},
			shop: viewedGameView?.shop ?? EMPTY_SHOP,
			army: viewedGameView?.army ?? [],
			combat: viewedGameView?.combat ?? EMPTY_COMBAT,
			fight: viewedGameView?.fight ?? EMPTY_FIGHT,
			advance: viewedGameView?.advance ?? EMPTY_ADVANCE,
			kingdom: viewedGameView?.kingdom ?? EMPTY_KINGDOM,
			selectedTile,
			combatOpenRequest: nextContext.combatOpenRequest
		},
		context: nextContext
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
	catalog: BuildingCatalogEntry[],
	anchor: TileScreenAnchor | null
): SelectedTileView {
	const tile = kingdom.tiles.find((entry) => entry.q === q && entry.r === r);
	const built = !!tile?.building;

	let buildingId: string | undefined;
	let buildingName: string | undefined;
	let buildingKind: BuildingCatalogEntry['kind'] | undefined;
	let buildingSchool: string | undefined;
	let buildingTier: number | undefined;
	let buildingAssetPath: string | undefined;
	let buildingStatus: BuildingStatus | undefined;
	let constructionProgress: number | undefined;
	let productionMultiplier: number | undefined;
	let nextUpgradeId: string | undefined;
	let nextUpgradeCost: ResourceMap | undefined;
	let nextUpgradeTime: number | undefined;
	let upgradingToId: string | undefined;
	let upgradeProgress: number | undefined;

	if (tile?.building) {
		buildingId = tile.building.buildingId;
		buildingStatus = tile.building.status;
		const def = catalog.find((entry) => entry.id === buildingId);

		if (def) {
			buildingName = def.name;
			buildingKind = def.kind;
			buildingSchool = def.school;
			buildingTier = def.tier;
			buildingAssetPath = def.assetPath;
		}

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
		anchor: anchor ?? undefined,
		built,
		buildingId,
		buildingName,
		buildingKind,
		buildingSchool,
		buildingTier,
		buildingAssetPath,
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
