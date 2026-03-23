import type { ClientCommand } from '../../../shared/multiplayer/protocol';

/**
 * Shape of the command handlers that are registered for processing client commands. Each handler corresponds to a specific client command type,
 * with game actions being fully processed in the lobby's game runtime.
 */
type CommandHandlerMap = {
	onCreate(playerName: string): void;
	onJoin(lobbyId: string, playerName: string): void;
	onLeave(): void;
	onSetReady(ready: boolean): void;
	onStartLobby(): void;
	onStartFight(): void;
	onStartAdvance(): void;
	onSolo(playerName: string): void;
	onGameAction(command: Extract<ClientCommand, { type: 'game/action' }>): void;
};

/**
 * Centralized router for incoming client commands. It delegates each command to the appropriate handler based on its type, and ensures command
 * parameters are correctly passed to it. The handlers are implemented and registered in {@link LobbyApplicationService}.
 * @param command The incoming client command, with its type and payload.
 * @param handlers The map of registered handlers for each command type, provided by the app service.
 */
export function routeClientCommand(command: ClientCommand, handlers: CommandHandlerMap): void {
	switch (command.type) {
		case 'lobby/create':
			handlers.onCreate(command.playerName);
			return;
		case 'lobby/join':
			handlers.onJoin(command.lobbyId, command.playerName);
			return;
		case 'lobby/leave':
			handlers.onLeave();
			return;
		case 'lobby/set-ready':
			handlers.onSetReady(command.ready);
			return;
		case 'lobby/start':
			handlers.onStartLobby();
			return;
		case 'lobby/start-fight':
			handlers.onStartFight();
			return;
		case 'lobby/start-advance':
			handlers.onStartAdvance();
			return;
		case 'lobby/solo':
			handlers.onSolo(command.playerName);
			return;
		case 'game/action':
			handlers.onGameAction(command);
			return;
	}
}
