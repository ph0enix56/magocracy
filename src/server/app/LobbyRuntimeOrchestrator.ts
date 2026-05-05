import { RoomGameRuntime } from '../RoomGameRuntime';
import type { GameActionCommand } from '../../shared/multiplayer/commands';
import type { GameSnapshot } from '../../shared/multiplayer/snapshots';

/**
 * Owns authoritative runtime instances per lobby and routes gameplay actions
 * to the correct runtime.
 */
export class LobbyRuntimeOrchestrator {
	private readonly gameRuntimes = new Map<string, RoomGameRuntime>();

	constructor(private readonly onSnapshot: (lobbyId: string, snapshot: GameSnapshot) => void) {}

	/** Starts a new authoritative runtime for a lobby and stores it for future dispatching. */
	startLobbyRuntime(lobbyId: string, playerIds: string[]): void {
		const runtime = new RoomGameRuntime(playerIds, (snapshot) => {
			this.onSnapshot(lobbyId, snapshot);
		});
		runtime.start();
		this.gameRuntimes.set(lobbyId, runtime);
	}

	/** Stops and removes a lobby runtime if present. */
	stopLobbyRuntime(lobbyId: string): void {
		this.gameRuntimes.get(lobbyId)?.stop();
		this.gameRuntimes.delete(lobbyId);
	}

	/** Applies a gameplay action to the lobby runtime and returns command outcome. */
	dispatchAction(lobbyId: string, playerId: string, action: GameActionCommand): { ok: true } | { ok: false; reason: string } {
		const runtime = this.gameRuntimes.get(lobbyId);
		if (!runtime) {
			return { ok: false, reason: 'Missing authoritative game runtime.' };
		}
		return runtime.handleAction(playerId, action);
	}

	/** Emits the latest runtime snapshot for a lobby, if a runtime exists. */
	emitCurrentSnapshot(lobbyId: string): GameSnapshot | null {
		const runtime = this.gameRuntimes.get(lobbyId);
		if (!runtime) return null;
		return runtime.emitSnapshot();
	}
}
