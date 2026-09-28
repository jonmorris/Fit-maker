import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Generates PNG icons (incl. apple-touch-icon) from public/logo.svg.
// Run `npm run icons` after changing the logo.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    apple: { sizes: [180], padding: 0.2, resizeOptions: { background: '#1f1d1a' } },
    maskable: { sizes: [512], padding: 0.3, resizeOptions: { background: '#1f1d1a' } },
  },
  images: ['public/logo.svg'],
});
