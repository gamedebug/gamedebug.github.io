#!/usr/bin/env node
// Convert Jekyll _posts/ into Astro content at src/content/posts/<date>-<slug>/index.md.
//
// Re-runnable: src/content/posts/ is regenerated from scratch on every run;
// _posts/ is only read. Category/tags come from scripts/taxonomy.csv when it
// exists (your edits win); otherwise a first draft is generated from rules
// and written there for review.
//
// Usage: node scripts/migrate-posts.mjs
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import { imageUrls } from './fetch-images.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, '_posts');
const OUT = join(ROOT, 'src/content/posts');
const CACHE = join(ROOT, 'scripts/image-cache');
const TAXONOMY = join(ROOT, 'scripts/taxonomy.csv');
const REPORT = join(ROOT, 'scripts/migrate-report.md');
const CATEGORIES = ['技术', 'ACG', '科普', '健康'];

// ---------- slug: taken from the live site so URLs never change ----------

const baseline = JSON.parse(readFileSync(join(ROOT, 'scripts/baseline/baseline.json'), 'utf8'));
const livePosts = baseline.pages.filter((p) => 'text' in p);
const loose = (s) => s.normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase();

function liveSlug(name) {
  const exact = livePosts.filter((p) => p.path === `/${name}/`);
  const hits = exact.length ? exact : livePosts.filter((p) => loose(p.path) === loose(name));
  if (hits.length !== 1) throw new Error(`cannot map ${name} to exactly one live URL (got ${hits.length})`);
  return hits[0];
}

// ---------- taxonomy ----------

const ACG_GAMES = /^(Build-a-WoW-Server|WoW-GM-commands|Build-a-LineageII-Server|a-first-look-at-google-stadia-Part-[12])$/;
const SCIENCE = /^(熵|Benfords-law-python|Science-and-the-Internet|The-Different-Types-of-Stars|what-is-a-black-hole|Territorial-evolution-of-the-United-States)$/;
const GUNDAM_ERA = { 'Gundam-机动战士逆A高达': 'CC', 'Gundam-铁血的奥尔芬斯': 'PD' };
const TECH_TAGS = [
  ['内核', /kernel|内核|cpu_hotplug|soft.?lockup|linux-kernel-release/i],
  ['内存', /mem|swap|oom|numa|缓存|脏数据/i],
  ['存储与文件系统', /nfs|fsck|io_subsystem|disk|filesystem/i],
  ['网络', /socket|tcp|network|ntpq|nginx|ftp|nitro/i],
  ['性能调优', /optimi[sz]|tuning|performance|sar|monitor|优化/i],
  ['安全', /password|pam|cve|audit|buffer-overflow/i],
  ['虚拟化', /kvm|openstack/i],
  ['AWS', /aws|nitro/i],
  ['SUSE', /sles|suse/i],
  ['命令行工具', /manual-ls|tmate|funny-cli|tcpdump|ntpq/i],
  ['AI', /chatgpt|tensorflow|风控/i],
  ['Linux 发行版', /garuda|oslogo/i],
  ['Scratch', /scratch/i],
];
const SCIENCE_TAGS = {
  '熵': ['信息论'], 'Benfords-law-python': ['数学', 'Python'], 'Science-and-the-Internet': ['互联网'],
  'The-Different-Types-of-Stars': ['天文'], 'what-is-a-black-hole': ['天文'],
  'Territorial-evolution-of-the-United-States': ['历史地理'],
};

function draftTaxonomy(name, fm) {
  if (fm.category === 'Gundam') {
    const era = GUNDAM_ERA[name] || (fm.title.match(/（([A-Z]{2})\d+）/) || [])[1];
    return { category: 'ACG', tags: ['高达', era].filter(Boolean) };
  }
  if (ACG_GAMES.test(name)) {
    if (/stadia/i.test(name)) return { category: 'ACG', tags: ['云游戏'] };
    return { category: 'ACG', tags: ['私服', /WoW/.test(name) ? '魔兽世界' : '天堂2'] };
  }
  if (SCIENCE.test(name)) return { category: '科普', tags: SCIENCE_TAGS[name] };
  if (fm.category === '健康') return { category: '健康', tags: /MERS/.test(name) ? ['MERS', '新冠'] : ['新冠'] };
  const hay = `${name} ${fm.title}`;
  return { category: '技术', tags: TECH_TAGS.filter(([, re]) => re.test(hay)).map(([t]) => t) };
}

