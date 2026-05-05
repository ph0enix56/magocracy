import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LobbyLifecycleService } from '../../../src/server/app/LobbyLifecycleService';
import type { ServerEventGateway } from '../../../src/server/app/lobbyTypes';

function createGatewayMock() {
	const joinCalls: Array<{ socketId: string; lobbyId: string }> = [];
	const leaveCalls: Array<{ socketId: string; lobbyId: string }> = [];

	const gateway: ServerEventGateway = {
		emitToClient: () => undefined,
		broadcastToLobby: () => undefined,
		joinToLobby: (socketId, lobbyId) => {
			joinCalls.push({ socketId, lobbyId });
		},
		leaveFromLobby: (socketId, lobbyId) => {
			leaveCalls.push({ socketId, lobbyId });
		}
	};

	return { gateway, joinCalls, leaveCalls };
}

test('createLobby adds host and normalizes blank player name', () => {
	const { gateway, joinCalls } = createGatewayMock();
	const lifecycle = new LobbyLifecycleService(gateway);

	const created = lifecycle.createLobby('player-a', 'socket-a', '   ', 4);
	assert.equal(created.ok, true);
	if (!created.ok) return;

	assert.equal(created.lobby.players.size, 1);
	assert.equal(created.lobby.hostPlayerId, 'player-a');
	assert.equal(created.lobby.maxPlayers, 4);
	assert.equal(created.lobby.players.get('player-a')?.name, 'Mage-play');
	assert.deepEqual(joinCalls, [{ socketId: 'socket-a', lobbyId: created.lobby.lobbyId }]);
});

test('joinLobby respects maxPlayers and returns full-lobby rejection', () => {
	const { gateway } = createGatewayMock();
	const lifecycle = new LobbyLifecycleService(gateway);

	const created = lifecycle.createLobby('host', 'socket-host', 'Host', 2);
	assert.equal(created.ok, true);
	if (!created.ok) return;

	const lobbyId = created.lobby.lobbyId;
	const joined = lifecycle.joinLobby('player-b', 'socket-b', lobbyId, 'B');
	assert.equal(joined.ok, true);

	const blocked = lifecycle.joinLobby('player-c', 'socket-c', lobbyId, 'C');
	assert.equal(blocked.ok, false);
	if (!blocked.ok) {
		assert.equal(blocked.reason, 'Lobby is full.');
	}
});

test('leaveLobby transfers host to next player and emits leave gateway call', () => {
	const { gateway, leaveCalls } = createGatewayMock();
	const lifecycle = new LobbyLifecycleService(gateway);

	const created = lifecycle.createLobby('host', 'socket-host', 'Host', 4);
	assert.equal(created.ok, true);
	if (!created.ok) return;

	const lobbyId = created.lobby.lobbyId;
	assert.equal(lifecycle.joinLobby('player-b', 'socket-b', lobbyId, 'B').ok, true);

	const left = lifecycle.leaveLobby('host', 'socket-host');
	assert.equal(left.ok, true);
	if (!left.ok || !left.lobby) return;

	assert.equal(left.lobby.hostPlayerId, 'player-b');
	assert.equal(left.lobby.players.has('host'), false);
	assert.deepEqual(leaveCalls, [{ socketId: 'socket-host', lobbyId }]);
});

test('leaveLobby rejects in-game lobbies and disconnect resets readiness', () => {
	const { gateway } = createGatewayMock();
	const lifecycle = new LobbyLifecycleService(gateway);

	const created = lifecycle.createLobby('host', 'socket-host', 'Host', 4);
	assert.equal(created.ok, true);
	if (!created.ok) return;

	created.lobby.status = 'in-game';
	const denied = lifecycle.leaveLobby('host', 'socket-host');
	assert.equal(denied.ok, false);
	if (!denied.ok) {
		assert.equal(denied.reason, 'Leaving an active match is not supported yet.');
	}

	created.lobby.status = 'open';
	created.lobby.players.get('host')!.isReady = true;
	const disconnectedLobby = lifecycle.disconnectPlayer('host');
	assert.equal(disconnectedLobby?.players.get('host')?.connected, false);
	assert.equal(disconnectedLobby?.players.get('host')?.isReady, false);
});
