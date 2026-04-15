export function isUiInputTarget(target: EventTarget | null | undefined): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return !!target.closest('#ui-root');
}

export function isAnyUiModalOpen(): boolean {
	if (typeof document === 'undefined') return false;
	// Covers standard modal overlays and native HTML dialog top-layer usage.
	return !!document.querySelector('#ui-root .ui-overlay, dialog[open]');
}

export function shouldBlockGameInput(target: EventTarget | null | undefined): boolean {
	return isUiInputTarget(target) || isAnyUiModalOpen();
}
