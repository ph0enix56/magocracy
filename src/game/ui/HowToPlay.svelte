<script lang="ts">
	import { howToPlayModalState } from './store/uiState';

	let state: { isOpen: boolean } = { isOpen: false };
	howToPlayModalState.subscribe(v => (state = v));

	let currentPane = 0;

	const panes = [
		{
			title: 'Welcome to Magocracy',
			content: `<p>Magocracy is a multiplayer strategy game where you build your magical city, manage resources, summon powerful armies and battle other players to gain <strong>Renown</strong>.</p>
			<p>Your goal is to become the most renowned leader. You achieve this by effectively managing your economy and making armies that defeat your opponents.</p>`
		},
		{
			title: 'Flow of play',
			content: `<p>The game progresses through repeating epochs, each consisting of three phases:</p>
			<ul>
				<li><strong>Advance Phase:</strong> Gather with other leaders and draft charters. Each charter gives you different bonuses to help you expand your city.</li>
				<li><strong>Build Phase:</strong> Your city produces resources, which you use to acquire new districts and upgrade existing ones. These provide resources or army units.</li>
				<li><strong>Fight Phase:</strong> Your summoned army engages in rounds of battles with other players' armies. Each round your army wins earns you Renown.</li>
			</ul>
			<p>The game ends after a number of epochs or when a player reaches enough Renown. Keep an eye on the Phase Timer at the bottom of the screen to know what's coming next!</p>
			<p>At any time, you can view other players' cities by clicking their card in the player list on the right side of the screen.</p>`
		},
		{
			title: 'City & Economy',
			content: `<p>Your city is formed by <strong>districts</strong> placed on a hexagonal grid. To build a district, you need its <strong>blueprint</strong> and enough resources, which include 🪵 wood, 🪨 stone and 🍞 food. Blueprints can be purchased in the <strong>Shop</strong> using 💧 mana, or drafted for free during the <strong>Advance Phase</strong>.</p>
			<p>Districts serve two purposes, as is indicated on their cards:<p>
			<ul>
				<li><strong>Production</strong> periodically provide resources during the <strong>Build Phase</strong>.</li>
				<li><strong>Army</strong> house army units that battle during the <strong>Fight Phase</strong>.</li>
			</ul>
			<p>In regular intervals during the Build Phase, a ⌛ time unit elapses, which triggers resource production and advances district construction and upgrade progress.</p>
			<p>Districts are sorted into tiers indicating their cost and power, as well as thematic <strong>Schools of Magic</strong>. District <strong>positioning</strong> matters! Pay attention to their effects, which often change power when adjacent to specific districts, or directly affect neighbors when placed.</p>
			<p>After the duration of the Build Phase elapses, as indicated on the timer, cities are frozen in time while other phases take place.`
		},
		{
			title: 'Army & Combat',
			content: `<p>In the <strong>Fight Phase</strong>, the army provided by your Army districts will clash with the armies of other leaders.</p>
			<p>Armies <strong>battle automatically</strong>, but you influence the outcome by changing the <strong>order of units</strong> before each round. The top of the list represents the front of your army, while units further down are further back. Each unit has different stats determining its role and optimal position.</p>
			<p>Units alternate attacking based on 🕓 Initiative. When it's the unit's turn, it uses its ⚡ Action Points to perform as many <strong>attacks</strong> from its attack list, top to bottom. The units picks an enemy to attack based on its targeting preference and range. <strong>Range</strong> is calculated as the number of units the attack has to go over. This means units with range 1 have to stand at the front to attack!</p>
			<p>Each attack deals certain damage, reduced by the target's 🛡️ Damage Reduction and then subtracted from its ❤️ Health Points. A unit with 0 HP is removed from battle.</p>
			<p>After each combat, your army is renewed to <strong>full strength</strong>, and you face a different opponent in the next round. Make sure to adapt your positioning! You gain <strong>Renown</strong> for each round where your army defeats all opposing units.</p>`
		}
	];

	function close() {
		howToPlayModalState.set({ isOpen: false });
		currentPane = 0;
	}

	function nextPane() {
		if (currentPane < panes.length - 1) {
			currentPane++;
		}
	}

	function prevPane() {
		if (currentPane > 0) {
			currentPane--;
		}
	}
</script>

{#if state.isOpen}
	<div class="ui-overlay" style="--ui-overlay-z: 110;">
		<div class="ui-modal modal">
			<div class="ui-modal-header">
				<h2 class="ui-modal-title">How To Play - {panes[currentPane]?.title ?? ''}</h2>
				<div class="header-actions">
					<button class="ui-close-btn" on:click={close}>X</button>
				</div>
			</div>

			<div class="content">
				<div class="pane-content">
					{@html panes[currentPane]?.content ?? ''}
				</div>
			</div>

			<div class="footer-actions">
				<button class="ui-button" disabled={currentPane === 0} on:click={prevPane}>Back</button>
				<div class="pane-indicator">
					{currentPane + 1} / {panes.length}
				</div>
				{#if currentPane < panes.length - 1}
					<button class="ui-button" on:click={nextPane}>Next</button>
				{:else}
					<button class="ui-button" on:click={close}>Close</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.modal {
		width: fit-content;
		max-width: min(800px, calc(100vw - var(--space-xl)));
		max-height: 80vh;
		display: flex;
		flex-direction: column;
	}

	.header-actions {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

	.content {
		padding: var(--space-lg) 24px;
		overflow-y: auto;
		flex-grow: 1;
	}

	.pane-content {
		font-size: 1.1rem;
		line-height: 1.6;
		color: var(--color-text);
	}

	.pane-content :global(p) {
		margin-bottom: var(--space-md);
	}

	.pane-content :global(ul) {
		margin-left: var(--space-lg);
		margin-bottom: var(--space-md);
	}

	.pane-content :global(li) {
		margin-bottom: var(--space-sm);
	}

	.footer-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-md) 24px;
		border-top: 1px solid var(--color-surface-4);
		background: rgba(0, 0, 0, 0.2);
	}

	.pane-indicator {
		font-weight: var(--font-weight-bold);
		color: var(--color-text-muted);
	}
</style>
