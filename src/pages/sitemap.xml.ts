// /sitemap.xml at the old path (jekyll-sitemap); lists every public page.
import type { APIRoute } from 'astro';
import { CATEGORY_META, SITE } from '../consts';
import { categoryUrl, formatDate, getPosts, postUrl, tagCounts, tagUrl, visible } from '../lib/posts';

export const GET: APIRoute = async () => {
  const posts = await getPosts();
  const urls: [string, string?][] = [
    ['/'], ['/posts/'], ['/tags/'], ['/about/'],
    ...Object.entries(CATEGORY_META).filter(([, m]) => !m.hidden).map(([c]) => [categoryUrl(c)] as [string]),
    ...tagCounts(visible(posts)).map(([t]) => [tagUrl(t)] as [string]),
    ...posts.map((p) => [postUrl(p), formatDate(p.data.updated ?? p.data.date)] as [string, string]),
  ];
  const loc = (path: string) => new URL(encodeURI(path), SITE.url).href;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, d]) => `<url><loc>${loc(u)}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
