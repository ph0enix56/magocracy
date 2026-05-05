import { mount } from 'svelte';
import StartGame from './render/phaserEntry';
import App from './ui/App.svelte';

document.addEventListener('DOMContentLoaded', () => {
	StartGame('game-container');
});

const target = document.getElementById('ui-root');
if (target) {
	mount(App, { target, props: {} });
}
