<script lang="ts">
	import { phaseTimerState } from './store/phaseTimerState';

	const CRITICAL_RATIO_THRESHOLD = 0.1;

	function formatTimer(seconds: number): string {
		const total = Math.max(0, Math.floor(seconds));
		const minutes = Math.floor(total / 60);
		const remainder = (total % 60).toString().padStart(2, '0');
		return `${minutes}:${remainder}`;
	}

	$: timer = $phaseTimerState;
	$: progressRatio = timer.totalSeconds <= 0
		? 0
		: Math.min(1, Math.max(0, timer.remainingSeconds / timer.totalSeconds));
	$: isCritical = !timer.isInactive && progressRatio > 0 && progressRatio <= CRITICAL_RATIO_THRESHOLD;
	$: variantClass = timer.isInactive ? 'phase-timer--inactive' : isCritical ? 'phase-timer--critical' : 'phase-timer--default';
</script>

{#if timer.visible}
	<div class={`phase-timer ${variantClass}`} aria-label="Phase timer">
		<div class="phase-timer-track">
			<div class="phase-timer-fill" style={`width: ${(progressRatio * 100).toFixed(2)}%`}></div>
		</div>
		<div class="phase-timer-badge">
			{formatTimer(timer.remainingSeconds)}
		</div>
	</div>
{/if}

<style>
	.phase-timer {
		position: absolute;
		right: var(--ui-edge-right, var(--space-lg));
		bottom: var(--ui-edge-bottom, var(--space-md));
		width: 352px;
		height: 96px;
		pointer-events: none;
	}

	.phase-timer-track {
		position: absolute;
		left: 0;
		right: 94px;
		top: 30px;
		height: 34px;
		border-radius: var(--radius-sm);
		background: var(--color-surface-3);
		overflow: hidden;
	}

	.phase-timer-fill {
		position: absolute;
		right: 0;
		top: 2px;
		height: 30px;
		border-radius: var(--radius-sm);
		transition: width 0.35s linear, background-color 0.25s ease;
	}

	.phase-timer-badge {
		position: absolute;
		right: 0;
		top: 2px;
		width: 92px;
		height: 92px;
		border-radius: var(--radius-pill);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: var(--ui-font-size-display);
		font-weight: var(--font-weight-bold);
		line-height: 1;
		background: var(--color-surface-3);
		border: 3px solid #5a5a5a;
		box-shadow: inset 0 0 0 2px var(--color-outline-focus);
	}

	.phase-timer--default .phase-timer-fill {
		background: #d9c000;
	}

	.phase-timer--default .phase-timer-badge {
		color: var(--color-text-light);
	}

	.phase-timer--critical .phase-timer-fill {
		background: #d94100;
	}

	.phase-timer--critical .phase-timer-badge {
		color: #ff9292;
		box-shadow: inset 0 0 0 2px #ff8f8f;
	}

	.phase-timer--inactive .phase-timer-fill {
		background: #a5a5a5;
	}

	.phase-timer--inactive .phase-timer-badge {
		color: #a5a5a5;
		box-shadow: inset 0 0 0 2px rgba(190, 190, 190, 0.92);
	}

	@media (max-width: 1200px) {
		.phase-timer {
			transform: scale(0.92);
			transform-origin: bottom right;
			right: calc(var(--ui-edge-right, var(--space-lg)) - var(--space-sm));
			bottom: calc(var(--ui-edge-bottom, var(--space-md)) - var(--space-sm));
		}
	}
</style>
