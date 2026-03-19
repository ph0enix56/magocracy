type Pairing = [string, string?];

const BYE_PLAYER_ID = '__bye__';

export function buildRoundRobinCycle(params: {
	playerIds: string[];
	cycleIndex: number;
	firstCycleOpeningSignature: string | null;
}): { rounds: Pairing[][]; firstCycleOpeningSignature: string | null } {
	const { playerIds, cycleIndex, firstCycleOpeningSignature } = params;
	if (playerIds.length <= 1) {
		return { rounds: [], firstCycleOpeningSignature };
	}

	for (let attempt = 0; attempt < 8; attempt += 1) {
		const shuffled = shuffleDeterministic(playerIds, (cycleIndex + 1) * 10_007 + attempt * 313 + playerIds.length * 17);
		const rounds = buildRoundRobinRounds(shuffled);
		const openingSignature = serializeRound(rounds[0] ?? []);

		if (cycleIndex === 0) {
			return { rounds, firstCycleOpeningSignature: openingSignature };
		}

		if (!firstCycleOpeningSignature || openingSignature !== firstCycleOpeningSignature) {
			return { rounds, firstCycleOpeningSignature };
		}
	}

	return { rounds: buildRoundRobinRounds(playerIds), firstCycleOpeningSignature };
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

function shuffleDeterministic(values: string[], seed: number): string[] {
	const out = [...values];
	let state = seed >>> 0;
	for (let i = out.length - 1; i > 0; i -= 1) {
		state = (state * 1664525 + 1013904223) >>> 0;
		const j = state % (i + 1);
		const tmp = out[i];
		out[i] = out[j]!;
		out[j] = tmp!;
	}
	return out;
}

function serializeRound(round: Pairing[]): string {
	return round
		.map(([a, b]) => (b ? [a, b].sort().join('-') : `${a}-bye`))
		.sort()
		.join('|');
}
