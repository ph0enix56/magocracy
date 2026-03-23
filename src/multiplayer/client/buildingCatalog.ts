import type { BuildingCatalogEntry, BuildingCatalogSnapshot } from '../../shared/multiplayer/contracts/snapshots';

type Listener = (entries: BuildingCatalogEntry[]) => void;

class ClientBuildingCatalog {
	private entries: BuildingCatalogEntry[] = [];
	private byId = new Map<string, BuildingCatalogEntry>();
	private listeners = new Set<Listener>();

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		listener(this.entries);
		return () => this.listeners.delete(listener);
	}

	setSnapshot(snapshot: BuildingCatalogSnapshot): void {
		this.entries = [...snapshot.buildings];
		this.byId = new Map(this.entries.map((entry) => [entry.id, entry]));
		this.emit();
	}

	reset(): void {
		this.entries = [];
		this.byId.clear();
		this.emit();
	}

	getSnapshot(): BuildingCatalogSnapshot | null {
		if (this.entries.length === 0) return null;
		return { buildings: this.entries };
	}

	getAll(): BuildingCatalogEntry[] {
		return this.entries;
	}

	getById(id: string): BuildingCatalogEntry | undefined {
		return this.byId.get(id);
	}

	getPurchasable(): BuildingCatalogEntry[] {
		return this.entries.filter((entry) => !entry.parentId && !entry.isBlocker);
	}

	getNextUpgrade(currentBuildingId: string): BuildingCatalogEntry | undefined {
		return this.entries.find((entry) => entry.parentId === currentBuildingId);
	}

	private emit(): void {
		for (const listener of this.listeners) listener(this.entries);
	}
}

export const buildingCatalog = new ClientBuildingCatalog();