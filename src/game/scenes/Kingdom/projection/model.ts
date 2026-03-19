import type { ConstructionBadge } from './ConstructionBadge';
import type { BuildingStatus } from '../../../../shared/domain/types';
import type { KingdomCoord } from '../../../../shared/kingdom/kingdomGrid';

export type ProjectionPosition = KingdomCoord;

export interface ProjectionBuilding {
	buildingId: string;
	status: BuildingStatus;
	progress: number;
	upgradeNextId?: string;
	productionMultiplier?: number;
}

export interface ProjectionRenderState {
	hex: Phaser.GameObjects.Image;
	building?: Phaser.GameObjects.Image;
	constructionBadge?: ConstructionBadge;
}

export interface ProjectionTile {
	id: string;
	position: ProjectionPosition;
	render: ProjectionRenderState;
	building?: ProjectionBuilding;
}

export class ProjectionWorld {
	private readonly tiles = new Map<string, ProjectionTile>();

	addTile(tile: ProjectionTile): void {
		this.tiles.set(tile.id, tile);
	}

	getTile(id: string): ProjectionTile | undefined {
		return this.tiles.get(id);
	}

	getTileAt(q: number, r: number): ProjectionTile | undefined {
		return this.tiles.get(`${q},${r}`);
	}

	getTiles(): ProjectionTile[] {
		return [...this.tiles.values()];
	}
}