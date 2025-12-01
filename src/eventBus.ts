export type TileSelectedPayload = { q: number; r: number; built: boolean };

export type UiToGameEvents =
	| { type: 'build-requested'; q: number; r: number }
	| { type: 'destroy-requested'; q: number; r: number };

export type GameToUiEvents =
	| { type: 'tile-selected'; payload: TileSelectedPayload }
	| { type: 'tile-cleared' }
	| { type: 'resource-updated'; key: string; value: number };

type GameToUiListener = (event: GameToUiEvents) => void;
type UiToGameListener = (event: UiToGameEvents) => void;

const gameToUiListeners = new Set<GameToUiListener>();
const uiToGameListeners = new Set<UiToGameListener>();

export const eventBus = {
	subscribeGameToUi(listener: GameToUiListener) {
		gameToUiListeners.add(listener);
		return () => gameToUiListeners.delete(listener);
	},
	publishGameToUi(event: GameToUiEvents) {
		for (const l of gameToUiListeners) l(event);
	},
	subscribeUiToGame(listener: UiToGameListener) {
		uiToGameListeners.add(listener);
		return () => uiToGameListeners.delete(listener);
	},
	publishUiToGame(event: UiToGameEvents) {
		for (const l of uiToGameListeners) l(event);
	},
};
