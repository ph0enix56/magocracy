import { io, type Socket } from 'socket.io-client';
import type { ClientCommand, GameActionCommand } from '../../shared/multiplayer/commands';
import type { ClientToServerEvents, ServerEvent, ServerToClientEvents } from '../../shared/multiplayer/events';
import type {
	BuildingCatalogSnapshot,
	GameSnapshot,
	LobbyPlayerSnapshot,
	LobbySnapshot,
	PlayerGameView
} from '../../shared/multiplayer/snapshots';
import { buildingCatalog } from './buildingCatalog';

export type MultiplayerConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export type MultiplayerClientState = {
	endpoint: string;
	connectionStatus: MultiplayerConnectionStatus;
	playerId: string | null;
	playerName: string;
	lobby: LobbySnapshot | null;
	game: GameSnapshot | null;
	gameSnapshotVersion: number;
	lastError: string | null;
};

type Listener = (state: MultiplayerClientState) => void;
type ServerEventListener = (event: ServerEvent) => void;

const PLAYER_NAME_STORAGE_KEY = 'magocracy:player-name';
const DEFAULT_MULTIPLAYER_SERVER_URL = 'http://localhost:8081';

function getServerEndpoint(): string {
	return import.meta.env['VITE_MULTIPLAYER_SERVER_URL']?.trim() || DEFAULT_MULTIPLAYER_SERVER_URL;
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
	private serverEventListeners = new Set<ServerEventListener>();
	private state: MultiplayerClientState = {
		endpoint: getServerEndpoint(),
		connectionStatus: 'idle',
		playerId: null,
		playerName: loadInitialPlayerName(),
		lobby: null,
		game: null,
		gameSnapshotVersion: 0,
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

	subscribeServerEvents(listener: ServerEventListener): () => void {
		this.serverEventListeners.add(listener);
		return () => this.serverEventListeners.delete(listener);
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
			this.setState({
				connectionStatus: 'disconnected',
				lobby: null,
				game: null,
				gameSnapshotVersion: 0,
				lastError: `Disconnected: ${reason}`
			});
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
		buildingCatalog.reset();
		this.setState({ connectionStatus: 'idle', playerId: null, lobby: null, game: null, gameSnapshotVersion: 0, lastError: null });
	}

	getCatalog(): BuildingCatalogSnapshot | null {
		return buildingCatalog.getSnapshot();
	}

	createLobby(): void {
		this.send({ type: 'lobby/create', playerName: this.state.playerName });
	}

	createSoloLobby(): void {
		this.send({ type: 'lobby/solo', playerName: this.state.playerName });
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

	sendGameAction(action: GameActionCommand, requestId: string): boolean {
		return this.send({ type: 'game/action', requestId, action });
	}

	getSelfGameView(game = this.state.game): PlayerGameView | null {
		const playerId = this.state.playerId;
		if (!playerId || !game) return null;
		return game.players.find((player) => player.playerId === playerId) ?? null;
	}

	isAuthoritativeGameplayActive(): boolean {
		return this.state.connectionStatus === 'connected' && this.state.lobby?.status === 'in-game' && this.state.game !== null;
	}

	getSelfPlayer(): LobbyPlayerSnapshot | null {
		const lobby = this.state.lobby;
		const playerId = this.state.playerId;
		if (!lobby || !playerId) return null;
		return lobby.players.find((player) => player.playerId === playerId) ?? null;
	}

	private send(command: ClientCommand): boolean {
		if (!this.socket || !this.socket.connected) {
			this.setState({ lastError: 'Not connected to the multiplayer server.' });
			return false;
		}
		this.socket.emit('command', command);
		return true;
	}

	private handleServerEvent(event: ServerEvent): void {
		for (const listener of this.serverEventListeners) listener(event);
		switch (event.type) {
			case 'session/connected':
				this.setState({ playerId: event.playerId, lastError: null });
				return;
			case 'catalog/snapshot':
				buildingCatalog.setSnapshot(event.catalog);
				return;
			case 'lobby/state':
				this.setState({
					lobby: event.lobby,
					game: event.lobby?.status === 'in-game' ? this.state.game : null,
					gameSnapshotVersion: event.lobby?.status === 'in-game' ? this.state.gameSnapshotVersion : 0,
					lastError: null
				});
				return;
			case 'command/accepted':
				this.setState({ lastError: null });
				return;
			case 'command/rejected':
				this.setState({ lastError: event.reason });
				return;
			case 'system/error':
				this.setState({ lastError: event.message });
				return;
			case 'game/snapshot':
				this.setState({ game: event.game, gameSnapshotVersion: this.state.gameSnapshotVersion + 1, lastError: null });
				return;
		}
	}

	private setState(patch: Partial<MultiplayerClientState>): void {
		this.state = { ...this.state, ...patch };
		for (const listener of this.listeners) listener(this.state);
	}
}
