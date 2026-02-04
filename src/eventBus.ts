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
	nextUpgradeTime?: number; // time units
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
	| { type: 'army-reorder-requested'; unitEntityId: string; direction: 'up' | 'down' }
	| { type: 'combat-step-requested'; steps?: number }
	| { type: 'worldmap-toggle' }
	| { type: 'worldmap-send-army'; targetPointId: string }
	| { type: 'worldmap-start-combat'; targetPointId: string }
	| { type: 'worldmap-refresh-requested' };

export type WorldMapPointUiView = {
	id: string;
	name: string;
	kind: string;
	owner: string;
	screenX: number;
	screenY: number;
	defenderCount: number;
};

export type WorldMapPoiSelectedUiView = {
	id: string;
	name: string;
	kind: string;
	owner: string;
	pathDistance: number | null;
	defenders: Array<{ unitId: string; name: string; assetPath: string }>;
};

export type WorldMapTravelUiView =
	| { status: 'idle' }
	| {
		status: 'travelling';
		fromPointId: string;
		toPointId: string;
		distanceTotal: number;
		distanceRemaining: number;
		speedPerTick: number;
		etaTicks: number;
	}
	| {
		status: 'arrived';
		fromPointId: string;
		toPointId: string;
		distanceTotal: number;
		speedPerTick: number;
	};

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
	speed: number;
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
	| { type: 'army-action-result'; action: 'train' | 'reorder'; ok: boolean; reason?: string; unitEntityId?: string }
	| { type: 'combat-state-updated'; state: CombatUiState }
	| { type: 'combat-action-result'; action: 'step'; ok: boolean; reason?: string }
	| { type: 'combat-ui-open'; reason: 'worldmap-arrival'; targetPointId: string; targetName: string }
	| { type: 'worldmap-visibility-changed'; isOpen: boolean }
	| { type: 'worldmap-points-layout'; points: WorldMapPointUiView[] }
	| { type: 'worldmap-poi-selected'; poi: WorldMapPoiSelectedUiView }
	| { type: 'worldmap-poi-cleared' }
	| { type: 'worldmap-travel-updated'; travel: WorldMapTravelUiView }
	| { type: 'worldmap-action-result'; action: 'send-army' | 'start-combat'; ok: boolean; reason?: string };

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
