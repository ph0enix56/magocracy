import { KingdomScene } from './scenes/Kingdom/KingdomScene';
import { BootScene } from './scenes/Boot/BootScene';
import { WorldMapScene } from './scenes/WorldMap/WorldMapScene';
import { RunLoopScene } from './scenes/RunLoop/RunLoopScene';
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
		BootScene,
		RunLoopScene,
		KingdomScene,
		WorldMapScene
	]
};

const StartGame = (parent: string) => {
	return new Game({ ...config, parent });
}

export default StartGame;
