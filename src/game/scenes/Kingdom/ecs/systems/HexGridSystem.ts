import type { ECSManager, Entity, System } from '../ECSBase';
import type { Scene } from 'phaser';
import { getBlockingBuildings } from '../../data/buildings';

export type HexGridOptions = {
	hexSize: number;
	hexStroke: number;
	gridOriginYOffset: number;
	onTileSelected: (q: number, r: number) => void;
};

export class HexGridSystem implements System {
	private world: ECSManager;
	private scene: Scene;
	private options: HexGridOptions;

	constructor(world: ECSManager, scene: Scene, options: HexGridOptions) {
		this.world = world;
		this.scene = scene;
		this.options = options;
	}

	update(_delta: number, _time: number): void {}
	advanceTick(): void {}

	static preloadHexTexture(scene: Scene, hexSize: number, hexStroke: number): void {
		const width = Math.sqrt(3) * hexSize + 2 * hexStroke;
		const height = 2 * hexSize + 2 * hexStroke;
		const hex = HexGridSystem.getHexagon(hexSize, width / 2, height / 2);

		scene.add
			.graphics()
			.lineStyle(hexStroke, 0xffffff)
			.fillStyle(0x33cc33, 1)
			.strokePoints(hex.points, true)
			.fillPoints(hex.points, true)
			.generateTexture('hexTile', width, height)
			.destroy();
	}

	initDynamicStartingArea(): void {
		const startCenter = { q: 0, r: 0 };
		const free = new Set<string>();
		const markFree = (q: number, r: number) => free.add(`${q},${r}`);

		// Center + 6 neighbors are visible and free to build.
		markFree(startCenter.q, startCenter.r);
		for (const n of this.neighborsOf(startCenter.q, startCenter.r)) {
			markFree(n.q, n.r);
		}

		// Spawn free tiles.
		for (const key of free) {
			const [qStr, rStr] = key.split(',');
			this.ensureTileExists(Number(qStr), Number(rStr));
		}

		// All neighbors of the free region become visible but blocked.
		const blocked = new Set<string>();
		for (const key of free) {
			const [qStr, rStr] = key.split(',');
			const q = Number(qStr);
			const r = Number(rStr);
			for (const n of this.neighborsOf(q, r)) {
				const nid = `${n.q},${n.r}`;
				if (free.has(nid)) continue;
				blocked.add(nid);
			}
		}

		for (const key of blocked) {
			const [qStr, rStr] = key.split(',');
			this.placeBlockerIfEmpty(Number(qStr), Number(rStr));
		}
	}

	revealHiddenNeighbors(q: number, r: number): void {
		for (const n of this.neighborsOf(q, r)) {
			// If a tile doesn't exist yet, it was hidden; uncover as blocked.
			if (!this.world.getEntity(`${n.q},${n.r}`)) {
				this.placeBlockerIfEmpty(n.q, n.r);
			}
		}
	}

	private neighborsOf(q: number, r: number): Array<{ q: number; r: number }> {
		// Doubled-q coordinates (q is doubled column), derived from odd-r offset grid.
		// Neighbor deltas: E/W = +/-2,0 ; diagonals = +/-1,+/-1
		const deltas = [
			{ dq: 2, dr: 0 },
			{ dq: 1, dr: 1 },
			{ dq: -1, dr: 1 },
			{ dq: -2, dr: 0 },
			{ dq: -1, dr: -1 },
			{ dq: 1, dr: -1 }
		];
		return deltas.map((d) => ({ q: q + d.dq, r: r + d.dr }));
	}

	private screenPosFor(q: number, r: number) {
		const centerX = this.scene.scale.width / 2;
		const centerY = this.scene.scale.height / 2 + this.options.gridOriginYOffset;

		const parity = (r & 1) === 0 ? 0 : 1;
		const c = (q - parity) / 2;

		const x = centerX + this.options.hexSize * Math.sqrt(3) * (c + 0.5 * parity);
		const y = centerY + (this.options.hexSize * 3) / 2 * r;
		return { x, y };
	}

	private getRandomBlockerId(): string {
		const blockers = getBlockingBuildings();
		if (blockers.length === 0) {
			throw new Error('No blocker building defs found.');
		}
		return blockers[Math.floor(Math.random() * blockers.length)]!.id;
	}

	private ensureTileExists(q: number, r: number): Entity {
		const id = `${q},${r}`;
		const existing = this.world.getEntity(id);
		if (existing) return existing;

		const { x, y } = this.screenPosFor(q, r);
		const tile = this.scene.add.image(x, y, 'hexTile');
		tile.setInteractive(HexGridSystem.getHexagon(this.options.hexSize, tile.width / 2, tile.height / 2), Phaser.Geom.Polygon.Contains);

		const entity: Entity = {
			id,
			position: { q, r },
			render: { hex: tile }
		};
		this.world.addEntity(entity);

		tile.on('pointerover', () => {
			tile.setTintFill(0x70db70);
		});
		tile.on('pointerout', () => {
			tile.clearTint();
		});
		tile.on(
			'pointerdown',
			(_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
				// prevent global pointerdown from clearing selection
				event.stopPropagation();
				this.options.onTileSelected(q, r);
			}
		);

		return entity;
	}

	private placeBlockerIfEmpty(q: number, r: number): void {
		const entity = this.ensureTileExists(q, r);
		if (entity.building) return;

		const blockerId = this.getRandomBlockerId();
		entity.building = {
			buildingId: blockerId,
			status: 'active',
			progress: 0
		};
	}

	private static getHexagon(hexSize: number, centerX: number, centerY: number): Phaser.Geom.Polygon {
		const points = [] as Phaser.Geom.Point[];
		for (let i = 0; i < 6; i++) {
			const angle = Phaser.Math.DegToRad(60 * i - 30);
			const x = centerX + hexSize * Math.cos(angle);
			const y = centerY + hexSize * Math.sin(angle);
			points.push(new Phaser.Geom.Point(x, y));
		}
		return new Phaser.Geom.Polygon(points);
	}
}
