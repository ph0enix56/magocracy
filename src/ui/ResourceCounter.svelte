<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { eventBus } from '../eventBus';

	export let keyName: string;
	export let icon: string;

	let value = 0;

	let unsubscribe: (() => void) | null = null;

	onMount(() => {
		unsubscribe = eventBus.subscribeGameToUi((event) => {
			if (event.type === 'resource-updated' && event.key === keyName) {
				value = event.value;
			}
		});
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});
</script>

<div class="ui-chip resource">
	<div class="icon">{icon}</div>
	<div class="value">{value}</div>
</div>

<style>
	.icon {
		min-width: 20px;
		text-align: center;
	}
	.value {
		font-weight: 600;
	}
</style>
