import { getBlockingBuildingDefs } from '../../config/buildings';

export function pickRandomBlockerId(): string {
	const blockers = getBlockingBuildingDefs();
	if (blockers.length === 0) throw new Error('No blocker building defs configured.');
	const index = Math.floor(Math.random() * blockers.length);
	return blockers[index]!.id;
}
