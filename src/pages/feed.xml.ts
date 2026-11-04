// Atom feed at the same path and format as the old jekyll-feed output.
import type { APIRoute } from 'astro';
import { SITE } from '../consts';
import { excerpt, getPosts, postUrl } from '../lib/posts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async () => {
  const posts = (await getPosts()).slice(0, 20);
  const updated = (posts[0]?.data.updated ?? posts[0]?.data.date ?? new Date()).toISOString();
  const entries = posts.map((p) => {
    const url = new URL(postUrl(p), SITE.url).href;
    return `<entry>
<title>${esc(p.data.title)}</title>
<link href="${esc(url)}" rel="alternate" type="text/html" />
<id>${esc(url)}</id>
<published>${p.data.date.toISOString()}</published>
<updated>${(p.data.updated ?? p.data.date).toISOString()}</updated>
<category term="${esc(p.data.category)}" />${p.data.tags.map((t) => `<category term="${esc(t)}" />`).join('')}
<summary type="text">${esc(p.data.description ?? excerpt(p.body ?? '', 200))}</summary>
</entry>`;
  });
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="zh-CN">
<title>${esc(SITE.title)}</title>
<subtitle>${esc(SITE.bio)}</subtitle>
<link href="${SITE.url}/feed.xml" rel="self" type="application/atom+xml" />
<link href="${SITE.url}/" rel="alternate" type="text/html" />
<id>${SITE.url}/feed.xml</id>
<updated>${updated}</updated>
<author><name>${esc(SITE.author)}</name></author>
${entries.join('\n')}
</feed>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
};
