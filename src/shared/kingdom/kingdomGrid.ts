export type KingdomCoord = {
	q: number;
	r: number;
};

export type KingdomSeedTile = KingdomCoord & {
	isExpansionSite?: true;
};

const NEIGHBOR_DELTAS: Array<{ dq: number; dr: number }> = [
	{ dq: 2, dr: 0 },
	{ dq: 1, dr: 1 },
	{ dq: -1, dr: 1 },
	{ dq: -2, dr: 0 },
	{ dq: -1, dr: -1 },
	{ dq: 1, dr: -1 }
];

export function kingdomCoordKey(q: number, r: number): string {
	return `${q},${r}`;
}

export function parseKingdomCoordKey(key: string): KingdomCoord {
	const q = Number(key.split(',')[0] ?? NaN);
	const r = Number(key.split(',')[1] ?? NaN);
	if (!Number.isFinite(q) || !Number.isFinite(r)) {
		throw new Error(`Invalid kingdom coord key: '${key}'`);
	}
	return { q, r };
}

export function getKingdomNeighbors(q: number, r: number): KingdomCoord[] {
	return NEIGHBOR_DELTAS.map((delta) => ({ q: q + delta.dq, r: r + delta.dr }));
}

export function createInitialKingdomTiles(): KingdomSeedTile[] {
	const center = { q: 0, r: 0 };
	const free = new Set<string>();
	free.add(kingdomCoordKey(center.q, center.r));
	for (const neighbor of getKingdomNeighbors(center.q, center.r)) {
		free.add(kingdomCoordKey(neighbor.q, neighbor.r));
	}

	const blocked = new Set<string>();
	for (const key of free) {
		const { q, r } = parseKingdomCoordKey(key);
		for (const neighbor of getKingdomNeighbors(q, r)) {
			const neighborKey = kingdomCoordKey(neighbor.q, neighbor.r);
			if (free.has(neighborKey)) continue;
			blocked.add(neighborKey);
		}
	}

	const tiles: KingdomSeedTile[] = [...free].map((key) => parseKingdomCoordKey(key));
	for (const key of blocked) {
		const coord = parseKingdomCoordKey(key);
		tiles.push({ ...coord, isExpansionSite: true });
	}

	return tiles;
}

export function createExpansionTilesAround(
	q: number,
	r: number,
	isKnown: (coord: KingdomCoord) => boolean,
): KingdomSeedTile[] {
	const revealed: KingdomSeedTile[] = [];
	for (const neighbor of getKingdomNeighbors(q, r)) {
		if (isKnown(neighbor)) continue;
		revealed.push({ ...neighbor, isExpansionSite: true });
	}
	return revealed;
}