import { Game as MainGame } from './scenes/Game';
import { AUTO, Game, Scale, type Types } from 'phaser';

const config: Types.Core.GameConfig = {
	type: AUTO,
	width: 1920,
	height: 1080,
	parent: 'game-container',
	backgroundColor: '#72d345',
	scale: {
		mode: Scale.FIT,
		autoCenter: Scale.CENTER_BOTH
	},
	scene: [
		MainGame
	]
};

const StartGame = (parent: string) => {
	return new Game({ ...config, parent });
}

export default StartGame;
