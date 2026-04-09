<script lang="ts">
	import { multiplayerClient } from '../multiplayer/client/clientSingleton';
	import { gameSessionState } from '../multiplayer/client/gameSessionStore';

	$: selfPlayer = $gameSessionState.lobby?.players.find((player) => player.playerId === $gameSessionState.playerId) ?? null;
	$: inMatch = $gameSessionState.lobby?.status === 'in-game' || !!$gameSessionState.game;
	$: statusLabel = $gameSessionState.connectionStatus === 'connected' ? 'Online' : 'Offline';

	let nameDraft = '';
	let joinLobbyIdDraft = '';

	$: {
		if (!nameDraft && $gameSessionState.playerName) {
			nameDraft = $gameSessionState.playerName;
		}
	}

	function connectMultiplayer() {
		multiplayerClient.connect();
	}

	function disconnectMultiplayer() {
		multiplayerClient.disconnect();
	}

	function renamePlayer() {
		const next = nameDraft.trim();
		if (!next) return;
		multiplayerClient.setPlayerName(next);
	}

	function createLobby() {
		multiplayerClient.createLobby();
	}

	function joinLobby() {
		const lobbyId = joinLobbyIdDraft.trim();
		if (!lobbyId) return;
		multiplayerClient.joinLobby(lobbyId);
	}

	function leaveLobby() {
		multiplayerClient.leaveLobby();
	}

	function toggleReady() {
		if (!selfPlayer) return;
		multiplayerClient.setReady(!selfPlayer.isReady);
	}

	function startLobbyGame() {
		multiplayerClient.startLobbyGame();
	}
</script>

{#if !inMatch}
	<div class="multiplayer-panel ui-panel">
		<div class="multiplayer-title">Magocracy</div>
		<div class="multiplayer-subtitle">Multiplayer Lobby</div>

		<div class="multiplayer-row multiplayer-row--status">
			<span>Status</span>
			<span>{statusLabel}</span>
		</div>

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
		width: min(560px, calc(100vw - 32px));
		padding: 16px;
		pointer-events: auto;
	}
	.multiplayer-title {
		font-size: var(--ui-font-size-xl);
		font-weight: 800;
		margin-bottom: 4px;
	}
	.multiplayer-subtitle {
		font-size: var(--ui-font-size-md);
		opacity: 0.75;
		margin-bottom: 12px;
	}
	.multiplayer-row {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: var(--ui-font-size-sm);
		margin-bottom: 6px;
	}
	.multiplayer-row--status {
		margin-bottom: 10px;
	}
	.multiplayer-field-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 8px;
		margin-bottom: 10px;
	}
	.multiplayer-input {
		height: 36px;
		box-sizing: border-box;
		padding: 0 10px;
		border-radius: 4px;
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: rgba(0, 0, 0, 0.45);
		color: #fff;
		font: inherit;
	}
	.multiplayer-input::placeholder {
		opacity: 0.7;
	}
	.multiplayer-actions {
		display: flex;
		gap: 8px;
		margin-top: 8px;
	}
	.multiplayer-actions .ui-button,
	.multiplayer-start {
		flex: 1;
	}
	.multiplayer-error {
		font-size: var(--ui-font-size-xs);
		color: #ffb3b3;
		margin-top: 10px;
	}
	.multiplayer-players {
		margin-top: 8px;
		padding: 10px;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.25);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.multiplayer-player-row {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 8px;
		align-items: center;
		font-size: var(--ui-font-size-sm);
	}
	.multiplayer-player-name {
		font-weight: 600;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.multiplayer-player-state {
		font-size: var(--ui-font-size-xs);
		padding: 2px 8px;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}
	.multiplayer-player-state.is-ready {
		background: rgba(37, 140, 83, 0.3);
	}
	.multiplayer-player-state.is-waiting {
		background: rgba(140, 97, 37, 0.3);
	}
	.multiplayer-host-badge {
		font-size: var(--ui-font-size-xs);
		padding: 2px 7px;
		border-radius: 999px;
		background: rgba(72, 130, 201, 0.35);
	}
	.multiplayer-start {
		margin-top: 10px;
		width: 100%;
	}
</style>