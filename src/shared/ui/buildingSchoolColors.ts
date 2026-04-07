export type BuildingSchool = 'neutral' | 'sylvan' | 'geomancy' | 'pyromancy' | 'hydromancy' | 'necromancy' | 'arcane';

export const EMPTY_HEX_TILE_COLOR = 0x8b8b8b;

export const BUILDING_SCHOOL_HEX_COLORS: Record<BuildingSchool, number> = {
	founding: 0xDFBF55,
	sylvan: 0x60A267,
	geomancy: 0x96734E,
	pyromancy: 0xA3574D,
	necromancy: 0x533E79,
	artifact: 0x456C77
};

export function getHexTileColorForSchool(school: string | undefined): number {
	if (!school) return EMPTY_HEX_TILE_COLOR;
	return BUILDING_SCHOOL_HEX_COLORS[school as BuildingSchool] ?? EMPTY_HEX_TILE_COLOR;
}

export function getHoveredHexTileColor(baseHexColor: number): number {
	const red = Math.min(255, Math.round(((baseHexColor >> 16) & 0xff) * 1.18));
	const green = Math.min(255, Math.round(((baseHexColor >> 8) & 0xff) * 1.18));
	const blue = Math.min(255, Math.round((baseHexColor & 0xff) * 1.18));
	return (red << 16) | (green << 8) | blue;
}

export function toCssHexColor(color: number): string {
	return `#${color.toString(16).padStart(6, '0')}`;
}
