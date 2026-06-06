<script lang="ts">
	/**
	 * Twemoji component to render SVG emojis from /assets/twemoji
	 */
	export let code: string;
	export let size: string = '1em';
</script>

<img
	class="twemoji"
	src="assets/twemoji/{code}.svg"
	alt=""
	aria-hidden="true"
	style="width: {size}; height: {size}; vertical-align: -0.125em; display: inline-block;"
/>
