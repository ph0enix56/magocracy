<script lang="ts">
	import { onDestroy } from 'svelte';
	import { gameSessionState } from '../multiplayer/client/gameSessionStore';

	export let keyName: string;
	export let icon: string;

	let value = 0;

	const unsubscribe = gameSessionState.subscribe((state) => {
		value = state.resources[keyName] ?? 0;
	});

	onDestroy(() => {
		unsubscribe();
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
