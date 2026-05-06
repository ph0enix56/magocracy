export type GameActionCommand =
	| { type: 'build/request'; q: number; r: number; buildingId: string }
	| { type: 'kingdom/expand'; q: number; r: number }
	| { type: 'destroy/request'; q: number; r: number }
	| { type: 'upgrade/request'; q: number; r: number; upgradeBuildingId: string }
	| { type: 'shop/buy'; slotIndex: number }
	| { type: 'shop/reroll' }
	| { type: 'army/reorder'; unitEntityId: string; direction: 'up' | 'down' }
	| { type: 'combat/step'; steps?: number }
	| { type: 'fight/replay-open'; matchId: string }
	| { type: 'advance/select-charter'; charterId: string };

export type ClientCommand =
	| { type: 'lobby/create'; playerName: string }
	| { type: 'lobby/join'; lobbyId: string; playerName: string }
	| { type: 'lobby/leave' }
	| { type: 'lobby/set-ready'; ready: boolean }
	| { type: 'lobby/start' }
	| { type: 'lobby/solo'; playerName: string }
	| { type: 'lobby/configure'; settings: import('./snapshots').GameSettings }
	| { type: 'game/action'; requestId: string; action: GameActionCommand };
