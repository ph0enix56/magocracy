<script lang="ts">
	import { multiplayerClient } from '../multiplayer/client/clientSingleton';
	import { gameSessionState } from '../multiplayer/client/gameSessionStore';

	$: selfPlayer = $gameSessionState.lobby?.players.find((player) => player.playerId === $gameSessionState.playerId) ?? null;

	function connectMultiplayer() {
		multiplayerClient.connect();
	}

	function disconnectMultiplayer() {
		multiplayerClient.disconnect();
	}

	function renamePlayer() {
		const next = window.prompt('Player name', $gameSessionState.playerName)?.trim();
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

	function phaseLabel(phase: string): string {
		if (phase === 'combat') return 'Fight';
		if (phase === 'advance') return 'Advance';
		return phase;
	}
</script>

<div class="multiplayer-panel ui-panel">
	<div class="multiplayer-title">Multiplayer</div>
	<div class="multiplayer-row">
		<span>{$gameSessionState.connectionStatus}</span>
		<span>{$gameSessionState.playerName}</span>
	</div>
	{#if $gameSessionState.lobby}
		<div class="multiplayer-row">
			<span>Lobby {$gameSessionState.lobby.lobbyId}</span>
			<span>{$gameSessionState.lobby.players.length}/{$gameSessionState.lobby.maxPlayers}</span>
		</div>
	{/if}
	{#if $gameSessionState.game}
		<div class="multiplayer-row">
			<span>Tick {$gameSessionState.game.tick}</span>
			<span>Phase {phaseLabel($gameSessionState.game.phase)}</span>
		</div>
		<div class="multiplayer-row">
			<span>Status {$gameSessionState.game.status}</span>
			<span>Renown {$gameSessionState.game.targetRenown}</span>
		</div>
		{#if $gameSessionState.game.phase === 'build'}
			<div class="multiplayer-row">
				<span>Build ends in</span>
				<span>{$gameSessionState.game.buildPhaseSecondsRemaining}s</span>
			</div>
		{/if}
		{#if $gameSessionState.viewedPlayer}
			<div class="multiplayer-row multiplayer-row--viewing">
				<span>Viewing</span>
				<span>{$gameSessionState.viewedPlayer.name}</span>
			</div>
		{/if}
		{#if $gameSessionState.game.status === 'finished'}
			<div class="multiplayer-finished">
				<div class="multiplayer-finished-title">Final standings</div>
				{#each $gameSessionState.game.finalStandings as standing (standing.playerId)}
					{@const lobbyPlayer = $gameSessionState.lobby?.players.find((player) => player.playerId === standing.playerId)}
					<div class="multiplayer-row multiplayer-row--standing">
						<span>#{standing.rank} {lobbyPlayer?.name ?? standing.playerId}</span>
						<span>{standing.renown}</span>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
	{#if $gameSessionState.lastError}
		<div class="multiplayer-error">{$gameSessionState.lastError}</div>
	{/if}
	<div class="multiplayer-actions">
		{#if $gameSessionState.connectionStatus !== 'connected'}
			<button class="ui-button" on:click={connectMultiplayer}>Connect</button>
		{:else}
			<button class="ui-button" on:click={disconnectMultiplayer}>Disconnect</button>
		{/if}
		<button class="ui-button ui-button--ghost" on:click={renamePlayer}>Rename</button>
	</div>
	{#if $gameSessionState.connectionStatus === 'connected' && !$gameSessionState.lobby}
		<div class="multiplayer-actions">
			<button class="ui-button" on:click={createLobby}>Create Lobby</button>
			<button class="ui-button ui-button--ghost" on:click={joinLobby}>Join Lobby</button>
		</div>
	{/if}
	{#if $gameSessionState.lobby}
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
	.multiplayer-row--viewing {
		color: #ffd28a;
	}
	.multiplayer-finished {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid rgba(255, 255, 255, 0.12);
	}
	.multiplayer-finished-title {
		font-size: 0.82rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		opacity: 0.7;
		margin-bottom: 6px;
	}
	.multiplayer-row--standing {
		font-size: 0.82rem;
	}
</style>