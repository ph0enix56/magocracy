import type { ClientCommand, GameActionCommand } from './commands';
import type { BuildingCatalogSnapshot, GameSnapshot, LobbySnapshot } from './snapshots';

export type ServerEvent =
	| { type: 'session/connected'; playerId: string }
	| { type: 'catalog/snapshot'; catalog: BuildingCatalogSnapshot }
	| { type: 'lobby/state'; lobby: LobbySnapshot | null }
	| { type: 'game/snapshot'; game: GameSnapshot }
	| {
		type: 'command/accepted';
		commandType: ClientCommand['type'] | GameActionCommand['type'];
		actionType?: GameActionCommand['type'];
		requestId?: string;
	}
	| {
		type: 'command/rejected';
		commandType: ClientCommand['type'] | GameActionCommand['type'];
		actionType?: GameActionCommand['type'];
		requestId?: string;
		reason: string;
	}
	| { type: 'system/error'; message: string };

export type ClientToServerEvents = {
	command: (command: ClientCommand) => void;
};

export type ServerToClientEvents = {
	event: (event: ServerEvent) => void;
};
