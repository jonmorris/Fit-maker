import { mount } from 'svelte';
import './styles/tokens.css';
import './styles/base.css';
import App from './ui/App.svelte';

// Ask the browser not to evict our IndexedDB data under storage pressure.
// Installed iOS home-screen apps are exempt from Safari's 7-day eviction, but this is cheap insurance.
navigator.storage?.persist?.().catch(() => {});

mount(App, { target: document.getElementById('app')! });
