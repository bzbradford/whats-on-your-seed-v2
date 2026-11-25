import { mount } from 'svelte';
import './app.css';
import './styles/legacy.css';
import './styles/embed.css';
import App from './App.svelte';
import { getViewMode } from './lib/view-mode';

document.documentElement.dataset.view = getViewMode(window.location.search);

// Mount straight into <body>: legacy print rules select `body > header` / `body > main`.
const app = mount(App, { target: document.body });

export default app;
