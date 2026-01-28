import { KingdomScene } from './scenes/Kingdom/KingdomScene';
import { AUTO, Game, Scale, type Types } from 'phaser';

const config: Types.Core.GameConfig = {
	type: AUTO,
	width: 1920,
	height: 1080,
	parent: 'game-container',
	backgroundColor: '#000000',
	scale: {
		mode: Scale.FIT,
		autoCenter: Scale.CENTER_BOTH
	},
	scene: [
		KingdomScene
	]
};

const StartGame = (parent: string) => {
	return new Game({ ...config, parent });
}

export default StartGame;
