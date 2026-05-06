<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { GAME_SETTINGS_LIMITS } from '../../shared/multiplayer/gameSettingsLimits';
	import type { GameSettings } from '../../shared/multiplayer/snapshots';

	export let settings: GameSettings;
	export let isHost: boolean;

	const dispatch = createEventDispatcher<{ apply: GameSettings }>();
	const L = GAME_SETTINGS_LIMITS;

	let draftSecondsPerPick = settings.advancePhase.secondsPerPick;
	let draftRevealSeconds = settings.advancePhase.revealSecondsAfterDraft;
	let draftBuildDuration = settings.buildPhase.durationSeconds;
	let draftBuildSecondsPerTick = settings.buildPhase.secondsPerTick;
	let draftSecondsPerRound = settings.fightPhase.secondsPerRound;
	let draftFinalResultsSeconds = settings.fightPhase.finalResultsSeconds;
	let draftTargetRenown = settings.gameLifecycle.targetRenown;

	// Keep drafts in sync when settings prop changes from outside
	$: {
		draftSecondsPerPick = settings.advancePhase.secondsPerPick;
		draftRevealSeconds = settings.advancePhase.revealSecondsAfterDraft;
		draftBuildDuration = settings.buildPhase.durationSeconds;
		draftBuildSecondsPerTick = settings.buildPhase.secondsPerTick;
		draftSecondsPerRound = settings.fightPhase.secondsPerRound;
		draftFinalResultsSeconds = settings.fightPhase.finalResultsSeconds;
		draftTargetRenown = settings.gameLifecycle.targetRenown;
	}

	function apply() {
		const next: GameSettings = {
			advancePhase: {
				secondsPerPick: Math.max(L.advancePhase.secondsPerPick.min, Math.floor(draftSecondsPerPick)),
				revealSecondsAfterDraft: Math.max(L.advancePhase.revealSecondsAfterDraft.min, Math.floor(draftRevealSeconds))
			},
			buildPhase: {
				durationSeconds: Math.max(L.buildPhase.durationSeconds.min, Math.floor(draftBuildDuration)),
				secondsPerTick: Math.max(L.buildPhase.secondsPerTick.min, Math.floor(draftBuildSecondsPerTick))
			},
			fightPhase: {
				secondsPerRound: Math.max(L.fightPhase.secondsPerRound.min, Math.floor(draftSecondsPerRound)),
				finalResultsSeconds: Math.max(L.fightPhase.finalResultsSeconds.min, Math.floor(draftFinalResultsSeconds))
			},
			gameLifecycle: {
				targetRenown: Math.max(L.gameLifecycle.targetRenown.min, Math.floor(draftTargetRenown))
			},
			economy: settings.economy
		};
		dispatch('apply', next);
	}
</script>

<div class="settings-body">
	<div class="settings-group-label">Advance Phase</div>
	<div class="settings-row">
		<span class="settings-label">Seconds / Pick</span>
		{#if isHost}
			<input
				class="settings-input"
				type="number"
				min={L.advancePhase.secondsPerPick.min}
				max={L.advancePhase.secondsPerPick.max}
				bind:value={draftSecondsPerPick}
			/>
		{:else}
			<span class="settings-value">{settings.advancePhase.secondsPerPick}s</span>
		{/if}
	</div>
	<div class="settings-row">
		<span class="settings-label">End Reveal Length (s)</span>
		{#if isHost}
			<input
				class="settings-input"
				type="number"
				min={L.advancePhase.revealSecondsAfterDraft.min}
				max={L.advancePhase.revealSecondsAfterDraft.max}
				bind:value={draftRevealSeconds}
			/>
		{:else}
			<span class="settings-value">{settings.advancePhase.revealSecondsAfterDraft}s</span>
		{/if}
	</div>

	<div class="settings-group-label">Build Phase</div>
	<div class="settings-row">
		<span class="settings-label">Phase Duration (s)</span>
		{#if isHost}
			<input
				class="settings-input"
				type="number"
				min={L.buildPhase.durationSeconds.min}
				max={L.buildPhase.durationSeconds.max}
				bind:value={draftBuildDuration}
			/>
		{:else}
			<span class="settings-value">{settings.buildPhase.durationSeconds}s</span>
		{/if}
	</div>
	<div class="settings-row">
		<span class="settings-label">Time Unit Length (s)</span>
		{#if isHost}
			<input
				class="settings-input"
				type="number"
				min={L.buildPhase.secondsPerTick.min}
				max={L.buildPhase.secondsPerTick.max}
				bind:value={draftBuildSecondsPerTick}
			/>
		{:else}
			<span class="settings-value">{settings.buildPhase.secondsPerTick}s</span>
		{/if}
	</div>

	<div class="settings-group-label">Fight Phase</div>
	<div class="settings-row">
		<span class="settings-label">Seconds / Round</span>
		{#if isHost}
			<input
				class="settings-input"
				type="number"
				min={L.fightPhase.secondsPerRound.min}
				max={L.fightPhase.secondsPerRound.max}
				bind:value={draftSecondsPerRound}
			/>
		{:else}
			<span class="settings-value">{settings.fightPhase.secondsPerRound}s</span>
		{/if}
	</div>
	<div class="settings-row">
		<span class="settings-label">End Results Display Length (s)</span>
		{#if isHost}
			<input
				class="settings-input"
				type="number"
				min={L.fightPhase.finalResultsSeconds.min}
				max={L.fightPhase.finalResultsSeconds.max}
				bind:value={draftFinalResultsSeconds}
			/>
		{:else}
			<span class="settings-value">{settings.fightPhase.finalResultsSeconds}s</span>
		{/if}
	</div>

	<div class="settings-group-label">Win Condition</div>
	<div class="settings-row">
		<span class="settings-label">Target Renown</span>
		{#if isHost}
			<input
				class="settings-input"
				type="number"
				min={L.gameLifecycle.targetRenown.min}
				max={L.gameLifecycle.targetRenown.max}
				bind:value={draftTargetRenown}
			/>
		{:else}
			<span class="settings-value">{settings.gameLifecycle.targetRenown}</span>
		{/if}
	</div>

	{#if isHost}
		<button class="ui-button settings-apply-btn" on:click={apply}>Apply Settings</button>
	{/if}
</div>

<style>
	.settings-body {
		padding: 10px 12px 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.settings-group-label {
		font-size: var(--ui-font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		opacity: 0.5;
		margin-top: 8px;
		margin-bottom: 2px;
	}
	.settings-group-label:first-child {
		margin-top: 0;
	}
	.settings-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-sm);
		font-size: var(--ui-font-size-sm);
	}
	.settings-label {
		opacity: 0.8;
		flex: 1;
	}
	.settings-input {
		width: 72px;
		height: 28px;
		box-sizing: border-box;
		padding: 0 8px;
		border-radius: var(--radius-sm);
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: rgba(0, 0, 0, 0.35);
		color: var(--color-text-light);
		font: inherit;
		font-size: var(--ui-font-size-sm);
		text-align: right;
		appearance: textfield;
	}
	.settings-input::-webkit-outer-spin-button,
	.settings-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.settings-value {
		opacity: 0.7;
		font-size: var(--ui-font-size-sm);
		min-width: 40px;
		text-align: right;
	}
	.settings-apply-btn {
		margin-top: var(--space-sm);
		width: 100%;
	}
</style>
