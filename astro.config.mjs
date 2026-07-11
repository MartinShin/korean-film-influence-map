// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  output: 'static',
  site: 'https://korean-film-influence-map.vercel.app',
  integrations: [react()],
  vite: { build: { sourcemap: false } },
});
