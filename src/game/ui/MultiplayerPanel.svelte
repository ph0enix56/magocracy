<script lang="ts">
	import { multiplayerClient } from '../client/clientSingleton';
	import { gameSessionState } from '../client/gameSessionStore';
	import type { GameSettings } from '../../shared/multiplayer/snapshots';
	import LobbySettingsForm from './LobbySettingsForm.svelte';
	import { howToPlayModalState } from './store/uiState';

	$: selfPlayer = $gameSessionState.lobby?.players.find((player) => player.playerId === $gameSessionState.playerId) ?? null;
	$: inMatch = $gameSessionState.lobby?.status === 'in-game' || !!$gameSessionState.game;
	$: isConnected = $gameSessionState.connectionStatus === 'connected';
	$: statusLabel = isConnected ? 'Online' : 'Offline';
	$: isHost = selfPlayer?.isHost ?? false;
	$: lobbySettings = $gameSessionState.lobby?.settings ?? null;

	let nameDraft = '';
	let joinLobbyIdDraft = '';

	$: {
		if (!nameDraft && $gameSessionState.playerName) {
			nameDraft = $gameSessionState.playerName;
		}
	}

	function connectMultiplayer() { multiplayerClient.connect(); }
	function disconnectMultiplayer() { multiplayerClient.disconnect(); }
	function renamePlayer() {
		const next = nameDraft.trim();
		if (!next) return;
		multiplayerClient.setPlayerName(next);
	}
	function createLobby() { multiplayerClient.createLobby(); }
	function joinLobby() {
		const lobbyId = joinLobbyIdDraft.trim();
		if (!lobbyId) return;
		multiplayerClient.joinLobby(lobbyId);
	}
	function leaveLobby() { multiplayerClient.leaveLobby(); }
	function toggleReady() {
		if (!selfPlayer) return;
		multiplayerClient.setReady(!selfPlayer.isReady);
	}
	function startLobbyGame() { multiplayerClient.startLobbyGame(); }

	let settingsOpen = false;

	function handleSettingsApply(event: CustomEvent<GameSettings>) {
		multiplayerClient.configureLobby(event.detail);
	}

	function openHowToPlay() {
		howToPlayModalState.set({ isOpen: true });
	}
</script>

