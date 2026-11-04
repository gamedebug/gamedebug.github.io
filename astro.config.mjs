// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://gamedebug.github.io',
  // Keep the Jekyll URL shape: /<slug>/
  trailingSlash: 'always',
  build: { format: 'directory' },
});
