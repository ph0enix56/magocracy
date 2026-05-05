<script lang="ts">
	import { createResourceAmountState } from './store/resourceViewState';

	export let keyName: string;
	export let icon: string;
	$: valueState = createResourceAmountState(keyName);
</script>

<div class="ui-chip resource">
	<div class="icon">{icon}</div>
	<div class="value">{$valueState.toFixed(0)}</div>
</div>

<style>
	.icon {
		min-width: 20px;
		text-align: center;
	}
	.value {
		font-weight: var(--font-weight-semibold);
	}
</style>
