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
	<div class="ui-overlay" style="--ui-overlay-z: 120;">
		<div class="ui-modal modal">
			<div class="ui-modal-header">
				<h2 class="ui-modal-title">Army</h2>
				<button class="ui-close-btn" on:click={close}>X</button>
			</div>

			<div class="list">
				{#if units.length === 0}
					<div class="empty ui-muted">No units yet. Build an army building.</div>
				{/if}

				{#each units as u, i (u.entityId)}
					<div class="unit-card">
						<div class="icon-container">
							<img class="unit-icon unit-icon--ally" src={`assets/${u.assetPath}`} alt={u.name} />
						</div>
						<div class="info">
							<div class="name-row">
								<div class="name">
									{u.name} <span class="lvl">Lv {u.trainingLevel}</span>
								</div>
								<div class="reorder">
									<button class="ui-button ui-button--tiny reorder-btn" disabled={i === 0} on:click={() => reorder(u.entityId, 'up')}>↑</button>
									<button
										class="ui-button ui-button--tiny reorder-btn"
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
									class="ui-button"
									disabled={u.trainingStatus === 'training' || pendingTrain !== null}
									on:click={() => train(u.entityId)}
								>
									{u.trainingStatus === 'training' ? 'Training…' : 'Train'}
								</button>
							</div>

							{#if u.trainingStatus === 'training'}
								<div class="ui-progress">
									<div class="ui-progress-fill" style={`width: ${u.trainingProgress}%`}></div>
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
	.modal {
		width: 720px;
		max-height: 80vh;
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

	.unit-icon--ally {
		filter: grayscale(0) sepia(1) hue-rotate(85deg) saturate(5) contrast(1) brightness(1);
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
		background: #444;
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: #fff;
		font-weight: 800;
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

	.ui-button {
		background: #4a9eff;
		font-weight: 700;
	}

	.ui-button:hover {
		background: #3a8eef;
	}

	.ui-progress {
		background: #222;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.ui-progress-fill {
		background: #00c26e;
	}
</style>
