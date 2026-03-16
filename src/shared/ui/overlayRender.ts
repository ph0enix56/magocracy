export const OVERLAY_TOWN_VISIBILITY_EVENT = 'magocracy:overlay-town-visibility';
export const OVERLAY_BACKGROUND_EVENT = 'magocracy:overlay-background';

export type OverlayTownVisibility = {
	hideTownRender: boolean;
	};

export type OverlayBackground = {
	backgroundColor?: number;
};
