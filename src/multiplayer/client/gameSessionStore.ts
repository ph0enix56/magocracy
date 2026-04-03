import { writable } from 'svelte/store';
import type { GameActionCommand } from '../../shared/multiplayer/commands';
import type { ServerEvent } from '../../shared/multiplayer/events';
import type { BuildingCatalogEntry } from '../../shared/multiplayer/snapshots';
import type { MultiplayerClientState } from './MultiplayerClient';
import { buildingCatalog } from './buildingCatalog';
import { multiplayerClient } from './clientSingleton';
import { ActionRequestTracker } from './session/actionRequestTracker';
import { validateActionSanity } from './session/actionValidation';
import { buildGameSessionState } from './session/sessionStateBuilder';
import {
	INITIAL_SESSION_BUILD_CONTEXT,
	type CommandResult,
	type GameSessionState,
	type TileScreenAnchor
} from './session/types';

export type { CommandResult, GameSessionState, SelectedTileView, TileScreenAnchor } from './session/types';

type GameSessionRuntime = {
	state: {
		subscribe: (run: (value: GameSessionState) => void, invalidate?: (value?: GameSessionState) => void) => () => void;
	};
	client: {
		selectTile: (q: number, r: number, anchor?: TileScreenAnchor) => void;
		clearSelectedTile: () => void;
		scoutPlayer: (playerId: string) => void;
		viewOwnTown: () => void;
		requestBuild: (q: number, r: number, buildingId: string) => Promise<CommandResult>;
		requestExpandTile: (q: number, r: number) => Promise<CommandResult>;
		requestDestroy: (q: number, r: number) => Promise<CommandResult>;
		requestUpgrade: (q: number, r: number, upgradeBuildingId: string) => Promise<CommandResult>;
		requestShopBuy: (slotIndex: number) => Promise<CommandResult>;
		requestShopReroll: () => Promise<CommandResult>;
		requestArmyReorder: (unitEntityId: string, direction: 'up' | 'down') => Promise<CommandResult>;
		requestCombatStep: (steps?: number) => Promise<CommandResult>;
		requestFightReplayOpen: (matchId: string) => Promise<CommandResult>;
		requestAdvanceSelectCharter: (charterId: string) => Promise<CommandResult>;
	};
};

