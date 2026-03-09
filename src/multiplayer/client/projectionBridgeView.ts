import { eventBus } from '../../eventBus';
import type { PlayerGameView } from '../../shared/multiplayer/protocol';
import type { CombatProjectionStatus } from './projectionBridgeTypes';

const RESOURCE_KEYS = ['stone', 'wood', 'food', 'mana', 'gold'] as const;

export function publishPlayerView(view: PlayerGameView, lastCombatStatus: CombatProjectionStatus): CombatProjectionStatus {
	for (const resourceKey of RESOURCE_KEYS) {
		eventBus.publishGameToUi({
			type: 'resource-updated',
			key: resourceKey,
			value: view.resources[resourceKey] ?? 0
		});
	}

	eventBus.publishGameToUi({ type: 'blueprint-inventory-updated', inventory: view.blueprints });
	eventBus.publishGameToUi({
		type: 'shop-state-updated',
		offers: view.shop.offers,
		buyCost: view.shop.buyCost,
		rerollCost: view.shop.rerollCost
	});
	eventBus.publishGameToUi({
		type: 'army-state-updated',
		units: view.army.map((unit) => ({
			entityId: unit.entityId,
			unitId: unit.unitId,
			name: unit.name,
			textureId: unit.unitId,
			assetPath: unit.assetPath,
			speed: unit.speed,
			health: unit.health,
			drFlat: unit.drFlat,
			drPercent: unit.drPercent,
			actionsPerTurn: unit.actionsPerTurn,
			trainingLevel: unit.trainingLevel,
			trainingStatus: unit.trainingStatus,
			trainingProgress: unit.trainingProgress,
			nextTrainCost: unit.nextTrainCost,
			trainTime: unit.trainTime
		}))
	});
	eventBus.publishGameToUi({ type: 'combat-state-updated', state: view.combat });

	if (lastCombatStatus === 'idle' && view.combat.status === 'running') {
		eventBus.publishGameToUi({ type: 'combat-ui-open', reason: 'multiplayer' });
	}

	return view.combat.status;
}