import { KingdomScene } from './scenes/Kingdom/KingdomScene';
import { AUTO, Game, Scale, type Types } from 'phaser';

const config: Types.Core.GameConfig = {
	type: AUTO,
	width: '100%',
	height: '100%',
	parent: 'game-container',
	backgroundColor: '#000000',
	antialias: true,
	antialiasGL: true,
	roundPixels: false,
	mipmapFilter: 'LINEAR',
	scale: {
		mode: Scale.RESIZE,
		autoCenter: Scale.CENTER_BOTH
	},
	scene: [KingdomScene]
};

const StartGame = (parent: string) => {
	return new Game({ ...config, parent });
}

export default StartGame;
