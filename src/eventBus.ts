export type TileSelectedPayload = { 
	q: number; 
	r: number; 
	built: boolean;
	buildingId?: string;
	buildingStatus?: 'constructing' | 'active' | 'upgrading';
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
	| { type: 'shop-buy-requested'; slotIndex: number }
	| { type: 'shop-reroll-requested' }
	| { type: 'army-train-requested'; unitEntityId: string }
	| { type: 'combat-start-requested'; enemyMode?: 'mirror' | 'random' }
	| { type: 'combat-step-requested'; steps?: number }
	| { type: 'combat-reset-requested' };

export type CombatUnitUiView = {
	unitId: string;
	name: string;
	assetPath: string;
	health: number;
	maxHealth: number;
};

export type CombatLogEntryUiView = {
	seq: number;
	text: string;
};

export type CombatUiState = {
	status: 'idle' | 'running' | 'finished';
	winner?: 'armyA' | 'armyB' | 'draw';
	round: number;
	activeSide: 'armyA' | 'armyB';
	armyA: CombatUnitUiView[];
	armyB: CombatUnitUiView[];
	log: CombatLogEntryUiView[];
};

export type ArmyUnitUiView = {
	entityId: string;
	unitId: string;
	name: string;
	textureId: string;
	assetPath: string;
	health: number;
	drFlat: number;
	drPercent: number;
	actionsPerTurn: number;
	trainingLevel: number;
	trainingStatus: 'idle' | 'training';
	trainingProgress: number; // percent
	nextTrainCost: Record<string, number>;
	trainTime: number; // ticks
};

export type GameToUiEvents =
	| { type: 'tile-selected'; payload: TileSelectedPayload }
	| { type: 'tile-cleared' }
	| { type: 'resource-updated'; key: string; value: number }
	| { type: 'build-result'; q: number; r: number; buildingId: string; ok: boolean; reason?: string }
	| { type: 'blueprint-inventory-updated'; inventory: Record<string, number> }
	| { type: 'shop-state-updated'; offers: Array<string | null>; buyCost: number; rerollCost: number }
	| { type: 'shop-action-result'; action: 'buy' | 'reroll'; ok: boolean; reason?: string; slotIndex?: number }
	| { type: 'army-state-updated'; units: ArmyUnitUiView[] }
	| { type: 'army-action-result'; action: 'train'; ok: boolean; reason?: string; unitEntityId?: string }
	| { type: 'combat-state-updated'; state: CombatUiState }
	| { type: 'combat-action-result'; action: 'start' | 'step' | 'reset'; ok: boolean; reason?: string };

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
