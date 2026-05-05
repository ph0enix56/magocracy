export type Pairing = [string, string?];

const BYE_PLAYER_ID = '__bye__';

export function buildRoundRobinPhase(playerIds: string[], random: () => number = Math.random): Pairing[][] {
	if (playerIds.length <= 1) return [];
	const shuffled = shuffle([...playerIds], random);
	return buildRoundRobinRounds(shuffled);
}

function buildRoundRobinRounds(playerOrder: string[]): Pairing[][] {
	const pool = [...playerOrder];
	if (pool.length % 2 !== 0) pool.push(BYE_PLAYER_ID);
	if (pool.length < 2) return [];

	const rounds: Pairing[][] = [];
	const roundCount = pool.length - 1;
	for (let round = 0; round < roundCount; round += 1) {
		const pairs: Pairing[] = [];
		for (let i = 0; i < pool.length / 2; i += 1) {
			const a = pool[i]!;
			const b = pool[pool.length - 1 - i]!;
			if (a === BYE_PLAYER_ID && b === BYE_PLAYER_ID) continue;
			if (a === BYE_PLAYER_ID) {
				pairs.push([b, undefined]);
				continue;
			}
			if (b === BYE_PLAYER_ID) {
				pairs.push([a, undefined]);
				continue;
			}
			pairs.push([a, b]);
		}
		rounds.push(pairs);

		const fixed = pool[0]!;
		const rotated = [fixed, pool[pool.length - 1]!, ...pool.slice(1, pool.length - 1)];
		for (let i = 0; i < pool.length; i += 1) pool[i] = rotated[i]!;
	}

	return rounds;
}

function shuffle(values: string[], random: () => number): string[] {
	const out = [...values];
	for (let i = out.length - 1; i > 0; i -= 1) {
		const j = Math.floor(random() * (i + 1));
		const tmp = out[i];
		out[i] = out[j]!;
		out[j] = tmp!;
	}
	return out;
}
