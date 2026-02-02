import { writable } from 'svelte/store';
import type { WorldMapPointUiView, WorldMapPoiSelectedUiView, WorldMapTravelUiView } from '../eventBus';

export type WorldMapUiState = {
	isOpen: boolean;
	points: WorldMapPointUiView[];
	selectedPoi: WorldMapPoiSelectedUiView | null;
	travel: WorldMapTravelUiView;
};

export const worldMapUiState = writable<WorldMapUiState>({
	isOpen: false,
	points: [],
	selectedPoi: null,
	travel: { status: 'idle' }
});
