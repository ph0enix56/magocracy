export type SelectionSystemOptions = {
	tickIntervalMs: number;
	onTick: (q: number, r: number) => void;
};

export class SelectionSystem {
	private selected: { q: number; r: number } | null = null;
	private timerMs = 0;

	constructor(private readonly options: SelectionSystemOptions) {}

	select(q: number, r: number): void {
		this.selected = { q, r };
		this.timerMs = 0;
		this.options.onTick(q, r);
	}

	clear(): void {
		this.selected = null;
		this.timerMs = 0;
	}

	tick(deltaMs: number): void {
		if (!this.selected) return;
		this.timerMs += deltaMs;
		if (this.timerMs < this.options.tickIntervalMs) return;
		this.timerMs = 0;
		this.options.onTick(this.selected.q, this.selected.r);
	}
}