import type { GameSettings } from '../../../shared/multiplayer/snapshots';
import { ServerGameState } from '../ServerGameState';
import { initializeKingdomGrid } from '../board/kingdomBoard';
import { ArmyService } from './armyService';
import { BuildService } from './BuildService';
import { ProductionService } from './ProductionService';
import { ShopService } from './ShopService';

export type PlayerRuntimeBundle = {
	run: ServerGameState;
	buildService: BuildService;
	armyService: ArmyService;
	productionService: ProductionService;
	shopService: ShopService;
};

export class PlayerRuntimeFactory {
	create(economy: GameSettings['economy']): PlayerRuntimeBundle {
		const seed = Date.now() ^ Math.floor(Math.random() * 0xffffffff);
		const run = new ServerGameState(seed, {
			initialResources: economy.startingResources,
			starterBlueprintInventory: economy.starterBlueprintInventory
		});

		const buildService = new BuildService(run.world);
		const productionService = new ProductionService(run.world);
		const shopService = new ShopService(run.world);
		const armyService = new ArmyService(run.world);

		shopService.rerollFree();
		initializeKingdomGrid(run.world);

		return { run, buildService, armyService, productionService, shopService };
	}
}
