#!/usr/bin/env node
// Download every external image referenced by _posts/ into scripts/image-cache/
// and record it in scripts/image-map.json (url -> local file + metadata).
//
// - 360 (qhimg) thumbnails: fetch the original by dropping "/dr/<n>__/",
//   fall back to the thumbnail if the original is unavailable.
// - Connection errors are retried with backoff (the 360 CDN refuses
//   connections intermittently); HTTP errors are final.
// - Each download must be decodable by sharp, otherwise it counts as failed.
// - scripts/image-overrides.json supplies archived copies for dead URLs.
// - Resumable: URLs already in the map with their file present are skipped.
//
// Usage: node scripts/fetch-images.mjs [--concurrency 6]
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const POSTS = join(ROOT, '_posts');
const CACHE = join(ROOT, 'scripts/image-cache');
const MAP = join(ROOT, 'scripts/image-map.json');
// Replacement sources (e.g. Wayback Machine) for images that are gone upstream.
const OVERRIDES = JSON.parse(readFileSync(join(ROOT, 'scripts/image-overrides.json'), 'utf8'));
const UA = 'Mozilla/5.0 (X11; Linux x86_64) gamedebug-image-fetch';
const CONCURRENCY = Number(process.argv[process.argv.indexOf('--concurrency') + 1]) || 6;
const EXT = { jpeg: 'jpg', png: 'png', gif: 'gif', webp: 'webp', svg: 'svg', avif: 'avif', tiff: 'tif' };

const INLINE = /!\[(?:[^\[\]]|\[[^\]]*\])*\]\(\s*<?([^)\s>]+)/g; // ![alt](url), alt may hold [..]
const REFUSE = /!\[((?:[^\[\]]|\[[^\]]*\])*)\]\[([^\]]*)\]/g; // ![alt][id]
const REFDEF = /^\s*\[([^\]]+)\]:\s*<?(\S+?)>?(?:\s|$)/gm; // [id]: url
const IMGTAG = /<img[^>]+src=["']([^"']+)/gi;

export function imageUrls(text) {
  const refs = new Map([...text.matchAll(REFDEF)].map((m) => [m[1].trim().toLowerCase(), m[2]]));
  const urls = [...text.matchAll(INLINE)].map((m) => m[1]);
  urls.push(...[...text.matchAll(IMGTAG)].map((m) => m[1]));
  for (const m of text.matchAll(REFUSE)) {
    const u = refs.get((m[2] || m[1]).trim().toLowerCase());
    if (u) urls.push(u);
  }
  return urls.filter((u) => /^https?:\/\//.test(u));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 6) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) return { status: res.status };
      return { status: res.status, type: res.headers.get('content-type') || '', body: Buffer.from(await res.arrayBuffer()) };
    } catch (e) {
      last = e.cause?.code || e.name || String(e);
      await sleep(1500 * (i + 1));
    }
  }
  return { status: `network: ${last}` };
}

async function download(url) {
  const candidates = [];
  if (OVERRIDES[url]) candidates.push({ from: OVERRIDES[url], original: !/\/dr\/\d+__\//.test(url) });
  const original = url.replace(/(qhimg\.com)\/dr\/\d+__\//, '$1/');
  if (original !== url) candidates.push({ from: original, original: true });
  candidates.push({ from: url, original: original === url });
  const errors = [];
  for (const c of candidates) {
    const r = await get(c.from);
    if (!r.body) { errors.push(`${c.from}: ${r.status}`); continue; }
    if (!r.type.startsWith('image/')) { errors.push(`${c.from}: content-type ${r.type}`); continue; }
    let meta;
    try { meta = await sharp(r.body, { animated: true }).metadata(); } catch (e) { errors.push(`${c.from}: undecodable (${e.message})`); continue; }
    const ext = EXT[meta.format];
    if (!ext) { errors.push(`${c.from}: unsupported format ${meta.format}`); continue; }
    const hash = createHash('sha256').update(r.body).digest('hex');
    const file = `${hash.slice(0, 12)}.${ext}`;
    writeFileSync(join(CACHE, file), r.body);
    return { file, from: c.from, original: c.original, format: meta.format, width: meta.width,
      height: meta.pageHeight || meta.height, bytes: r.body.length, sha256: hash };
  }
  return { error: errors };
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  const map = existsSync(MAP) ? JSON.parse(readFileSync(MAP, 'utf8')) : { images: {}, failed: {} };
  const uses = new Map();
  for (const f of readdirSync(POSTS).filter((f) => f.endsWith('.md')).sort()) {
    for (const u of imageUrls(readFileSync(join(POSTS, f), 'utf8'))) {
      if (!uses.has(u)) uses.set(u, new Set());
      uses.get(u).add(f);
    }
  }
  const todo = [...uses.keys()].filter((u) => !(map.images[u] && existsSync(join(CACHE, map.images[u].file))));
  console.error(`${uses.size} unique image URLs, ${uses.size - todo.length} already cached, ${todo.length} to fetch`);

  let done = 0;
  const save = () => writeFileSync(MAP, JSON.stringify(map, null, 1) + '\n');
  const worker = async () => {
    while (todo.length) {
      const url = todo.shift();
      const r = await download(url);
      if (r.error) { map.failed[url] = { posts: [...uses.get(url)], errors: r.error }; delete map.images[url]; }
      else { map.images[url] = { ...r, posts: [...uses.get(url)] }; delete map.failed[url]; }
      if (++done % 50 === 0) { save(); console.error(`  ${done} done`); }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  // Drop entries for URLs no longer referenced by any post.
  for (const u of Object.keys(map.images)) if (!uses.has(u)) delete map.images[u];
  for (const u of Object.keys(map.failed)) if (!uses.has(u)) delete map.failed[u];
  save();

  const imgs = Object.values(map.images);
  const total = imgs.reduce((s, i) => s + i.bytes, 0);
  console.error(`cached: ${imgs.length} (${imgs.filter((i) => i.original).length} originals), `
    + `${(total / 1048576).toFixed(1)} MB; failed: ${Object.keys(map.failed).length}`);
  for (const [u, f] of Object.entries(map.failed)) console.error(`  FAILED ${u}\n    ${f.errors.join('\n    ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
