import type { ConstructionBadge } from './ConstructionBadge';
import type { BuildingStatus } from '../../../shared/domain/types';
import type { KingdomCoord } from '../../../shared/kingdom/kingdomGrid';

export type ProjectionPosition = KingdomCoord;

export interface ProjectionBuilding {
	buildingId: string;
	school?: string;
	status: BuildingStatus;
	progress: number;
	upgradeNextId?: string;
	productionMultiplier?: number;
}

export interface ProjectionRenderState {
	hex: Phaser.GameObjects.Image;
	hexOutline: Phaser.GameObjects.Image;
	expansion?: Phaser.GameObjects.Image;
	hexBaseColor: number;
	hexDisplayColor: number;
	hexHovered: boolean;
	building?: Phaser.GameObjects.Image;
	constructionBadge?: ConstructionBadge;
}

export interface ProjectionTile {
	id: string;
	position: ProjectionPosition;
	isExpansionSite?: boolean;
	render: ProjectionRenderState;
	building?: ProjectionBuilding;
}

export class ProjectionWorld {
	private readonly tiles = new Map<string, ProjectionTile>();
	private expansionTilesVisible = false;

	addTile(tile: ProjectionTile): void {
		this.tiles.set(tile.id, tile);
	}

	getTile(id: string): ProjectionTile | undefined {
		return this.tiles.get(id);
	}

	getTileAt(q: number, r: number): ProjectionTile | undefined {
		return this.tiles.get(`${q},${r}`);
	}

	removeTile(id: string): void {
		this.tiles.delete(id);
	}

	getTiles(): ProjectionTile[] {
		return [...this.tiles.values()];
	}

	setExpansionTilesVisible(visible: boolean): void {
		this.expansionTilesVisible = visible;
	}

	areExpansionTilesVisible(): boolean {
		return this.expansionTilesVisible;
	}
}