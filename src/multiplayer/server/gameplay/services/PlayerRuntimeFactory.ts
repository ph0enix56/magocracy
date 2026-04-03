import { ServerGameState } from '../ServerGameState';
import { initializeKingdomGrid } from '../board/kingdomBoard';
import { ArmyService } from './ArmyService';
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
	create(): PlayerRuntimeBundle {
		const run = new ServerGameState(Date.now() ^ Math.floor(Math.random() * 0xffffffff));
		const buildService = new BuildService(run.world);
		const productionService = new ProductionService(run.world);
		const shopService = new ShopService(run.world);
		const armyService = new ArmyService(run.world);

		shopService.rerollFree();
		initializeKingdomGrid(run.world);

		return { run, buildService, armyService, productionService, shopService };
	}
}
