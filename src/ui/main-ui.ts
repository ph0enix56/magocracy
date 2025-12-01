import { mount } from 'svelte';
import App from './App.svelte';

const target = document.getElementById('ui-root');

if (target) {
	mount(App, { target, props: {} });
}
