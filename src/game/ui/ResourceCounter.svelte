<script lang="ts">
	import { createResourceAmountState } from './store/resourceViewState';
	import Twemoji from './Twemoji.svelte';

	export let keyName: string;
	export let code: string;
	$: valueState = createResourceAmountState(keyName);
</script>

<div class="ui-chip resource">
	<div class="icon"><Twemoji {code} size="1.2em" /></div>
	<div class="value">{$valueState.toFixed(0)}</div>
</div>

<style>
	.resource {
		font-size: 1.2rem; /* 1.5x of 0.9rem */
		padding: var(--space-xs) var(--space-md);
		gap: 12px;
	}
	.icon {
		min-height: 30px;
		text-align: center;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.value {
		font-weight: var(--font-weight-semibold);
		line-height: 1;
	}
</style>
