<script lang="ts">
	import { onDestroy } from 'svelte';
	import { combatModalState } from './store/uiState';
	import { combatPanelState } from './store/combatViewState';
	import { gameSessionClient } from '../client/gameSessionStore';

	let modal: { isOpen: boolean } = { isOpen: false };
	const unsubModal = combatModalState.subscribe(v => (modal = v));

	let state = {
		status: 'idle',
		round: 0,
		armyA: [],
		armyB: [],
		log: []
	} as any;
	const unsubCombat = combatPanelState.subscribe(v => (state = v.combat as any));
	let stepPending = false;
	let lastCombatOpenRequest = 0;

	const unsubCombatOpen = combatPanelState.subscribe((view) => {
		const requestId = view.combatOpenRequest;
		if (requestId <= lastCombatOpenRequest) return;
		lastCombatOpenRequest = requestId;
		combatModalState.set({ isOpen: true });
	});

	const unsubPhaseExitClose = combatPanelState.subscribe((view) => {
		if (!modal.isOpen) return;
		if (view.isFightPhase) return;
		combatModalState.set({ isOpen: false });
	});

	function close() {
		combatModalState.set({ isOpen: false });
	}

	async function step() {
		if (stepPending || !$combatPanelState.canCombatStep) return;
		stepPending = true;
		const result = await gameSessionClient.requestCombatStep(1);
		stepPending = false;
		if (!result.ok) {
			alert(result.reason);
		}
	}

	function hpPct(u: any): number {
		const max = u.maxHealth || 0;
		if (max <= 0) return 0;
		return Math.min(100, Math.max(0, (u.health / max) * 100));
	}

	onDestroy(() => {
		unsubModal();
		unsubCombat();
		unsubCombatOpen();
		unsubPhaseExitClose();
	});
</script>

{#if modal.isOpen}
	<div class="ui-overlay" style="--ui-overlay-z: 130;">
		<div class="ui-modal modal">
			<div class="ui-modal-header">
				<h2 class="ui-modal-title">Combat</h2>
				<div class="header-actions">
					<button class="ui-button" on:click={step} disabled={state.status !== 'running' || stepPending || !$combatPanelState.canCombatStep}>Next action</button>
					<button class="ui-close-btn" on:click={close}>X</button>
				</div>
			</div>
			{#if $combatPanelState.isScouting && $combatPanelState.viewedPlayerName}
				<div class="readonly-banner">Scouting {$combatPanelState.viewedPlayerName}. Combat controls are disabled.</div>
			{/if}

			<div class="meta">
				<div>Status: <strong>{state.status}</strong></div>
				<div>Round: <strong>{state.round}</strong></div>
				{#if state.status === 'finished'}
					<div>Winner: <strong>{state.winner}</strong></div>
				{/if}
			</div>

			<div class="content">
				<div class="armies">
					<div class="army">
						<h3>Your army</h3>
						{#if state.armyA.length === 0}
							<div class="empty">(empty)</div>
						{/if}
						{#each state.armyA as u, idx (idx)}
							<div class="unit">
								<div class="unit-left">
									<div class="pos">{idx + 1}</div>
									<img class="icon icon--ally" src={"assets/" + u.assetPath} alt={u.name} />
								</div>
								<div class="unit-mid">
									<div class="name">{u.name}</div>
									<div class="hp-text">HP {u.health}/{u.maxHealth}</div>
									<div class="hp-bar"><div class="hp-fill" style={"width:" + hpPct(u) + "%"}></div></div>
								</div>
							</div>
						{/each}
					</div>

					<div class="army">
						<h3>Opponent's army</h3>
						{#if state.armyB.length === 0}
							<div class="empty">(empty)</div>
						{/if}
						{#each state.armyB as u, idx (idx)}
							<div class="unit">
								<div class="unit-left">
									<div class="pos">{idx + 1}</div>
									<img class="icon icon--enemy" src={"assets/" + u.assetPath} alt={u.name} />
								</div>
								<div class="unit-mid">
									<div class="name">{u.name}</div>
									<div class="hp-text">HP {u.health}/{u.maxHealth}</div>
									<div class="hp-bar"><div class="hp-fill" style={"width:" + hpPct(u) + "%"}></div></div>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<div class="log">
					<h3>Log</h3>
					<div class="log-box">
						{#if state.log.length === 0}
							<div class="log-empty">No actions yet.</div>
						{/if}
						{#each state.log.slice(-10) as e (e.seq)}
							<div class="log-line">{e.text}</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal {
		width: 980px;
		max-height: 85vh;
	}

	.header-actions {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}



	.meta {
		padding: 10px var(--space-lg);
		display: flex;
		gap: var(--space-lg);
		flex-wrap: wrap;
		border-bottom: 1px solid var(--color-border-subtle);
		color: var(--color-text-dim);
		font-size: 0.95rem;
	}

	.readonly-banner {
		padding: 10px var(--space-lg) 0;
		color: var(--color-accent-orange);
		font-size: 0.9rem;
	}

	.content {
		padding: var(--space-lg);
		overflow: auto;
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-lg);
	}

	.armies {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-lg);
	}

	.army {
		background: var(--color-surface-3);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-md);
		padding: var(--space-md);
		min-height: 160px;
	}

	.army h3 {
		margin: 0 0 10px 0;
		font-size: 1rem;
	}

	.unit {
		display: grid;
		grid-template-columns: 92px 1fr;
		gap: 10px;
		align-items: center;
		padding: var(--space-sm);
		border-radius: var(--radius-md);
		background: var(--color-surface-trans-18);
		border: 1px solid rgba(255, 255, 255, 0.06);
		margin-bottom: var(--space-sm);
	}

	.unit-left {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

	.pos {
		width: 26px;
		height: 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-surface-1);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-sm);
		font-weight: var(--font-weight-extrabold);
	}

	.icon {
		width: 44px;
		height: 44px;
		background: var(--color-surface-1);
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border-subtle);
		object-fit: contain;
		padding: var(--space-xs);
	}

	.icon--ally {
		filter: grayscale(0) sepia(1) hue-rotate(85deg) saturate(5) contrast(1) brightness(1);
	}

	.icon--enemy {
		filter: grayscale(0) sepia(1) hue-rotate(-20deg) saturate(5) contrast(1) brightness(1);
	}

	.name {
		font-weight: var(--font-weight-extrabold);
	}

	.hp-text {
		color: var(--color-text-dim);
		font-size: 0.9rem;
		margin-top: 2px;
	}

	.hp-bar {
		width: 100%;
		height: 10px;
		background: var(--color-surface-1);
		border-radius: var(--radius-pill);
		overflow: hidden;
		border: 1px solid var(--color-border-subtle);
		margin-top: 6px;
	}

	.hp-fill {
		height: 100%;
		background: var(--color-accent-green);
		transition: width 0.15s linear;
	}

	.empty {
		color: #bbb;
		font-size: 0.9rem;
	}

	.log {
		background: var(--color-surface-3);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-md);
		padding: var(--space-md);
	}

	.log h3 {
		margin: 0 0 10px 0;
		font-size: 1rem;
	}

	.log-box {
		background: var(--color-surface-1);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-md);
		padding: 10px;
		max-height: 260px;
		overflow: auto;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: #e8e8e8;
	}

	.log-line {
		padding: 2px 0;
		white-space: pre-wrap;
	}

	.log-empty {
		color: #bbb;
	}
</style>
