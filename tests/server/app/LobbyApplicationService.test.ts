import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ServerEvent } from '../../../src/shared/multiplayer/events';
import { LobbyApplicationService } from '../../../src/multiplayer/server/app/LobbyApplicationService';
import type { ServerEventGateway } from '../../../src/multiplayer/server/app/lobbyTypes';

type EmitCall = { socketId: string; event: ServerEvent };
type BroadcastCall = { lobbyId: string; event: ServerEvent };

function createGatewayMock(): {
	gateway: ServerEventGateway;
	emitCalls: EmitCall[];
	broadcastCalls: BroadcastCall[];
} {
	const emitCalls: EmitCall[] = [];
	const broadcastCalls: BroadcastCall[] = [];

	const gateway: ServerEventGateway = {
		emitToClient: (socketId, event) => {
			emitCalls.push({ socketId, event });
		},
		broadcastToLobby: (lobbyId, event) => {
			broadcastCalls.push({ lobbyId, event });
		},
		joinToLobby: () => undefined,
		leaveFromLobby: () => undefined
	};

	return { gateway, emitCalls, broadcastCalls };
}

test('leave lobby emits null lobby state to leaving client', () => {
	const { gateway, emitCalls } = createGatewayMock();
	const service = new LobbyApplicationService(gateway);

	service.handleConnected('player-1', 'socket-1');
	service.handleCommand('player-1', 'socket-1', { type: 'lobby/create', playerName: 'Alice' });
	service.handleCommand('player-1', 'socket-1', { type: 'lobby/leave' });

	const lobbyStateEvents = emitCalls.filter((call) => call.socketId === 'socket-1' && call.event.type === 'lobby/state');
	assert.equal(lobbyStateEvents.length, 1);
	assert.equal(lobbyStateEvents[0]?.event.type, 'lobby/state');
	if (lobbyStateEvents[0]?.event.type === 'lobby/state') {
		assert.equal(lobbyStateEvents[0].event.lobby, null);
	}
});

test('set-ready and start reject when client is not in a lobby', () => {
	const { gateway, emitCalls } = createGatewayMock();
	const service = new LobbyApplicationService(gateway);

	service.handleConnected('player-1', 'socket-1');
	service.handleCommand('player-1', 'socket-1', { type: 'lobby/set-ready', ready: true });
	service.handleCommand('player-1', 'socket-1', { type: 'lobby/start' });

	const rejected = emitCalls.filter((call) => call.socketId === 'socket-1' && call.event.type === 'command/rejected');
	assert.equal(rejected.length, 2);
	assert.equal(rejected[0]?.event.type, 'command/rejected');
	if (rejected[0]?.event.type === 'command/rejected') {
		assert.equal(rejected[0].event.commandType, 'lobby/set-ready');
		assert.equal(rejected[0].event.reason, 'You are not in a lobby.');
	}
	assert.equal(rejected[1]?.event.type, 'command/rejected');
	if (rejected[1]?.event.type === 'command/rejected') {
		assert.equal(rejected[1].event.commandType, 'lobby/start');
		assert.equal(rejected[1].event.reason, 'You are not in a lobby.');
	}
});
