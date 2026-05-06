import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ClientCommand } from '../../../src/shared/multiplayer/commands';
import { routeClientCommand } from '../../../src/server/app/CommandRouter';

type Invocation =
	| { name: 'create'; playerName: string }
	| { name: 'join'; lobbyId: string; playerName: string }
	| { name: 'leave' }
	| { name: 'set-ready'; ready: boolean }
	| { name: 'start' }
	| { name: 'solo'; playerName: string }
	| { name: 'game/action'; type: string };

function makeHandlers(invocations: Invocation[]) {
	return {
		onCreate: (playerName: string) => invocations.push({ name: 'create', playerName }),
		onJoin: (lobbyId: string, playerName: string) => invocations.push({ name: 'join', lobbyId, playerName }),
		onLeave: () => invocations.push({ name: 'leave' }),
		onSetReady: (ready: boolean) => invocations.push({ name: 'set-ready', ready }),
		onStartLobby: () => invocations.push({ name: 'start' }),
		onSolo: (playerName: string) => invocations.push({ name: 'solo', playerName }),
		onConfigure: () => {},
		onGameAction: (command: Extract<ClientCommand, { type: 'game/action' }>) =>
			invocations.push({ name: 'game/action', type: command.action.type })
	};
}

test('routes lobby commands to matching handlers with payload', () => {
	const invocations: Invocation[] = [];
	const handlers = makeHandlers(invocations);

	routeClientCommand({ type: 'lobby/create', playerName: 'Alice' }, handlers);
	routeClientCommand({ type: 'lobby/join', lobbyId: 'ABCD12', playerName: 'Bob' }, handlers);
	routeClientCommand({ type: 'lobby/leave' }, handlers);
	routeClientCommand({ type: 'lobby/set-ready', ready: true }, handlers);
	routeClientCommand({ type: 'lobby/start' }, handlers);
	routeClientCommand({ type: 'lobby/solo', playerName: 'SoloMage' }, handlers);

	assert.deepEqual(invocations, [
		{ name: 'create', playerName: 'Alice' },
		{ name: 'join', lobbyId: 'ABCD12', playerName: 'Bob' },
		{ name: 'leave' },
		{ name: 'set-ready', ready: true },
		{ name: 'start' },
		{ name: 'solo', playerName: 'SoloMage' }
	]);
});

test('routes game action command and forwards action payload', () => {
	const invocations: Invocation[] = [];
	const handlers = makeHandlers(invocations);

	routeClientCommand(
		{ type: 'game/action', requestId: 'req-1', action: { type: 'fight/replay-open', matchId: 'fight-1' } },
		handlers
	);

	assert.deepEqual(invocations, [{ name: 'game/action', type: 'fight/replay-open' }]);
});
