// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkCjkFriendly from 'remark-cjk-friendly';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

/** Flag posts that contain math so the layout only loads KaTeX CSS there. */
function remarkMathFlag() {
  /** @param {any} node */
  const hasMath = (node) => node.type === 'math' || node.type === 'inlineMath' || (node.children ?? []).some(hasMath);
  /** @param {any} tree @param {any} file */
  return (tree, file) => {
    if (hasMath(tree)) file.data.astro.frontmatter.math = true;
  };
}

export default defineConfig({
  site: 'https://gamedebug.github.io',
  // Keep the Jekyll URL shape: /<slug>/
  trailingSlash: 'always',
  build: { format: 'directory' },
  redirects: {
    // The old, always-empty projects page.
    '/projects/': '/posts/',
  },
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false, // colours via --shiki-light / --shiki-dark, switched in global.css
    },
    // The remark/rehype pipeline instead of Astro 7's default Sätteri: the
    // plugins we need (CJK emphasis, build-time KaTeX) are unified plugins.
    processor: unified({
      remarkPlugins: [
        // CommonMark ignores ** next to CJK text + punctuation (e.g. 在**/etc/x**文件);
        // kramdown rendered those as bold, so keep that behaviour.
        remarkCjkFriendly,
        // $$…$$ only: a single $ is everywhere in shell snippets ($HOME, $TOKEN).
        [remarkMath, { singleDollarTextMath: false }],
        remarkMathFlag,
      ],
      rehypePlugins: [rehypeKatex],
    }),
  },
});
