#!/usr/bin/env node
// Copy KaTeX's stylesheet and woff2 fonts from the version rehype-katex renders
// with into public/katex/, so the CSS always matches the generated markup.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const dist = join(dirname(require.resolve('katex/package.json', { paths: [dirname(require.resolve('rehype-katex'))] })), 'dist');
const out = new URL('../public/katex/', import.meta.url).pathname;
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'fonts'), { recursive: true });
for (const f of readdirSync(join(dist, 'fonts')).filter((f) => f.endsWith('.woff2'))) cpSync(join(dist, 'fonts', f), join(out, 'fonts', f));
// Only woff2 is shipped; drop the woff/ttf fallbacks from @font-face.
const css = readFileSync(join(dist, 'katex.min.css'), 'utf8')
  .replace(/,url\(fonts\/[^)]+\.woff\) format\("woff"\)|,url\(fonts\/[^)]+\.ttf\) format\("truetype"\)/g, '');
writeFileSync(join(out, 'katex.min.css'), css);