{#if !inMatch}
	<div class="multiplayer-panel ui-panel">
		<div class="multiplayer-header">
			<div>
				<div class="multiplayer-title">Magocracy</div>
				<div class="multiplayer-subtitle">Multiplayer Lobby</div>
			</div>
			<button class="how-to-play-btn" on:click={openHowToPlay} title="How to Play">?</button>
		</div>

		<div class="multiplayer-row multiplayer-row--status">
			<span>Status</span>
			<span>{statusLabel}</span>
		</div>

		{#if !isConnected}
			<div class="multiplayer-field-row">
				<input
					class="multiplayer-input"
					type="text"
					maxlength="24"
					bind:value={nameDraft}
					placeholder="Player name"
				/>
				<button class="ui-button" on:click={renamePlayer}>Rename</button>
			</div>
		{/if}

		{#if $gameSessionState.connectionStatus !== 'connected'}
			<div class="multiplayer-actions">
				<button class="ui-button" on:click={connectMultiplayer}>Connect</button>
			</div>
		{:else if !$gameSessionState.lobby}
			<div class="multiplayer-actions">
				<button class="ui-button" on:click={createLobby}>Create Lobby</button>
			</div>
			<div class="multiplayer-field-row">
				<input
					class="multiplayer-input"
					type="text"
					bind:value={joinLobbyIdDraft}
					placeholder="Lobby ID"
				/>
				<button class="ui-button ui-button--ghost" on:click={joinLobby}>Join Lobby</button>
			</div>
			<div class="multiplayer-actions">
				<button class="ui-button ui-button--ghost" on:click={disconnectMultiplayer}>Disconnect</button>
			</div>
		{:else}
			<div class="multiplayer-row">
				<span>Lobby {$gameSessionState.lobby.lobbyId}</span>
				<span>{$gameSessionState.lobby.players.length}/{$gameSessionState.lobby.maxPlayers}</span>
			</div>

			<div class="multiplayer-players">
				{#each $gameSessionState.lobby.players as player (player.playerId)}
					<div class="multiplayer-player-row">
						<span class="multiplayer-player-name">{player.name}{player.playerId === $gameSessionState.playerId ? ' (You)' : ''}</span>
						<span class={`multiplayer-player-state ${player.isReady ? 'is-ready' : 'is-waiting'}`}>
							{player.isReady ? 'Ready' : 'Waiting'}
						</span>
						{#if player.isHost}
							<span class="multiplayer-host-badge">Host</span>
						{/if}
					</div>
				{/each}
			</div>

			{#if lobbySettings}
				<div class="settings-section">
					<button class="settings-toggle" on:click={() => (settingsOpen = !settingsOpen)}>
						<span>Game Settings</span>
						<span class="settings-toggle-arrow" class:open={settingsOpen}>▾</span>
					</button>
					{#if settingsOpen}
						<LobbySettingsForm settings={lobbySettings} {isHost} on:apply={handleSettingsApply} />
					{/if}
				</div>
			{/if}

			<div class="multiplayer-actions">
				<button class="ui-button" on:click={toggleReady}>{selfPlayer?.isReady ? 'Unready' : 'Ready'}</button>
				<button class="ui-button ui-button--ghost" on:click={leaveLobby}>Leave</button>
			</div>

			{#if selfPlayer?.isHost}
				<button class="ui-button multiplayer-start" on:click={startLobbyGame} disabled={$gameSessionState.lobby.status !== 'open'}>
					Start Match
				</button>
			{/if}
		{/if}

		{#if $gameSessionState.lastError}
			<div class="multiplayer-error">{$gameSessionState.lastError}</div>
		{/if}
	</div>
{/if}

<style>
	.multiplayer-panel {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(580px, calc(100vw - 32px));
		padding: var(--space-lg);
		pointer-events: auto;
	}
	.multiplayer-title {
		font-size: var(--ui-font-size-xl);
		font-weight: var(--font-weight-extrabold);
		margin-bottom: var(--space-xs);
	}
	.multiplayer-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--space-sm);
	}
	.how-to-play-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.4);
		background: rgba(0, 0, 0, 0.6);
		color: white;
		font-weight: bold;
		font-size: 1.2rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}
	.how-to-play-btn:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: white;
	}
	.multiplayer-subtitle {
		font-size: var(--ui-font-size-md);
		opacity: 0.75;
	}
	.multiplayer-row {
		display: flex;
		justify-content: space-between;
		gap: var(--space-sm);
		font-size: var(--ui-font-size-sm);
		margin-bottom: 6px;
	}
	.multiplayer-row--status {
		margin-bottom: 10px;
	}
	.multiplayer-field-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-sm);
		margin-bottom: 10px;
	}
	.multiplayer-input {
		height: 36px;
		box-sizing: border-box;
		padding: 0 10px;
		border-radius: var(--radius-sm);
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: rgba(0, 0, 0, 0.45);
		color: var(--color-text-light);
		font: inherit;
	}
	.multiplayer-input::placeholder { opacity: 0.7; }
	.multiplayer-actions {
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-sm);
	}
	.multiplayer-actions .ui-button,
	.multiplayer-start { flex: 1; }
	.multiplayer-error {
		font-size: var(--ui-font-size-xs);
		color: #ffb3b3;
		margin-top: 10px;
	}
	.multiplayer-players {
		margin-top: var(--space-sm);
		padding: 10px;
		border-radius: var(--radius-md);
		background: rgba(0, 0, 0, 0.25);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}
	.multiplayer-player-row {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: var(--space-sm);
		align-items: center;
		font-size: var(--ui-font-size-sm);
	}
	.multiplayer-player-name {
		font-weight: var(--font-weight-semibold);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.multiplayer-player-state {
		font-size: var(--ui-font-size-xs);
		padding: 2px var(--space-sm);
		border-radius: var(--radius-pill);
		border: 1px solid rgba(255, 255, 255, 0.2);
	}
	.multiplayer-player-state.is-ready { background: rgba(37, 140, 83, 0.3); }
	.multiplayer-player-state.is-waiting { background: rgba(140, 97, 37, 0.3); }
	.multiplayer-host-badge {
		font-size: var(--ui-font-size-xs);
		padding: 2px 7px;
		border-radius: var(--radius-pill);
		background: rgba(72, 130, 201, 0.35);
	}
	.multiplayer-start {
		margin-top: 10px;
		width: 100%;
	}
	.settings-section {
		margin-top: var(--space-sm);
		border-radius: var(--radius-md);
		border: 1px solid rgba(255, 255, 255, 0.1);
		overflow: hidden;
	}
	.settings-toggle {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		background: rgba(255, 255, 255, 0.06);
		border: none;
		color: var(--color-text-light);
		font: inherit;
		font-size: var(--ui-font-size-sm);
		font-weight: var(--font-weight-semibold);
		cursor: pointer;
		text-align: left;
		pointer-events: auto;
	}
	.settings-toggle:hover { background: rgba(255, 255, 255, 0.1); }
	.settings-toggle-arrow {
		transition: transform 0.2s ease;
		opacity: 0.6;
	}
	.settings-toggle-arrow.open { transform: rotate(180deg); }
</style>