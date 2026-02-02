<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { eventBus } from '../eventBus';
	import { combatModalState } from './uiState';
	import { combatState } from './gameState';

	let modal: { isOpen: boolean } = { isOpen: false };
	const unsubModal = combatModalState.subscribe(v => (modal = v));

	let state = {
		status: 'idle',
		round: 0,
		activeSide: 'armyA',
		armyA: [],
		armyB: [],
		log: []
	} as any;
	const unsubCombat = combatState.subscribe(v => (state = v as any));

	let unsubscribeResult: (() => void) | null = null;

	function close() {
		combatModalState.set({ isOpen: false });
	}

	function step() {
		eventBus.publishUiToGame({ type: 'combat-step-requested', steps: 1 });
	}

	function hpPct(u: any): number {
		const max = u.maxHealth || 0;
		if (max <= 0) return 0;
		return Math.min(100, Math.max(0, (u.health / max) * 100));
	}

	onMount(() => {
		unsubscribeResult = eventBus.subscribeGameToUi((event) => {
			if (event.type === 'combat-action-result') {
				if (!event.ok && event.reason) alert(event.reason);
				return;
			}
			if (event.type === 'combat-ui-open') {
				combatModalState.set({ isOpen: true });
				return;
			}
		});
	});

	onDestroy(() => {
		unsubModal();
		unsubCombat();
		if (unsubscribeResult) unsubscribeResult();
	});
</script>

{#if modal.isOpen}
	<div class="overlay">
		<div class="modal">
			<div class="header">
				<h2>Combat</h2>
				<div class="header-actions">
					<button on:click={step} disabled={state.status !== 'running'}>Next action</button>
					<button class="close" on:click={close}>X</button>
				</div>
			</div>

			<div class="meta">
				<div>Status: <strong>{state.status}</strong></div>
				<div>Round: <strong>{state.round}</strong></div>
				<div>Active: <strong>{state.activeSide}</strong></div>
				{#if state.status === 'finished'}
					<div>Winner: <strong>{state.winner}</strong></div>
				{/if}
			</div>

			<div class="content">
				<div class="armies">
					<div class="army">
						<h3>Army A</h3>
						{#if state.armyA.length === 0}
							<div class="empty">(empty)</div>
						{/if}
						{#each state.armyA as u, idx (idx)}
							<div class="unit">
								<div class="unit-left">
									<div class="pos">{idx + 1}</div>
									<img class="icon" src={"assets/" + u.assetPath} alt={u.name} />
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
						<h3>Army B</h3>
						{#if state.armyB.length === 0}
							<div class="empty">(empty)</div>
						{/if}
						{#each state.armyB as u, idx (idx)}
							<div class="unit">
								<div class="unit-left">
									<div class="pos">{idx + 1}</div>
									<img class="icon" src={"assets/" + u.assetPath} alt={u.name} />
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
						{#each state.log as e (e.seq)}
							<div class="log-line">{e.text}</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: auto;
		z-index: 130;
	}

	.modal {
		background: #2a2a2a;
		color: #fff;
		width: 980px;
		max-height: 85vh;
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
		border: 1px solid #444;
	}

	.header {
		padding: 12px 16px;
		border-bottom: 1px solid #444;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.header h2 {
		margin: 0;
		font-size: 1.2rem;
	}

	.header-actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	button {
		padding: 6px 10px;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 4px;
		cursor: pointer;
		font-family: system-ui, sans-serif;
	}

	button:hover {
		background: rgba(0, 0, 0, 0.75);
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	button.close {
		background: none;
		border: none;
		color: #aaa;
		font-weight: 700;
		padding: 0 6px;
	}

	.meta {
		padding: 10px 16px;
		display: flex;
		gap: 16px;
		flex-wrap: wrap;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		color: #ddd;
		font-size: 0.95rem;
	}

	.content {
		padding: 16px;
		overflow: auto;
		display: grid;
		grid-template-columns: 1fr;
		gap: 16px;
	}

	.armies {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.army {
		background: #333;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 6px;
		padding: 12px;
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
		padding: 8px;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.18);
		border: 1px solid rgba(255, 255, 255, 0.06);
		margin-bottom: 8px;
	}

	.unit-left {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.pos {
		width: 26px;
		height: 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #222;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		font-weight: 800;
	}

	.icon {
		width: 44px;
		height: 44px;
		background: #222;
		border-radius: 4px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		object-fit: contain;
		padding: 4px;
	}

	.name {
		font-weight: 800;
	}

	.hp-text {
		color: #ddd;
		font-size: 0.9rem;
		margin-top: 2px;
	}

	.hp-bar {
		width: 100%;
		height: 10px;
		background: #222;
		border-radius: 999px;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.08);
		margin-top: 6px;
	}

	.hp-fill {
		height: 100%;
		background: #00c26e;
		transition: width 0.15s linear;
	}

	.empty {
		color: #bbb;
		font-size: 0.9rem;
	}

	.log {
		background: #333;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 6px;
		padding: 12px;
	}

	.log h3 {
		margin: 0 0 10px 0;
		font-size: 1rem;
	}

	.log-box {
		background: #222;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 6px;
		padding: 10px;
		max-height: 260px;
		overflow: auto;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
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
