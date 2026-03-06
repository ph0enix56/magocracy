import { io, type Socket } from 'socket.io-client';
import type {
	ClientCommand,
	ClientToServerEvents,
	LobbyPlayerSnapshot,
	LobbySnapshot,
	ServerEvent,
	ServerToClientEvents
} from '../../shared/multiplayer/protocol';

export type MultiplayerConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export type MultiplayerClientState = {
	endpoint: string;
	connectionStatus: MultiplayerConnectionStatus;
	playerId: string | null;
	playerName: string;
	lobby: LobbySnapshot | null;
	lastError: string | null;
};

type Listener = (state: MultiplayerClientState) => void;

const PLAYER_NAME_STORAGE_KEY = 'magocracy:player-name';

function getDefaultEndpoint(): string {
	const envUrl = import.meta.env['VITE_MULTIPLAYER_URL'];
	if (typeof envUrl === 'string' && envUrl.trim().length > 0) return envUrl;
	return window.location.origin;
}

function generateDefaultPlayerName(): string {
	const suffix = Math.floor(Math.random() * 10_000)
		.toString()
		.padStart(4, '0');
	return `Mage-${suffix}`;
}

function loadInitialPlayerName(): string {
	const stored = window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY)?.trim();
	if (stored) return stored;
	const generated = generateDefaultPlayerName();
	window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, generated);
	return generated;
}

export class MultiplayerClient {
	private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
	private listeners = new Set<Listener>();
	private state: MultiplayerClientState = {
		endpoint: getDefaultEndpoint(),
		connectionStatus: 'idle',
		playerId: null,
		playerName: loadInitialPlayerName(),
		lobby: null,
		lastError: null
	};

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		listener(this.state);
		return () => this.listeners.delete(listener);
	}

	getState(): MultiplayerClientState {
		return this.state;
	}

	setPlayerName(playerName: string): void {
		const nextName = playerName.trim();
		if (!nextName) return;
		window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, nextName);
		this.setState({ playerName: nextName, lastError: null });
		if (this.state.lobby) {
			this.setState({ lastError: 'Reconnect or rejoin to apply the new player name on the server.' });
		}
	}

	connect(endpoint = this.state.endpoint): void {
		if (this.socket && this.socket.connected) return;
		if (this.socket) {
			this.socket.removeAllListeners();
			this.socket.disconnect();
			this.socket = null;
		}

		this.setState({ endpoint, connectionStatus: 'connecting', lastError: null });
		const socket = io(endpoint, {
			transports: ['websocket'],
			autoConnect: true
		});
		this.socket = socket;

		socket.on('connect', () => {
			this.setState({ connectionStatus: 'connected', lastError: null });
		});

		socket.on('disconnect', (reason: string) => {
			this.setState({ connectionStatus: 'disconnected', lobby: null, lastError: `Disconnected: ${reason}` });
		});

		socket.on('connect_error', (error: Error) => {
			this.setState({ connectionStatus: 'error', lastError: error.message });
		});

		socket.on('event', (event: ServerEvent) => this.handleServerEvent(event));
	}

	disconnect(): void {
		if (!this.socket) return;
		this.socket.removeAllListeners();
		this.socket.disconnect();
		this.socket = null;
		this.setState({ connectionStatus: 'idle', playerId: null, lobby: null, lastError: null });
	}

	createLobby(): void {
		this.send({ type: 'lobby/create', playerName: this.state.playerName });
	}

	joinLobby(lobbyId: string): void {
		this.send({ type: 'lobby/join', lobbyId: lobbyId.trim().toUpperCase(), playerName: this.state.playerName });
	}

	leaveLobby(): void {
		this.send({ type: 'lobby/leave' });
	}

	setReady(ready: boolean): void {
		this.send({ type: 'lobby/set-ready', ready });
	}

	startLobbyGame(): void {
		this.send({ type: 'lobby/start' });
	}

	sendGameCommand(command: ClientCommand): void {
		this.send(command);
	}

	getSelfPlayer(): LobbyPlayerSnapshot | null {
		const lobby = this.state.lobby;
		const playerId = this.state.playerId;
		if (!lobby || !playerId) return null;
		return lobby.players.find((player) => player.playerId === playerId) ?? null;
	}

	private send(command: ClientCommand): void {
		if (!this.socket || !this.socket.connected) {
			this.setState({ lastError: 'Not connected to the multiplayer server.' });
			return;
		}
		this.socket.emit('command', command);
	}

	private handleServerEvent(event: ServerEvent): void {
		switch (event.type) {
			case 'session/connected':
				this.setState({ playerId: event.playerId, lastError: null });
				return;
			case 'lobby/state':
				this.setState({ lobby: event.lobby, lastError: null });
				return;
			case 'command/rejected':
				this.setState({ lastError: event.reason });
				return;
			case 'system/error':
				this.setState({ lastError: event.message });
				return;
			case 'game/snapshot':
				this.setState({ lastError: null });
				return;
		}
	}

	private setState(patch: Partial<MultiplayerClientState>): void {
		this.state = { ...this.state, ...patch };
		for (const listener of this.listeners) listener(this.state);
	}
}
