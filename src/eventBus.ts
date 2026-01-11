export type TileSelectedPayload = { 
	q: number; 
	r: number; 
	built: boolean;
	buildingId?: string;
	buildingStatus?: 'constructing' | 'active';
	constructionProgress?: number;
	productionMultiplier?: number;
	// Upgrade UI
	nextUpgradeId?: string;
	nextUpgradeCost?: Record<string, number>;
	nextUpgradeTime?: number; // seconds
	upgradingToId?: string;
	upgradeProgress?: number; // percent
};

export type UiToGameEvents =
	| { type: 'build-requested'; q: number; r: number; buildingId: string }
	| { type: 'destroy-requested'; q: number; r: number }
	| { type: 'upgrade-requested'; q: number; r: number; upgradeBuildingId: string }
	| { type: 'spend-gold'; amount: number; reason: 'shop-buy' | 'shop-fill' };

export type GameToUiEvents =
	| { type: 'tile-selected'; payload: TileSelectedPayload }
	| { type: 'tile-cleared' }
	| { type: 'resource-updated'; key: string; value: number }
	| { type: 'build-result'; q: number; r: number; buildingId: string; ok: boolean; reason?: string }
	| { type: 'spend-gold-result'; amount: number; ok: boolean; reason?: string; requestReason: 'shop-buy' | 'shop-fill' };

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