// Minimal RFC 4180 CSV.
const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

// ---------- body transforms ----------

// Apply fn to the parts of a Markdown body that are outside fenced code blocks.
function outsideCode(body, fn) {
  return body.split(/(^ {0,3}(?:```|~~~)[^\n]*\n[\s\S]*?^ {0,3}(?:```|~~~)[ \t]*$)/m)
    .map((part, i) => (i % 2 ? part : fn(part))).join('');
}

function checks(body) {
  const issues = [];
  const fences = (body.match(/^ {0,3}```/gm) || []).length;
  if (fences % 2) issues.push(`代码围栏数量为奇数（${fences} 个），有未闭合的代码块`);
  if (/^>\s*```/m.test(body)) issues.push('引用块里有代码围栏 `>```');
  outsideCode(body, (t) => {
    if (/\{\{|\{%/.test(t)) issues.push('正文里有 `{{` 或 `{%`（Jekyll 的 Liquid 曾处理过它们）');
    if (/\{:|\{::/.test(t)) issues.push('有 kramdown 专有语法 `{:`');
    if (/^~~~/m.test(t)) issues.push('使用了 `~~~` 代码围栏');
    if (/\\mathrm|\\frac|\\sum/.test(t)) issues.push('有未加分隔符的 LaTeX 文本');
    const lines = t.split('\n');
    lines.forEach((l, i) => {
      if (/^\|?[^|\n]+\|[^|\n]+/.test(l) && !/^\s*\|?\s*:?-{3,}/.test(l)
        && !(lines[i - 1] || '').includes('|') && !/^\s*\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
        issues.push(`第 ${i + 1} 行附近的表格缺少表头分隔行`);
      }
    });
    return t;
  });
  return [...new Set(issues)];
}

function transform(body, images) {
  // 1. Drop the decorative rule at the top of the body.
  body = body.replace(/^\s*-{3,}\s*\n/, '');
  // 2a. A lone ```` opener closed by ``` (kramdown tolerates it, CommonMark
  //     never closes the block). Only exact four-backtick lines are touched.
  body = body.replace(/^````[ \t]*$/gm, '```');
  // 2b. Fences indented 1-3 spaces with unindented contents (one post):
  //     CommonMark nests them in the preceding list and mis-pairs them.
  body = body.replace(/^ {1,3}(```[^\n]*)$/gm, '$1');
  // 2c. Code fences opened inside a blockquote (>```) whose contents or closing
  //     fence lack the ">" prefix: kramdown took them as lazy continuation,
  //     CommonMark does not, so the block never closes. Add the prefix.
  {
    const lines = body.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!/^>\s?```/.test(lines[i])) continue;
      let j = i + 1;
      for (; j < lines.length; j++) {
        if (/^(>\s?)?```\s*$/.test(lines[j])) { if (!lines[j].startsWith('>')) lines[j] = `>${lines[j]}`; break; }
        if (!lines[j].startsWith('>')) lines[j] = `>${lines[j]}`;
      }
      i = j;
    }
    body = lines.join('\n');
  }
  // 2d. A raw HTML block only ends at a blank line in CommonMark; text right
  //     after </table> would otherwise be emitted as raw HTML.
  body = body.replace(/^(\s*<\/table>[ \t]*)\n(?=[^\n])/gm, '$1\n\n');
  // 2. ATX headings need a space after the hashes in CommonMark.
  body = outsideCode(body, (t) => t.replace(/^(#{1,6})([^#\s])/gm, '$1 $2'));
  // 3. External image URLs -> local files next to the post.
  const used = new Set();
  for (const url of new Set(imageUrls(body))) {
    const img = images[url];
    if (!img) throw new Error(`image not in image-map.json: ${url}`);
    body = body.split(url).join(`./images/${img.file}`);
    used.add(img.file);
  }
  // 4. Reference-style images (![alt][1] + [1]: url) -> inline ![alt](url):
  //    Astro's image pipeline only optimizes inline image nodes.
  const defs = new Map([...body.matchAll(/^ {0,3}\[([^\]]+)\]:\s*<?(\.\/images\/\S+?)>?\s*$/gm)]
    .map((m) => [m[1].trim().toLowerCase(), m[2]]));
  body = outsideCode(body, (t) => t.replace(/!\[((?:[^\[\]]|\[[^\]]*\])*)\]\[([^\]]*)\]/g, (all, alt, id) => {
    const url = defs.get((id || alt).trim().toLowerCase());
    return url ? `![${alt}](${url})` : all;
  }));
  //    Drop local-image definitions nothing refers to any more.
  body = body.replace(/^ {0,3}\[([^\]]+)\]:\s*<?\.\/images\/[^\s>]+>?[ \t]*\n?/gm, (line, id) =>
    (body.includes(`][${id}]`) ? line : ''));
  return { body: body.replace(/^\n+/, '').replace(/\n{3,}$/, '\n'), used };
}

// ---------- main ----------

function main() {
  const { images, failed } = JSON.parse(readFileSync(join(ROOT, 'scripts/image-map.json'), 'utf8'));
  if (Object.keys(failed).length) throw new Error('image-map.json has failed downloads; run fetch-images first');
  const edited = existsSync(TAXONOMY) ? new Map(parseCsv(readFileSync(TAXONOMY, 'utf8')).map((r) => [r.slug, r])) : null;

  rmSync(OUT, { recursive: true, force: true });
  const rows = [], report = [], slugs = new Set();
  let imageCount = 0;

  for (const file of readdirSync(SRC).filter((f) => f.endsWith('.md')).sort()) {
    const [, date, name] = file.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/) || [];
    if (!date) throw new Error(`unexpected file name: ${file}`);
    const raw = readFileSync(join(SRC, file), 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) throw new Error(`${file}: no front matter`);
    const fm = YAML.parse(m[1], { strict: true, uniqueKeys: true }); // throws on bad YAML

    const live = liveSlug(name);
    const slug = live.path.slice(1, -1);
    if (slugs.has(slug)) throw new Error(`duplicate slug ${slug}`);
    slugs.add(slug);

    const draft = draftTaxonomy(name, fm);
    const mine = edited?.get(slug);
    const category = mine ? mine.category : draft.category;
    const tags = mine ? mine.tags.split('|').map((t) => t.trim()).filter(Boolean) : draft.tags;
    if (!CATEGORIES.includes(category)) throw new Error(`${slug}: unknown category ${category}`);

    const issues = checks(m[2]);
    const { body, used } = transform(m[2], images);
    const dir = join(OUT, `${date}-${slug}`);
    mkdirSync(join(dir, 'images'), { recursive: true });
    for (const f of used) copyFileSync(join(CACHE, f), join(dir, 'images', f));
    if (!used.size) rmSync(join(dir, 'images'), { recursive: true });
    imageCount += used.size;

    const front = YAML.stringify({ title: String(fm.title), date, slug, category, tags },
      { defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' }).replace(/^date: "(.+)"$/m, 'date: $1');
    writeFileSync(join(dir, 'index.md'), `---\n${front}---\n\n${body}`);

    rows.push({ slug, title: String(fm.title), old_category: fm.category, old_tags: (fm.tags || []).join('|'),
      category, tags: tags.join('|') });
    if (issues.length) report.push(`- \`${date}-${slug}\`\n${issues.map((i) => `  - ${i}`).join('\n')}`);
  }

  if (!edited) {
    const head = ['slug', 'title', 'old_category', 'old_tags', 'category', 'tags'];
    writeFileSync(TAXONOMY, [head.join(','), ...rows.map((r) => head.map((h) => csvCell(r[h])).join(','))].join('\n') + '\n');
  }
  const counts = rows.reduce((o, r) => ((o[r.category] = (o[r.category] || 0) + 1), o), {});
  const tagUse = rows.flatMap((r) => r.tags.split('|').filter(Boolean)).reduce((o, t) => ((o[t] = (o[t] || 0) + 1), o), {});
  const untagged = rows.filter((r) => !r.tags).map((r) => r.slug);
  writeFileSync(REPORT, [
    '# 迁移报告', '',
    `- 文章：${rows.length} 篇；分类：${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join('，')}`,
    `- 本地图片：${imageCount} 个文件（按文章计）`,
    `- 没有标签的文章：${untagged.length ? untagged.join('，') : '无'}`,
    `- 只用了一次的标签：${Object.keys(tagUse).filter((t) => tagUse[t] === 1).join('，') || '无'}`,
    '', '## 需要人工检查的文章', '', report.join('\n') || '无', '',
  ].join('\n'));
  console.error(`migrated ${rows.length} posts, ${imageCount} images; ${report.length} posts need review`);
  console.error(edited ? 'taxonomy: from scripts/taxonomy.csv' : 'taxonomy: draft written to scripts/taxonomy.csv');
}

main();
