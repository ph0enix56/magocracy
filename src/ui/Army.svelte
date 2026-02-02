<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { eventBus } from '../eventBus';
	import { armyModalState } from './uiState';
	import { armyState } from './gameState';

	let state: { isOpen: boolean } = { isOpen: false };
	armyModalState.subscribe(v => (state = v));

	let units = [] as any[];
	armyState.subscribe(v => (units = v));

	let pendingTrain: string | null = null;
	let unsubscribe: (() => void) | null = null;

	function close() {
		armyModalState.set({ isOpen: false });
		pendingTrain = null;
	}

	function formatCost(cost: Record<string, number>): string {
		return Object.entries(cost)
			.map(([res, amount]) => `${amount} ${res}`)
			.join(', ');
	}

	function train(unitEntityId: string) {
		if (pendingTrain) return;
		pendingTrain = unitEntityId;
		eventBus.publishUiToGame({ type: 'army-train-requested', unitEntityId });
	}

	function reorder(unitEntityId: string, direction: 'up' | 'down') {
		eventBus.publishUiToGame({ type: 'army-reorder-requested', unitEntityId, direction });
	}

	onMount(() => {
		unsubscribe = eventBus.subscribeGameToUi((event) => {
			if (event.type !== 'army-action-result') return;
			if (event.action === 'train') {
				pendingTrain = null;
				if (!event.ok && event.reason) alert(event.reason);
				return;
			}
			if (event.action === 'reorder') {
				if (!event.ok && event.reason) alert(event.reason);
				return;
			}
		});
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});
</script>

{#if state.isOpen}
	<div class="overlay">
		<div class="modal">
			<div class="header">
				<h2>Army</h2>
				<button class="close-btn" on:click={close}>X</button>
			</div>

			<div class="list">
				{#if units.length === 0}
					<div class="empty">No units yet. Build an army building.</div>
				{/if}

				{#each units as u, i (u.entityId)}
					<div class="unit-card">
						<div class="icon-container">
							<img src={`assets/${u.assetPath}`} alt={u.name} />
						</div>
						<div class="info">
							<div class="name-row">
								<div class="name">
									{u.name} <span class="lvl">Lv {u.trainingLevel}</span>
								</div>
								<div class="reorder">
									<button class="reorder-btn" disabled={i === 0} on:click={() => reorder(u.entityId, 'up')}>↑</button>
									<button
										class="reorder-btn"
										disabled={i === units.length - 1}
										on:click={() => reorder(u.entityId, 'down')}
									>
										↓
									</button>
								</div>
							</div>
							<div class="stats">
								<span>HP: {u.health}</span>
								<span>DR: {u.drFlat} + {u.drPercent}%</span>
								<span>Actions/turn: {u.actionsPerTurn}</span>
							</div>

							<div class="train-row">
								<div class="train-meta">
									<div>Train cost: {formatCost(u.nextTrainCost)}</div>
									<div>Train time: {u.trainTime}s</div>
								</div>
								<button
									disabled={u.trainingStatus === 'training' || pendingTrain !== null}
									on:click={() => train(u.entityId)}
								>
									{u.trainingStatus === 'training' ? 'Training…' : 'Train'}
								</button>
							</div>

							{#if u.trainingStatus === 'training'}
								<div class="progress-container">
									<div class="progress-bar" style={`width: ${u.trainingProgress}%`}></div>
								</div>
							{/if}
						</div>
					</div>
				{/each}
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
		z-index: 120;
	}

	.modal {
		background: #2a2a2a;
		color: #fff;
		width: 720px;
		max-height: 80vh;
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
		border: 1px solid #444;
	}

	.header {
		padding: 16px;
		border-bottom: 1px solid #444;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.header h2 {
		margin: 0;
		font-size: 1.2rem;
	}

	.close-btn {
		background: none;
		border: none;
		color: #aaa;
		cursor: pointer;
		font-size: 1.2rem;
	}

	.list {
		padding: 16px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.empty {
		padding: 12px;
		color: #ccc;
	}

	.unit-card {
		display: flex;
		gap: 16px;
		align-items: center;
		background: #333;
		border-radius: 6px;
		padding: 12px;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.icon-container {
		width: 64px;
		height: 64px;
		background: #222;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.icon-container img {
		max-width: 100%;
		max-height: 100%;
	}

	.info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.name {
		font-weight: 700;
		font-size: 1.05rem;
	}

	.name-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.reorder {
		display: flex;
		gap: 6px;
		flex-shrink: 0;
	}

	.reorder-btn {
		padding: 4px 8px;
		background: #444;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 4px;
		color: #fff;
		font-weight: 800;
		cursor: pointer;
		line-height: 1;
	}

	.reorder-btn:hover {
		background: #555;
	}

	.reorder-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.lvl {
		margin-left: 8px;
		font-weight: 600;
		color: #ffd700;
		font-size: 0.9rem;
	}

	.stats {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		font-size: 0.9rem;
		color: #ddd;
	}

	.train-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		margin-top: 4px;
	}

	.train-meta {
		font-size: 0.85rem;
		color: #bbb;
	}

	button {
		padding: 8px 14px;
		background: #4a9eff;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 700;
	}

	button:hover {
		background: #3a8eef;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.progress-container {
		width: 100%;
		height: 10px;
		background: #222;
		border-radius: 999px;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.progress-bar {
		height: 100%;
		background: #00c26e;
		transition: width 0.2s linear;
	}
</style>
