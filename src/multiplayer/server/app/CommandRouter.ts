import type { ClientCommand } from '../../../shared/multiplayer/protocol';

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
