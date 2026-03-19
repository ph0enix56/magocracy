export function createLobbyId(): string {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	let out = '';
	for (let i = 0; i < 6; i += 1) {
		out += alphabet[Math.floor(Math.random() * alphabet.length)] ?? 'X';
	}
	return out;
}
