import { MultiplayerClient } from './MultiplayerClient';

export const multiplayerClient = new MultiplayerClient();

if (new URLSearchParams(window.location.search).has('solo')) {
	const unsub = multiplayerClient.subscribeServerEvents((event) => {
		if (event.type === 'session/connected') {
			multiplayerClient.createSoloLobby();
			unsub();
		}
	});
	multiplayerClient.connect();
}