import type { GameActionCommand } from '../../../shared/multiplayer/commands';
import type { CommandResult } from './types';

export type PendingActionRequestStatus = 'sent' | 'acknowledged';

export type PendingActionRequest = {
	requestId: string;
	actionType: GameActionCommand['type'];
	snapshotVersionAtSend: number;
	status: PendingActionRequestStatus;
	resolve: (result: CommandResult) => void;
};

/**
 * Tracks lifecycle of action requests and resolves them only when both an
 * acknowledgement and a newer snapshot have been observed.
 */
export class ActionRequestTracker {
	private readonly pendingById = new Map<string, PendingActionRequest>();

	/** Returns true when at least one action request is pending resolution. */
	hasPending(): boolean {
		return this.pendingById.size > 0;
	}

	/** Registers a newly sent request in the tracker. */
	trackRequest(request: Omit<PendingActionRequest, 'status'>): void {
		this.pendingById.set(request.requestId, {
			...request,
			status: 'sent'
		});
	}

	/**
	 * Marks a request as acknowledged. If a newer snapshot is already present,
	 * resolves immediately as successful.
	 */
	markAccepted(requestId: string, currentSnapshotVersion: number): void {
		const pending = this.pendingById.get(requestId);
		if (!pending) return;

		if (currentSnapshotVersion > pending.snapshotVersionAtSend) {
			this.resolve(requestId, { ok: true });
			return;
		}

		pending.status = 'acknowledged';
	}

	/** Rejects a pending request with a reason, if it still exists. */
	reject(requestId: string, reason: string): void {
		this.resolve(requestId, { ok: false, reason });
	}

	/** Rejects all pending requests with a shared reason. */
	rejectAll(reason: string): void {
		for (const requestId of this.pendingById.keys()) {
			this.resolve(requestId, { ok: false, reason });
		}
	}

	/**
	 * Resolves all acknowledged requests once a newer snapshot version is observed.
	 */
	resolveAcknowledgedThroughSnapshot(currentSnapshotVersion: number): void {
		for (const pending of this.pendingById.values()) {
			if (pending.status !== 'acknowledged') continue;
			if (currentSnapshotVersion <= pending.snapshotVersionAtSend) continue;
			this.resolve(pending.requestId, { ok: true });
		}
	}

	private resolve(requestId: string, result: CommandResult): void {
		const pending = this.pendingById.get(requestId);
		if (!pending) return;
		this.pendingById.delete(requestId);
		pending.resolve(result);
	}
}
