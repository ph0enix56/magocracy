/**
 * Client-side configuration constants.
 */
export const configuration = {
	kingdomView: {
		hexSize: 64,
		hexStroke: 4,
		gridOriginYOffset: -20,
		backgroundColor: 0xcacaca
	},

	render: {
		building: {
			hexSize: 64,
			spriteFillScaleMultiplier: 1.15,
				textureOversample: 2,
			alpha: {
				initial: 0.5,
				constructing: 0.6,
				upgrading: 0.8
			},
			badge: {
				offsetX: 0,
				offsetY: 0,
				radius: 16,
				ringRadius: 19,
				ringWidth: 4,
				fontSize: 18,
				depth: 30,
				color: '#ffffff',
				strokeColor: '#000000',
				strokeThickness: 4,
				fillColor: 0x101318,
				fillAlpha: 0.9,
				borderColor: 0xffffff,
				borderAlpha: 0.14,
				borderWidth: 2,
				trackColor: 0x000000,
				trackAlpha: 0.35,
				ringAlpha: 1,
				ringColor: {
					constructing: 0xffa500,
					upgrading: 0x00bfff
				}
			}
		}
	}
} as const;

export type GameConfiguration = typeof configuration;
