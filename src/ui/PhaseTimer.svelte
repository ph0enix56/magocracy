<script lang="ts">
	import { phaseTimerState } from './projections/phaseTimerState';

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
		right: 0;
		bottom: 0;
		width: 465px;
		height: 130px;
		pointer-events: none;
	}

	.phase-timer-track {
		position: absolute;
		left: 0;
		right: 121px;
		top: 40px;
		height: 50px;
		border-radius: 4px;
		background: #333333;
		overflow: hidden;
	}

	.phase-timer-fill {
		position: absolute;
		right: 0;
		top: 3px;
		height: 44px;
		border-radius: 4px;
		transition: width 0.35s linear, background-color 0.25s ease;
	}

	.phase-timer-badge {
		position: absolute;
		right: 0;
		top: 0;
		width: 126px;
		height: 126px;
		border-radius: 999px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: Inter, system-ui, sans-serif;
		font-size: 49px;
		font-weight: 700;
		line-height: 1;
		background: #333333;
		border: 4px solid #5a5a5a;
		box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.92);
	}

	.phase-timer--default .phase-timer-fill {
		background: #d9c000;
	}

	.phase-timer--default .phase-timer-badge {
		color: #ffffff;
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
			transform: scale(0.9);
			transform-origin: bottom right;
			right: -16px;
			bottom: -12px;
		}
	}
</style>
