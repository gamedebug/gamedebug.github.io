// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkCjkFriendly from 'remark-cjk-friendly';

export default defineConfig({
  site: 'https://gamedebug.github.io',
  // Keep the Jekyll URL shape: /<slug>/
  trailingSlash: 'always',
  build: { format: 'directory' },
  markdown: {
    // The remark/rehype pipeline instead of Astro 7's default Sätteri: the
    // plugins we need (CJK emphasis, build-time KaTeX) are unified plugins.
    processor: unified({
      // CommonMark ignores ** next to CJK text + punctuation (e.g. 在**/etc/x**文件);
      // kramdown rendered those as bold, so keep that behaviour.
      remarkPlugins: [remarkCjkFriendly],
    }),
  },
});