function createGameSessionRuntime(): GameSessionRuntime {
	const requestTracker = new ActionRequestTracker();
	let sessionBuildContext = { ...INITIAL_SESSION_BUILD_CONTEXT };

	const initialBuild = buildGameSessionState({
		base: multiplayerClient.getState(),
		catalog: buildingCatalog.getAll(),
		context: sessionBuildContext
	});

	sessionBuildContext = initialBuild.context;
	let currentState = initialBuild.state;
	const store = writable<GameSessionState>(initialBuild.state);

	function setState(nextState: GameSessionState): void {
		currentState = nextState;
		store.set(nextState);
	}

	function handleTransportStateChange(base: MultiplayerClientState, catalog: BuildingCatalogEntry[]): void {
		if (requestTracker.hasPending() && !multiplayerClient.isAuthoritativeGameplayActive()) {
			requestTracker.rejectAll('Authoritative multiplayer gameplay is not active.');
		}

		const nextBuild = buildGameSessionState({
			base,
			catalog,
			context: sessionBuildContext
		});

		sessionBuildContext = nextBuild.context;
		setState(nextBuild.state);
		requestTracker.resolveAcknowledgedThroughSnapshot(nextBuild.state.gameSnapshotVersion);
	}

	function rebuildFromCurrentTransportState(): void {
		handleTransportStateChange(multiplayerClient.getState(), currentState.catalog);
	}

	function sendTrackedAction(action: GameActionCommand): Promise<CommandResult> {
		const sanityResult = validateActionSanity(action);
		if (sanityResult) {
			return Promise.resolve(sanityResult);
		}

		if (currentState.isScouting && action.type !== 'advance/select-charter') {
			return Promise.resolve({ ok: false, reason: 'Return to your own town before issuing commands.' });
		}

		if (!multiplayerClient.isAuthoritativeGameplayActive()) {
			return Promise.resolve({ ok: false, reason: 'Authoritative multiplayer gameplay is not active.' });
		}

		const requestId = createRequestId();

		return new Promise((resolve) => {
			requestTracker.trackRequest({
				requestId,
				actionType: action.type,
				snapshotVersionAtSend: currentState.gameSnapshotVersion,
				resolve
			});

			const sent = multiplayerClient.sendGameAction(action, requestId);
			if (!sent) {
				requestTracker.reject(requestId, 'Not connected to the multiplayer server.');
			}
		});
	}

	function handleServerEvent(event: ServerEvent): void {
		if (event.type === 'command/accepted' && event.requestId) {
			requestTracker.markAccepted(event.requestId, currentState.gameSnapshotVersion);
			return;
		}

		if (event.type === 'command/rejected' && event.requestId) {
			requestTracker.reject(event.requestId, event.reason);
		}
	}

	multiplayerClient.subscribe((state) => {
		handleTransportStateChange(state, currentState.catalog);
	});

	multiplayerClient.subscribeServerEvents((event) => {
		handleServerEvent(event);
	});

	buildingCatalog.subscribe((entries) => {
		handleTransportStateChange(multiplayerClient.getState(), entries);
	});

	return {
		state: {
			subscribe: store.subscribe
		},
		client: {
			selectTile(q: number, r: number, anchor?: TileScreenAnchor): void {
				const sameCoords = sessionBuildContext.selectedTileCoords?.q === q && sessionBuildContext.selectedTileCoords.r === r;
				const sameAnchor = !!anchor &&
					sessionBuildContext.selectedTileAnchor?.screenX === anchor.screenX &&
					sessionBuildContext.selectedTileAnchor?.screenY === anchor.screenY;
				if (sameCoords && (!anchor || sameAnchor)) return;
				sessionBuildContext.selectedTileCoords = { q, r };
				sessionBuildContext.selectedTileAnchor = anchor ? { screenX: anchor.screenX, screenY: anchor.screenY } : null;
				rebuildFromCurrentTransportState();
			},
			clearSelectedTile(): void {
				if (!sessionBuildContext.selectedTileCoords) return;
				sessionBuildContext.selectedTileCoords = null;
				sessionBuildContext.selectedTileAnchor = null;
				rebuildFromCurrentTransportState();
			},
			scoutPlayer(playerId: string): void {
				const nextPlayerId = playerId.trim();
				if (!nextPlayerId) return;
				if (sessionBuildContext.viewedPlayerId === nextPlayerId) return;
				sessionBuildContext.viewedPlayerId = nextPlayerId;
				sessionBuildContext.selectedTileCoords = null;
				sessionBuildContext.selectedTileAnchor = null;
				rebuildFromCurrentTransportState();
			},
			viewOwnTown(): void {
				if (sessionBuildContext.viewedPlayerId === null) return;
				sessionBuildContext.viewedPlayerId = null;
				sessionBuildContext.selectedTileCoords = null;
				sessionBuildContext.selectedTileAnchor = null;
				rebuildFromCurrentTransportState();
			},
			requestBuild(q: number, r: number, buildingId: string): Promise<CommandResult> {
				return sendTrackedAction({ type: 'build/request', q, r, buildingId });
			},
			requestExpandTile(q: number, r: number): Promise<CommandResult> {
				return sendTrackedAction({ type: 'kingdom/expand', q, r });
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
			requestArmyReorder(unitEntityId: string, direction: 'up' | 'down'): Promise<CommandResult> {
				return sendTrackedAction({ type: 'army/reorder', unitEntityId, direction });
			},
			requestCombatStep(steps = 1): Promise<CommandResult> {
				return sendTrackedAction({ type: 'combat/step', steps });
			},
			requestFightReplayOpen(matchId: string): Promise<CommandResult> {
				return sendTrackedAction({ type: 'fight/replay-open', matchId });
			},
			requestAdvanceSelectCharter(charterId: string): Promise<CommandResult> {
				return sendTrackedAction({ type: 'advance/select-charter', charterId });
			}
		}
	};
}

function createRequestId(): string {
	return Date.now().toString(16) + '-' + Math.random().toString(16).slice(2);	
}

const runtime = createGameSessionRuntime();

export const gameSessionState = runtime.state;
export const gameSessionClient = runtime.client;
