import { eventBus } from '../../eventBus';
import type { GameSnapshot, ServerEvent } from '../../shared/multiplayer/protocol';
import { multiplayerClient } from './clientSingleton';
import { flushPendingSuccess, publishRejectedAction } from './projectionBridgePending';
import { toPendingAction, type CombatProjectionStatus, type PendingUiAction } from './projectionBridgeTypes';
import { publishPlayerView } from './projectionBridgeView';

export class MultiplayerProjectionBridge {
	private unsubscribeUi: (() => void) | null = null;
	private unsubscribeServer: (() => void) | null = null;
	private lastCombatStatus: CombatProjectionStatus = 'idle';
	private pending: PendingUiAction[] = [];

	attach(): void {
		if (this.unsubscribeUi || this.unsubscribeServer) return;

		this.unsubscribeUi = eventBus.subscribeUiToGame((event) => {
			if (!multiplayerClient.handlesUiToGameEvent(event)) return;
			const pendingAction = toPendingAction(event);
			if (pendingAction) this.pending.push(pendingAction);
			const forwarded = multiplayerClient.forwardUiToGameEvent(event);
			if (!forwarded && pendingAction) this.pending.pop();
		});

		this.unsubscribeServer = multiplayerClient.subscribeServerEvents((event) => {
			if (event.type === 'game/snapshot') {
				this.handleSnapshot(event.game);
				return;
			}
			if (event.type === 'command/rejected') {
				this.handleRejected(event);
			}
		});
	}

	detach(): void {
		this.unsubscribeUi?.();
		this.unsubscribeServer?.();
		this.unsubscribeUi = null;
		this.unsubscribeServer = null;
		this.pending = [];
		this.lastCombatStatus = 'idle';
	}

	private handleSnapshot(game: GameSnapshot): void {
		const view = multiplayerClient.getSelfGameView(game);
		if (!view) return;
		this.lastCombatStatus = publishPlayerView(view, this.lastCombatStatus);
		flushPendingSuccess(this.pending);
	}

	private handleRejected(event: Extract<ServerEvent, { type: 'command/rejected' }>): void {
		const current = this.pending.shift();
		publishRejectedAction(event, current);
	}
}

export const multiplayerProjectionBridge = new MultiplayerProjectionBridge();