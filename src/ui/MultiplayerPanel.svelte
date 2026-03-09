<script lang="ts">
	import { multiplayerClient } from '../multiplayer/client/clientSingleton';
	import { multiplayerState } from '../multiplayer/client/multiplayerStore';

	$: selfPlayer = $multiplayerState.lobby?.players.find((player) => player.playerId === $multiplayerState.playerId) ?? null;

	function connectMultiplayer() {
		multiplayerClient.connect();
	}

	function disconnectMultiplayer() {
		multiplayerClient.disconnect();
	}

	function renamePlayer() {
		const next = window.prompt('Player name', $multiplayerState.playerName)?.trim();
		if (!next) return;
		multiplayerClient.setPlayerName(next);
	}

	function createLobby() {
		multiplayerClient.createLobby();
	}

	function joinLobby() {
		const lobbyId = window.prompt('Lobby ID')?.trim();
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

<div class="multiplayer-panel ui-panel">
	<div class="multiplayer-title">Multiplayer</div>
	<div class="multiplayer-row">
		<span>{$multiplayerState.connectionStatus}</span>
		<span>{$multiplayerState.playerName}</span>
	</div>
	{#if $multiplayerState.lobby}
		<div class="multiplayer-row">
			<span>Lobby {$multiplayerState.lobby.lobbyId}</span>
			<span>{$multiplayerState.lobby.players.length}/{$multiplayerState.lobby.maxPlayers}</span>
		</div>
	{/if}
	{#if $multiplayerState.game}
		<div class="multiplayer-row">
			<span>Tick {$multiplayerState.game.tick}</span>
			<span>Phase {$multiplayerState.game.phase}</span>
		</div>
	{/if}
	{#if $multiplayerState.lastError}
		<div class="multiplayer-error">{$multiplayerState.lastError}</div>
	{/if}
	<div class="multiplayer-actions">
		{#if $multiplayerState.connectionStatus !== 'connected'}
			<button class="ui-button" on:click={connectMultiplayer}>Connect</button>
		{:else}
			<button class="ui-button" on:click={disconnectMultiplayer}>Disconnect</button>
		{/if}
		<button class="ui-button ui-button--ghost" on:click={renamePlayer}>Rename</button>
	</div>
	{#if $multiplayerState.connectionStatus === 'connected' && !$multiplayerState.lobby}
		<div class="multiplayer-actions">
			<button class="ui-button" on:click={createLobby}>Create Lobby</button>
			<button class="ui-button ui-button--ghost" on:click={joinLobby}>Join Lobby</button>
		</div>
	{/if}
	{#if $multiplayerState.lobby}
		<div class="multiplayer-actions">
			<button class="ui-button" on:click={toggleReady}>{selfPlayer?.isReady ? 'Unready' : 'Ready'}</button>
			<button class="ui-button ui-button--ghost" on:click={leaveLobby}>Leave</button>
		</div>
		{#if selfPlayer?.isHost}
			<button class="ui-button multiplayer-start" on:click={startLobbyGame} disabled={$multiplayerState.lobby.status !== 'open'}>
				Start Match
			</button>
		{/if}
	{/if}
</div>

<style>
	.multiplayer-panel {
		position: absolute;
		top: 10px;
		right: 10px;
		width: 280px;
		padding: 12px;
		pointer-events: auto;
	}
	.multiplayer-title {
		font-weight: 700;
		margin-bottom: 8px;
	}
	.multiplayer-row {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 0.9rem;
		margin-bottom: 6px;
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
		font-size: 0.8rem;
		color: #ffb3b3;
		margin-top: 6px;
	}
</style>